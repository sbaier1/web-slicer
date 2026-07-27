import * as THREE from 'three';
import ClipperLib from 'clipper-lib';
import type { SlicerSettings, SlicedResult, GCodeLayer, GCodeSegment, Vector3D } from '../types/slicer';

const SCALE = 1000; // Clipper integer scale factor (1mm = 1000 units)

export type LineSegment2D = {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
};

/**
 * Calculates plane-triangle intersection line segment at height Z
 */
function getTrianglePlaneIntersection(
  v0: THREE.Vector3,
  v1: THREE.Vector3,
  v2: THREE.Vector3,
  z: number
): LineSegment2D | null {
  const verts = [v0, v1, v2];
  const below: THREE.Vector3[] = [];
  const above: THREE.Vector3[] = [];
  const on: THREE.Vector3[] = [];

  for (const v of verts) {
    if (Math.abs(v.z - z) < 1e-6) {
      on.push(v);
    } else if (v.z < z) {
      below.push(v);
    } else {
      above.push(v);
    }
  }

  if (below.length === 3 || above.length === 3) return null;

  const intersectionPts: { x: number; y: number }[] = [];

  const interpolateEdge = (a: THREE.Vector3, b: THREE.Vector3) => {
    const t = (z - a.z) / (b.z - a.z);
    return {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
    };
  };

  if (below.length === 1 && above.length === 2) {
    intersectionPts.push(interpolateEdge(below[0], above[0]));
    intersectionPts.push(interpolateEdge(below[0], above[1]));
  } else if (below.length === 2 && above.length === 1) {
    intersectionPts.push(interpolateEdge(above[0], below[0]));
    intersectionPts.push(interpolateEdge(above[0], below[1]));
  } else if (on.length === 1 && below.length === 1 && above.length === 1) {
    intersectionPts.push({ x: on[0].x, y: on[0].y });
    intersectionPts.push(interpolateEdge(below[0], above[0]));
  }

  if (intersectionPts.length === 2) {
    return { p1: intersectionPts[0], p2: intersectionPts[1] };
  }

  return null;
}

/**
 * Connects raw unstructured 2D line segments into Clipper polygon paths
 */
function assembleClipperPaths(segments: LineSegment2D[]): ClipperLib.Paths {
  const remaining = [...segments];
  const paths: ClipperLib.Paths = [];
  const EPS = 0.05;

  while (remaining.length > 0) {
    const currentPath: ClipperLib.Path = [];
    const firstSeg = remaining.pop()!;
    currentPath.push({ X: Math.round(firstSeg.p1.x * SCALE), Y: Math.round(firstSeg.p1.y * SCALE) });
    currentPath.push({ X: Math.round(firstSeg.p2.x * SCALE), Y: Math.round(firstSeg.p2.y * SCALE) });

    let building = true;
    while (building && remaining.length > 0) {
      let foundNext = false;
      const lastPt = currentPath[currentPath.length - 1];

      for (let i = remaining.length - 1; i >= 0; i--) {
        const seg = remaining[i];
        const p1X = Math.round(seg.p1.x * SCALE);
        const p1Y = Math.round(seg.p1.y * SCALE);
        const p2X = Math.round(seg.p2.x * SCALE);
        const p2Y = Math.round(seg.p2.y * SCALE);

        const dist1 = Math.hypot(p1X - lastPt.X, p1Y - lastPt.Y);
        const dist2 = Math.hypot(p2X - lastPt.X, p2Y - lastPt.Y);

        if (dist1 < EPS * SCALE) {
          currentPath.push({ X: p2X, Y: p2Y });
          remaining.splice(i, 1);
          foundNext = true;
          break;
        } else if (dist2 < EPS * SCALE) {
          currentPath.push({ X: p1X, Y: p1Y });
          remaining.splice(i, 1);
          foundNext = true;
          break;
        }
      }

      if (!foundNext) building = false;
    }

    if (currentPath.length >= 3) {
      paths.push(currentPath);
    }
  }

  return paths;
}

/**
 * Clipper offset for exact perimeter wall generation
 */
function offsetClipperPaths(paths: ClipperLib.Paths, offsetMm: number): ClipperLib.Paths {
  if (offsetMm === 0) return paths;

  const co = new ClipperLib.ClipperOffset();
  co.AddPaths(paths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const solution: ClipperLib.Paths = [];
  co.Execute(solution, offsetMm * SCALE);
  return solution;
}

/**
 * Precision CAD 3D Mesh Slicing Engine using Z-Grounding & ClipperLib polygon offsetting
 */
export async function sliceModelsInBrowser(
  models: Array<{ geometry: THREE.BufferGeometry; position: Vector3D; rotation: Vector3D; scale: Vector3D }>,
  settings: SlicerSettings,
  onProgress?: (percent: number, stepMessage: string) => void
): Promise<SlicedResult> {
  onProgress?.(5, 'Transforming CAD geometry & grounding base to Z=0...');
  await new Promise((r) => setTimeout(r, 20));

  if (models.length === 0) {
    throw new Error('No 3D models on the build plate to slice!');
  }

  let maxZ = -Infinity;

  type Triangle3D = [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  const allTriangles: Triangle3D[] = [];

  for (const model of models) {
    const clonedGeo = model.geometry.clone();

    // 1. Scale & Rotation
    const scaleMatrix = new THREE.Matrix4().makeScale(model.scale.x, model.scale.y, model.scale.z);
    const rotMatrix = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(model.rotation.x, model.rotation.y, model.rotation.z)
    );
    const rotScaleMatrix = new THREE.Matrix4().multiplyMatrices(scaleMatrix, rotMatrix);

    // 2. Compute bounding box to ground lowest vertex at Z=0
    const tempGeo = clonedGeo.clone();
    tempGeo.applyMatrix4(rotScaleMatrix);
    tempGeo.computeBoundingBox();

    const bb = tempGeo.boundingBox!;
    const zOffset = -bb.min.z; // Ground lowest vertex to Z=0!

    // 3. Translation (X, Y, Z + zOffset)
    const transMatrix = new THREE.Matrix4().makeTranslation(
      model.position.x,
      model.position.y,
      model.position.z + zOffset
    );

    const worldMatrix = new THREE.Matrix4().multiplyMatrices(transMatrix, rotScaleMatrix);
    clonedGeo.applyMatrix4(worldMatrix);
    clonedGeo.computeBoundingBox();

    if (clonedGeo.boundingBox) {
      maxZ = Math.max(maxZ, clonedGeo.boundingBox.max.z);
    }

    const posAttr = clonedGeo.getAttribute('position');
    const indexAttr = clonedGeo.getIndex();

    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i += 3) {
        const i0 = indexAttr.getX(i);
        const i1 = indexAttr.getX(i + 1);
        const i2 = indexAttr.getX(i + 2);

        const v0 = new THREE.Vector3().fromBufferAttribute(posAttr, i0);
        const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, i1);
        const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, i2);

        allTriangles.push([v0, v1, v2]);
      }
    } else {
      for (let i = 0; i < posAttr.count; i += 3) {
        const v0 = new THREE.Vector3().fromBufferAttribute(posAttr, i);
        const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, i + 1);
        const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, i + 2);

        allTriangles.push([v0, v1, v2]);
      }
    }
  }

  // Bottom face is at Z = 0
  const minZ = 0;
  const modelHeight = maxZ;
  const numLayers = Math.max(1, Math.floor(modelHeight / settings.layerHeight));

  onProgress?.(15, `Slicing ${allTriangles.length} triangles into ${numLayers} layers...`);
  await new Promise((r) => setTimeout(r, 20));

  const layers: GCodeLayer[] = [];
  const gcodeLines: string[] = [];

  // G-Code Header
  const now = new Date().toISOString();
  gcodeLines.push(`; Generated by OrcaWeb Precision Clipper Slicer`);
  gcodeLines.push(`; Date: ${now}`);
  gcodeLines.push(`; Printer: ${settings.bed.name}`);
  gcodeLines.push(`; Filament: ${settings.filament.name}`);
  gcodeLines.push(`; Layer Height: ${settings.layerHeight}mm`);
  gcodeLines.push(`; Infill: ${settings.infillDensity}% (${settings.infillPattern})`);
  gcodeLines.push(`; Bed Temp: ${settings.bedTemp}°C, Nozzle Temp: ${settings.nozzleTemp}°C`);
  gcodeLines.push(``);
  gcodeLines.push(`M140 S${settings.bedTemp} ; set bed temp`);
  gcodeLines.push(`M104 S${settings.nozzleTemp} ; set nozzle temp`);
  gcodeLines.push(`M190 S${settings.bedTemp} ; wait for bed temp`);
  gcodeLines.push(`M109 S${settings.nozzleTemp} ; wait for nozzle temp`);
  gcodeLines.push(`G28 ; home all axes`);
  gcodeLines.push(`G90 ; absolute positioning`);
  gcodeLines.push(`M83 ; relative extrusion mode`);
  gcodeLines.push(`G1 Z${settings.firstLayerHeight} F${settings.travelSpeed * 60}`);
  gcodeLines.push(`; Prime line`);
  gcodeLines.push(`G1 X5 Y5 Z0.24 F3000.0`);
  gcodeLines.push(`G1 X5 Y100 E10 F1500.0`);
  gcodeLines.push(`G1 X5.4 Y100 F3000.0`);
  gcodeLines.push(`G1 X5.4 Y5 E10 F1500.0`);
  gcodeLines.push(`G1 E-${settings.retractionDistance} F${settings.retractionSpeed * 60} ; retract`);
  gcodeLines.push(`; --- START PRINT ---`);
  gcodeLines.push(``);

  let totalExtrusionMm = 20;

  // 2. Slice each layer Z plane starting from Z = 0
  for (let l = 0; l < numLayers; l++) {
    const layerPercent = 20 + Math.floor((l / numLayers) * 75);
    if (l % 5 === 0) {
      onProgress?.(layerPercent, `Processing layer ${l + 1} of ${numLayers}...`);
      await new Promise((r) => setTimeout(r, 0));
    }

    const currentLayerZ = minZ + settings.firstLayerHeight + l * settings.layerHeight;
    const isTopOrBottom = l < settings.bottomSolidLayers || l >= numLayers - settings.topSolidLayers;

    const rawSegments: LineSegment2D[] = [];

    // Intersect triangles with Z plane
    for (const [v0, v1, v2] of allTriangles) {
      const seg = getTrianglePlaneIntersection(v0, v1, v2, currentLayerZ);
      if (seg) rawSegments.push(seg);
    }

    const basePaths = assembleClipperPaths(rawSegments);
    const layerSegments: GCodeSegment[] = [];

    gcodeLines.push(`;LAYER:${l}`);
    gcodeLines.push(`;Z:${currentLayerZ.toFixed(3)}`);
    gcodeLines.push(`G1 Z${currentLayerZ.toFixed(3)} F${settings.travelSpeed * 60}`);

    const numWalls = settings.wallPerimeters;
    const nozzleDia = settings.bed.nozzleDiameter;

    // Perimeters using Clipper Offset
    for (let w = 0; w < numWalls; w++) {
      const isOuter = w === 0;
      const wallType = isOuter ? 'outer_wall' : 'inner_wall';
      const wallSpeed = isOuter ? settings.outerWallSpeed : settings.printSpeed;

      const offsetMm = -w * nozzleDia * 0.9;
      const wallPaths = offsetClipperPaths(basePaths, offsetMm);

      gcodeLines.push(`;TYPE:${isOuter ? 'Outer wall' : 'Inner wall'}`);
      gcodeLines.push(`G1 F${wallSpeed * 60}`);

      for (const path of wallPaths) {
        if (path.length < 3) continue;

        let lastPt: Vector3D | null = null;

        for (let i = 0; i <= path.length; i++) {
          const pt = path[i % path.length];
          const posX = pt.X / SCALE;
          const posY = pt.Y / SCALE;
          const currVec: Vector3D = { x: posX, y: posY, z: currentLayerZ };

          if (i === 0) {
            gcodeLines.push(`G0 X${posX.toFixed(3)} Y${posY.toFixed(3)} F${settings.travelSpeed * 60}`);
            gcodeLines.push(`G1 E${settings.retractionDistance} F${settings.retractionSpeed * 60} ; un-retract`);
          } else if (lastPt) {
            const dist = Math.hypot(currVec.x - lastPt.x, currVec.y - lastPt.y);
            const filArea = Math.PI * Math.pow(settings.filament.diameter / 2, 2);
            const extE = (dist * nozzleDia * settings.layerHeight) / filArea;
            totalExtrusionMm += extE;

            gcodeLines.push(`G1 X${posX.toFixed(3)} Y${posY.toFixed(3)} E${extE.toFixed(5)}`);

            layerSegments.push({
              type: wallType,
              points: [{ ...lastPt }, { ...currVec }],
              extrusion: extE,
              feedrate: wallSpeed * 60,
              layerIndex: l,
            });
          }
          lastPt = currVec;
        }

        gcodeLines.push(`G1 E-${settings.retractionDistance} F${settings.retractionSpeed * 60}`);
      }
    }

    // Infill Generation (Hatch fill inside innermost perimeter)
    const innermostPaths = offsetClipperPaths(basePaths, -(numWalls - 0.5) * nozzleDia);
    const infillDensityVal = isTopOrBottom ? 100 : settings.infillDensity;

    if (innermostPaths.length > 0 && infillDensityVal > 0) {
      gcodeLines.push(`;TYPE:${isTopOrBottom ? 'Solid infill' : 'Infill'}`);
      gcodeLines.push(`G1 F${settings.infillSpeed * 60}`);

      let minX = Infinity,
        maxX = -Infinity;
      let minY = Infinity,
        maxY = -Infinity;

      for (const path of innermostPaths) {
        for (const pt of path) {
          const px = pt.X / SCALE;
          const py = pt.Y / SCALE;
          minX = Math.min(minX, px);
          maxX = Math.max(maxX, px);
          minY = Math.min(minY, py);
          maxY = Math.max(maxY, py);
        }
      }

      const stepY = nozzleDia / (infillDensityVal / 100 || 0.1);

      for (let y = minY + stepY; y < maxY; y += isTopOrBottom ? nozzleDia : stepY) {
        const scanlineBox: ClipperLib.Path = [
          { X: Math.round((minX - 10) * SCALE), Y: Math.round((y - 0.1) * SCALE) },
          { X: Math.round((maxX + 10) * SCALE), Y: Math.round((y - 0.1) * SCALE) },
          { X: Math.round((maxX + 10) * SCALE), Y: Math.round((y + 0.1) * SCALE) },
          { X: Math.round((minX - 10) * SCALE), Y: Math.round((y + 0.1) * SCALE) },
        ];

        const c = new ClipperLib.Clipper();
        c.AddPaths(innermostPaths, ClipperLib.PolyType.ptSubject, true);
        c.AddPath(scanlineBox, ClipperLib.PolyType.ptClip, true);

        const solution: ClipperLib.Paths = [];
        c.Execute(ClipperLib.ClipType.ctIntersection, solution);

        for (const opath of solution) {
          if (opath.length >= 2) {
            let pMinX = Infinity,
              pMaxX = -Infinity;
            for (const pt of opath) {
              const px = pt.X / SCALE;
              pMinX = Math.min(pMinX, px);
              pMaxX = Math.max(pMaxX, px);
            }

            const p1X = pMinX;
            const p1Y = y;
            const p2X = pMaxX;
            const p2Y = y;

            const p1: Vector3D = { x: p1X, y: p1Y, z: currentLayerZ };
            const p2: Vector3D = { x: p2X, y: p2Y, z: currentLayerZ };

            const dist = Math.hypot(p2X - p1X, p2Y - p1Y);
            if (dist > 0.3) {
              const filArea = Math.PI * Math.pow(settings.filament.diameter / 2, 2);
              const extE = (dist * nozzleDia * settings.layerHeight) / filArea;
              totalExtrusionMm += extE;

              gcodeLines.push(`G0 X${p1X.toFixed(3)} Y${p1Y.toFixed(3)} F${settings.travelSpeed * 60}`);
              gcodeLines.push(`G1 X${p2X.toFixed(3)} Y${p2Y.toFixed(3)} E${extE.toFixed(5)} F${settings.infillSpeed * 60}`);

              layerSegments.push({
                type: isTopOrBottom ? 'solid_infill' : 'infill',
                points: [p1, p2],
                extrusion: extE,
                feedrate: settings.infillSpeed * 60,
                layerIndex: l,
              });
            }
          }
        }
      }
    }

    layers.push({
      layerIndex: l,
      z: currentLayerZ,
      segments: layerSegments,
    });
  }

  // Footer G-Code
  gcodeLines.push(``);
  gcodeLines.push(`; --- END PRINT ---`);
  gcodeLines.push(`G1 E-2 F2400 ; retract`);
  gcodeLines.push(`G1 Z${(maxZ + 15).toFixed(2)} F${settings.travelSpeed * 60} ; lift nozzle`);
  gcodeLines.push(`G0 X0 Y${settings.bed.depth} F${settings.travelSpeed * 60} ; present bed`);
  gcodeLines.push(`M104 S0 ; turn off hotend`);
  gcodeLines.push(`M140 S0 ; turn off bed`);
  gcodeLines.push(`M84 ; disable motors`);

  const fullGCode = gcodeLines.join('\n');

  // Stats calculation
  const filamentRadiusCm = settings.filament.diameter / 10 / 2;
  const filamentCrossSectionCm2 = Math.PI * Math.pow(filamentRadiusCm, 2);
  const filamentLengthCm = totalExtrusionMm / 10;
  const volumeCm3 = filamentCrossSectionCm2 * filamentLengthCm;
  const gramsUsed = volumeCm3 * settings.filament.density;
  const metersUsed = totalExtrusionMm / 1000;
  const cost = (gramsUsed / 1000) * settings.filament.pricePerKg;

  const printTimeMinutes = numLayers * 0.3 + gramsUsed * 1.2;
  const printTimeSeconds = Math.round(printTimeMinutes * 60);

  onProgress?.(100, 'Slicing complete!');

  return {
    gcode: fullGCode,
    layers,
    stats: {
      totalLayers: numLayers,
      estimatedTimeSeconds: printTimeSeconds,
      filamentUsedMeters: parseFloat(metersUsed.toFixed(2)),
      filamentUsedGrams: parseFloat(gramsUsed.toFixed(1)),
      estimatedCost: parseFloat(cost.toFixed(2)),
      fileSizeBytes: fullGCode.length,
    },
  };
}

import type { GCodeLayer, GCodeSegment, GCodeFeatureType, Vector3D } from '../types/slicer';

/**
 * Robust Client-Side G-Code Parser for OrcaSlicer & PrusaSlicer Output.
 * Parses G0/G1 movements, layer Z transitions, and feature types (Walls, Infill, Supports).
 */
export function parseGCode(gcode: string): GCodeLayer[] {
  const lines = gcode.split('\n');
  const layersMap = new Map<number, GCodeSegment[]>();

  let currentZ = 0;
  let currentLayerIndex = 0;
  let currentFeature: GCodeFeatureType = 'outer_wall';

  let currentPos: Vector3D = { x: 0, y: 0, z: 0 };
  let currentFeedrate = 1200;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // 1. Check feature comments (;TYPE:...)
    if (rawLine.startsWith(';TYPE:')) {
      const typeStr = rawLine.substring(6).toLowerCase();
      if (typeStr.includes('external perimeter') || typeStr.includes('outer wall')) {
        currentFeature = 'outer_wall';
      } else if (typeStr.includes('perimeter') || typeStr.includes('inner wall') || typeStr.includes('contour')) {
        currentFeature = 'inner_wall';
      } else if (typeStr.includes('solid infill') || typeStr.includes('top solid') || typeStr.includes('skin')) {
        currentFeature = 'solid_infill';
      } else if (typeStr.includes('infill')) {
        currentFeature = 'infill';
      } else if (typeStr.includes('support')) {
        currentFeature = 'support';
      }
      continue;
    }

    // 2. Check Z comment line (e.g. ; Z:0.24 or ;0.24)
    if (rawLine.startsWith('; Z:') || rawLine.startsWith(';Z:')) {
      const val = parseFloat(rawLine.split(':')[1]);
      if (!isNaN(val)) {
        currentZ = val;
        currentPos.z = val;
      }
      continue;
    }

    // 3. Process G0 / G1 commands
    if (rawLine.startsWith('G0') || rawLine.startsWith('G1')) {
      const isG0 = rawLine.startsWith('G0');
      const parts = rawLine.split(/\s+/);

      let hasXYMove = false;
      let nextX = currentPos.x;
      let nextY = currentPos.y;
      let nextZ = currentPos.z;
      let extrusion = 0;
      let feedrate = currentFeedrate;

      for (let p = 1; p < parts.length; p++) {
        const part = parts[p];
        if (!part) continue;
        const code = part[0].toUpperCase();
        const val = parseFloat(part.substring(1));

        if (isNaN(val)) continue;

        if (code === 'X') {
          nextX = val;
          hasXYMove = true;
        } else if (code === 'Y') {
          nextY = val;
          hasXYMove = true;
        } else if (code === 'Z') {
          nextZ = val;
          currentZ = val;
        } else if (code === 'E') {
          extrusion = val;
        } else if (code === 'F') {
          feedrate = val;
          currentFeedrate = val;
        }
      }

      // Update current Z position
      currentPos.z = nextZ;

      // If no XY movement, skip adding segment (Z lift / travel prep)
      if (!hasXYMove) {
        continue;
      }

      const startPt: Vector3D = { ...currentPos };
      const endPt: Vector3D = { x: nextX, y: nextY, z: currentZ };

      // Update current XY position
      currentPos.x = nextX;
      currentPos.y = nextY;

      // Determine segment feature type
      const feature: GCodeFeatureType = isG0 || extrusion <= 0 ? 'travel' : currentFeature;

      const segment: GCodeSegment = {
        type: feature,
        points: [startPt, endPt],
        extrusion,
        feedrate,
        layerIndex: currentLayerIndex,
      };

      // Key segments by Z height rounded to 2 decimal places
      const keyZ = Math.round(currentZ * 100) / 100;
      if (!layersMap.has(keyZ)) {
        layersMap.set(keyZ, []);
      }
      layersMap.get(keyZ)!.push(segment);
    }
  }

  // Convert map to sorted GCodeLayer array
  const sortedHeights = Array.from(layersMap.keys()).sort((a, b) => a - b);
  const resultLayers: GCodeLayer[] = sortedHeights.map((z, idx) => ({
    layerIndex: idx,
    z,
    segments: layersMap.get(z)!,
  }));

  return resultLayers;
}

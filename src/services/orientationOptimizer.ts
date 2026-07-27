import * as THREE from 'three';

/**
 * Evaluates candidate orientations for a 3D model geometry to find
 * the rotation that maximizes build plate contact area and minimizes overhangs.
 */
export function findOptimalPrintOrientation(geometry: THREE.BufferGeometry): { x: number; y: number; z: number } {
  const cloned = geometry.clone();
  const posAttr = cloned.getAttribute('position');
  const indexAttr = cloned.getIndex();

  // Extract triangles
  const triangles: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]> = [];
  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i += 3) {
      const i0 = indexAttr.getX(i);
      const i1 = indexAttr.getX(i + 1);
      const i2 = indexAttr.getX(i + 2);
      triangles.push([
        new THREE.Vector3().fromBufferAttribute(posAttr, i0),
        new THREE.Vector3().fromBufferAttribute(posAttr, i1),
        new THREE.Vector3().fromBufferAttribute(posAttr, i2),
      ]);
    }
  } else {
    for (let i = 0; i < posAttr.count; i += 3) {
      triangles.push([
        new THREE.Vector3().fromBufferAttribute(posAttr, i),
        new THREE.Vector3().fromBufferAttribute(posAttr, i + 1),
        new THREE.Vector3().fromBufferAttribute(posAttr, i + 2),
      ]);
    }
  }

  // 6 principal orientation candidate rotations (Eulers in rad)
  const candidateRotations: Array<{ x: number; y: number; z: number }> = [
    { x: 0, y: 0, z: 0 },
    { x: Math.PI / 2, y: 0, z: 0 },
    { x: -Math.PI / 2, y: 0, z: 0 },
    { x: Math.PI, y: 0, z: 0 },
    { x: 0, y: Math.PI / 2, z: 0 },
    { x: 0, y: -Math.PI / 2, z: 0 },
  ];

  let bestScore = -Infinity;
  let bestRotation = { x: 0, y: 0, z: 0 };

  for (const rot of candidateRotations) {
    const euler = new THREE.Euler(rot.x, rot.y, rot.z);
    const matrix = new THREE.Matrix4().makeRotationFromEuler(euler);

    let minZ = Infinity;
    let maxZ = -Infinity;
    const transformedTriangles: Array<{ v0: THREE.Vector3; v1: THREE.Vector3; v2: THREE.Vector3; normal: THREE.Vector3; area: number }> = [];

    for (const [v0, v1, v2] of triangles) {
      const t0 = v0.clone().applyMatrix4(matrix);
      const t1 = v1.clone().applyMatrix4(matrix);
      const t2 = v2.clone().applyMatrix4(matrix);

      minZ = Math.min(minZ, t0.z, t1.z, t2.z);
      maxZ = Math.max(maxZ, t0.z, t1.z, t2.z);

      // Compute triangle normal & area
      const edge1 = new THREE.Vector3().subVectors(t1, t0);
      const edge2 = new THREE.Vector3().subVectors(t2, t0);
      const cross = new THREE.Vector3().crossVectors(edge1, edge2);
      const area = cross.length() * 0.5;
      const normal = cross.normalize();

      transformedTriangles.push({ v0: t0, v1: t1, v2: t2, normal, area });
    }

    let baseContactArea = 0;
    let overhangArea = 0;

    for (const tri of transformedTriangles) {
      // Base contact: triangles near minZ with normal pointing straight down (-Z)
      const avgZ = (tri.v0.z + tri.v1.z + tri.v2.z) / 3;
      if (Math.abs(avgZ - minZ) < 1.0 && tri.normal.z < -0.7) {
        baseContactArea += tri.area;
      } else if (tri.normal.z < -0.5) {
        // Overhang: normals pointing downward
        overhangArea += tri.area;
      }
    }

    // Score = Contact Area minus weighted Overhang Area
    const score = baseContactArea * 3.0 - overhangArea * 1.5 - (maxZ - minZ) * 0.1;

    if (score > bestScore) {
      bestScore = score;
      bestRotation = rot;
    }
  }

  return bestRotation;
}

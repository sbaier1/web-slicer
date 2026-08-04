import * as THREE from 'three';
import { STLLoader, OBJLoader, ThreeMFLoader } from 'three-stdlib';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Extracts and merges all THREE.Mesh geometries from an Object3D/Group into a single BufferGeometry.
 */
export function extractGeometryFromObject(object: THREE.Object3D): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  object.updateMatrixWorld(true);
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        const clonedGeo = mesh.geometry.clone();
        mesh.updateMatrixWorld(true);
        clonedGeo.applyMatrix4(mesh.matrixWorld);
        geometries.push(clonedGeo);
      }
    }
  });

  if (geometries.length === 0) {
    throw new Error('No 3D mesh geometry found in model file.');
  }

  if (geometries.length === 1) {
    return geometries[0];
  }

  const merged = mergeGeometries(geometries, false);
  if (!merged) {
    throw new Error('Failed to merge 3D mesh geometries.');
  }
  return merged;
}

/**
 * Parses STL, OBJ, or 3MF model files from ArrayBuffer.
 */
export function parseModelGeometry(buffer: ArrayBuffer, fileName: string): THREE.BufferGeometry {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'stl';

  let geometry: THREE.BufferGeometry;

  if (ext === 'obj') {
    const text = new TextDecoder().decode(buffer);
    const loader = new OBJLoader();
    const group = loader.parse(text);
    geometry = extractGeometryFromObject(group);
  } else if (ext === '3mf') {
    const loader = new ThreeMFLoader();
    const group = loader.parse(buffer);
    geometry = extractGeometryFromObject(group);
  } else {
    // Default to STL
    const loader = new STLLoader();
    geometry = loader.parse(buffer);
  }

  if (!geometry.getAttribute('normal')) {
    geometry.computeVertexNormals();
  }

  geometry.center();
  geometry.computeBoundingBox();

  const bb = geometry.boundingBox!;
  const sizeZ = bb.max.z - bb.min.z;
  geometry.translate(0, 0, sizeZ / 2);

  return geometry;
}

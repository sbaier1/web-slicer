import * as THREE from 'three';
import { OBJLoader } from 'three-stdlib';
import { extractGeometryFromObject } from './modelLoader';

/**
 * Generates built-in sample 3D geometries for instant testing & slicing
 */
export function createCalibrationCubeGeometry(): THREE.BufferGeometry {
  // 20mm x 20mm x 20mm Calibration Cube
  const geometry = new THREE.BoxGeometry(20, 20, 20);
  geometry.translate(0, 0, 10); // Sit on bed
  return geometry;
}

export function createLowPolyBunnyGeometry(): THREE.BufferGeometry {
  // A stylized low-poly pyramid / bunny shape with overhangs & details for testing slicing
  const geometry = new THREE.ConeGeometry(15, 30, 8);
  geometry.rotateX(Math.PI / 2); // Rotate to face up
  geometry.translate(0, 0, 15);
  return geometry;
}

export function createGearGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const numTeeth = 12;
  const outerRadius = 25;
  const innerRadius = 18;
  const holeRadius = 6;

  for (let i = 0; i < numTeeth; i++) {
    const angle1 = (i / numTeeth) * Math.PI * 2;
    const angle2 = ((i + 0.3) / numTeeth) * Math.PI * 2;
    const angle3 = ((i + 0.5) / numTeeth) * Math.PI * 2;
    const angle4 = ((i + 0.8) / numTeeth) * Math.PI * 2;

    if (i === 0) {
      shape.moveTo(Math.cos(angle1) * innerRadius, Math.sin(angle1) * innerRadius);
    } else {
      shape.lineTo(Math.cos(angle1) * innerRadius, Math.sin(angle1) * innerRadius);
    }

    shape.lineTo(Math.cos(angle2) * outerRadius, Math.sin(angle2) * outerRadius);
    shape.lineTo(Math.cos(angle3) * outerRadius, Math.sin(angle3) * outerRadius);
    shape.lineTo(Math.cos(angle4) * innerRadius, Math.sin(angle4) * innerRadius);
  }

  // Center hole
  const holePath = new THREE.Path();
  holePath.absarc(0, 0, holeRadius, 0, Math.PI * 2, true);
  shape.holes.push(holePath);

  const extrudeSettings = {
    steps: 1,
    depth: 10,
    bevelEnabled: true,
    bevelThickness: 1,
    bevelSize: 1,
    bevelOffset: 0,
    bevelSegments: 3,
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.rotateX(-Math.PI / 2); // Sit upright on XY plane
  geometry.center();
  geometry.translate(0, 0, 6);
  return geometry;
}

export function createOBJPyramidGeometry(): THREE.BufferGeometry {
  const objText = `
# OBJ Sample Pyramid
v -15 -15 0
v 15 -15 0
v 15 15 0
v -15 15 0
v 0 0 25
f 1 2 5
f 2 3 5
f 3 4 5
f 4 1 5
f 4 3 2 1
`;
  const loader = new OBJLoader();
  const group = loader.parse(objText);
  const geo = extractGeometryFromObject(group);
  if (!geo.getAttribute('normal')) {
    geo.computeVertexNormals();
  }
  geo.center();
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  geo.translate(0, 0, (bb.max.z - bb.min.z) / 2);
  return geo;
}

export const SAMPLE_MODELS = [
  {
    id: 'calibration-cube',
    name: '20mm Calibration Cube',
    description: 'Standard 20x20x20mm test print cube',
    generator: createCalibrationCubeGeometry,
  },
  {
    id: 'mechanical-gear',
    name: 'Mechanical Gear (12T)',
    description: 'Precision mechanical gear with center bore',
    generator: createGearGeometry,
  },
  {
    id: 'test-pyramid',
    name: 'Low Poly Test Cone',
    description: 'Quick test object with overhangs',
    generator: createLowPolyBunnyGeometry,
  },
  {
    id: 'obj-pyramid',
    name: 'OBJ Sample Pyramid',
    description: '3D object parsed from Wavefront OBJ format',
    generator: createOBJPyramidGeometry,
  },
];

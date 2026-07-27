import React from 'react';
import * as THREE from 'three';
import type { PrinterBed } from '../../types/slicer';

interface BedGridProps {
  bed: PrinterBed;
}

export const BedGrid: React.FC<BedGridProps> = ({ bed }) => {
  const { width, depth, height } = bed;

  const centerX = width / 2;
  const centerY = depth / 2;

  const gridDivisions = Math.max(width, depth) / 10;

  return (
    <group position={[0, 0, 0]}>
      {/* Bed Base Plate centered at (centerX, centerY) */}
      <mesh position={[centerX, centerY, -0.5]} receiveShadow>
        <boxGeometry args={[width, depth, 1]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Bed Surface Grid centered at (centerX, centerY) */}
      <gridHelper
        args={[Math.max(width, depth), gridDivisions, '#3b82f6', '#334155']}
        rotation={[Math.PI / 2, 0, 0]}
        position={[centerX, centerY, 0.05]}
      />

      {/* Bed Outer Border Line */}
      <lineSegments position={[centerX, centerY, 0.1]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(width, depth)]} />
        <lineBasicMaterial color="#60a5fa" linewidth={2} />
      </lineSegments>

      {/* Build Volume Bounding Wireframe Box */}
      <lineSegments position={[centerX, centerY, height / 2]}>
        <edgesGeometry args={[new THREE.BoxGeometry(width, depth, height)]} />
        <lineDashedMaterial color="#475569" dashSize={5} gapSize={5} transparent opacity={0.4} />
      </lineSegments>

      {/* Axis Indicator at Origin (Front-Left Corner 0,0,0) */}
      <group position={[0, 0, 0.2]}>
        {/* X-axis (Red) */}
        <arrowHelper args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 25, 0xef4444, 5, 3]} />
        {/* Y-axis (Green) */}
        <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 25, 0x22c55e, 5, 3]} />
        {/* Z-axis (Blue) */}
        <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 25, 0x3b82f6, 5, 3]} />
      </group>
    </group>
  );
};

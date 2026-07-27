import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import type { Model3D } from '../../types/slicer';

interface ModelMeshProps {
  model: Model3D;
  isSelected: boolean;
  onSelect: (modelId: string) => void;
  wireframe?: boolean;
}

export const ModelMesh: React.FC<ModelMeshProps> = ({ model, isSelected, onSelect, wireframe = false }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const { position, rotation, scale, color = '#3b82f6' } = model;

  // Calculate Z offset to ground lowest vertex of rotated/scaled model at Z=0
  const zOffset = useMemo(() => {
    const cloned = model.geometry.clone();
    const scaleMatrix = new THREE.Matrix4().makeScale(scale.x, scale.y, scale.z);
    const rotMatrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rotation.x, rotation.y, rotation.z));
    const matrix = new THREE.Matrix4().multiplyMatrices(scaleMatrix, rotMatrix);

    cloned.applyMatrix4(matrix);
    cloned.computeBoundingBox();
    return cloned.boundingBox ? -cloned.boundingBox.min.z : 0;
  }, [model.geometry, rotation.x, rotation.y, rotation.z, scale.x, scale.y, scale.z]);

  return (
    <group
      position={[position.x, position.y, position.z + zOffset]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      scale={[scale.x, scale.y, scale.z]}
    >
      {/* 3D Mesh */}
      <mesh
        ref={meshRef}
        geometry={model.geometry}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect(model.id);
        }}
      >
        <meshStandardMaterial
          color={isSelected ? '#38bdf8' : color}
          roughness={0.3}
          metalness={0.1}
          wireframe={wireframe}
          emissive={isSelected ? '#0284c7' : '#000000'}
          emissiveIntensity={isSelected ? 0.2 : 0}
        />
      </mesh>

      {/* Selection Bounding Box */}
      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(model.originalSize.x, model.originalSize.y, model.originalSize.z)]} />
          <lineBasicMaterial color="#00f0ff" linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
};

import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { GCodeLayer, GCodeFeatureType } from '../../types/slicer';

interface GCodeVisualizerProps {
  layers: GCodeLayer[];
  visibleLayerIndex: number; // Max layer to display (scrubber)
  showAllLayers?: boolean;
}

const FEATURE_COLORS: Record<GCodeFeatureType, string> = {
  outer_wall: '#ef4444', // Red
  inner_wall: '#22c55e', // Green
  solid_infill: '#eab308', // Yellow
  infill: '#f97316', // Orange
  support: '#06b6d4', // Cyan
  travel: '#3b82f6', // Blue
  first_layer: '#a855f7', // Purple
};

export const GCodeVisualizer: React.FC<GCodeVisualizerProps> = ({ layers, visibleLayerIndex, showAllLayers = false }) => {
  // Filter layers to show based on layer slider scrubber
  const displayedLayers = useMemo(() => {
    if (showAllLayers) return layers;
    return layers.slice(0, Math.min(visibleLayerIndex + 1, layers.length));
  }, [layers, visibleLayerIndex, showAllLayers]);

  // Build Three.js LineSegments geometries for each feature type
  const featureGeometries = useMemo(() => {
    const pointsByFeature: Record<GCodeFeatureType, number[]> = {
      outer_wall: [],
      inner_wall: [],
      solid_infill: [],
      infill: [],
      support: [],
      travel: [],
      first_layer: [],
    };

    for (const layer of displayedLayers) {
      for (const segment of layer.segments) {
        const feat = segment.type;
        const [p1, p2] = segment.points;

        pointsByFeature[feat].push(p1.x, p1.y, p1.z);
        pointsByFeature[feat].push(p2.x, p2.y, p2.z);
      }
    }

    const result: Array<{ feature: GCodeFeatureType; geometry: THREE.BufferGeometry; color: string }> = [];

    (Object.keys(pointsByFeature) as GCodeFeatureType[]).forEach((feat) => {
      const coords = pointsByFeature[feat];
      if (coords.length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
        result.push({
          feature: feat,
          geometry: geo,
          color: FEATURE_COLORS[feat],
        });
      }
    });

    return result;
  }, [displayedLayers]);

  return (
    <group position={[0, 0, 0]}>
      {featureGeometries.map(({ feature, geometry, color }) => (
        <lineSegments key={feature} geometry={geometry}>
          <lineBasicMaterial
            color={color}
            linewidth={feature === 'outer_wall' ? 2 : 1}
            transparent={feature === 'travel'}
            opacity={feature === 'travel' ? 0.3 : 1.0}
          />
        </lineSegments>
      ))}
    </group>
  );
};

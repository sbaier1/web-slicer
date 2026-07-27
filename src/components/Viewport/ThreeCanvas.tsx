import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, TransformControls } from '@react-three/drei';
import type { Model3D, PrinterBed, GCodeLayer } from '../../types/slicer';
import { BedGrid } from './BedGrid';
import { ModelMesh } from './ModelMesh';
import { GCodeVisualizer } from './GCodeVisualizer';

interface ThreeCanvasProps {
  models: Model3D[];
  selectedModelId: string | null;
  onSelectModel: (id: string) => void;
  onUpdateModelTransform: (id: string, updated: Partial<Model3D>) => void;
  bed: PrinterBed;
  wireframe: boolean;
  activeTool: 'select' | 'move' | 'rotate' | 'scale';
  mode: 'prepare' | 'preview';
  gcodeLayers: GCodeLayer[];
  visibleLayerIndex: number;
}

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  onUpdateModelTransform,
  bed,
  wireframe,
  activeTool,
  mode,
  gcodeLayers,
  visibleLayerIndex,
}) => {
  const selectedModel = models.find((m) => m.id === selectedModelId);
  const bedCenterX = bed.width / 2;
  const bedCenterY = bed.depth / 2;

  // Map active tool to TransformControls mode
  const transformMode = activeTool === 'rotate' ? 'rotate' : activeTool === 'scale' ? 'scale' : 'translate';

  return (
    <div className="w-full h-full relative bg-slate-950 overflow-hidden">
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            onSelectModel('');
          }
        }}
      >
        <PerspectiveCamera
          makeDefault
          position={[bedCenterX + bed.width * 0.7, bedCenterY - bed.depth * 1.1, bed.height * 0.9]}
          up={[0, 0, 1]}
          fov={45}
        />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2 - 0.01}
          minDistance={10}
          maxDistance={1200}
          target={[bedCenterX, bedCenterY, bed.height * 0.15]}
        />

        {/* Ambient & Directional Studio Lights */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[bed.width * 1.5, -bed.depth * 0.5, bed.height * 2]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-bed.width, bed.depth * 1.5, bed.height]} intensity={0.5} />
        <pointLight position={[bedCenterX, bedCenterY, bed.height + 100]} intensity={0.8} />

        <Suspense fallback={null}>
          {/* 3D Printer Bed Grid */}
          <BedGrid bed={bed} />

          {/* Mode 1: Prepare (Render 3D Models) */}
          {mode === 'prepare' && (
            <>
              {models.map((model) => (
                <ModelMesh
                  key={model.id}
                  model={model}
                  isSelected={model.id === selectedModelId}
                  onSelect={onSelectModel}
                  wireframe={wireframe}
                />
              ))}

              {/* 3D Interactive Transform Handles Gizmo */}
              {selectedModel && (
                <TransformControls
                  position={[selectedModel.position.x, selectedModel.position.y, selectedModel.position.z]}
                  rotation={[selectedModel.rotation.x, selectedModel.rotation.y, selectedModel.rotation.z]}
                  scale={[selectedModel.scale.x, selectedModel.scale.y, selectedModel.scale.z]}
                  mode={transformMode}
                  size={0.75}
                  space="world"
                  onChange={(e?: any) => {
                    if (e && e.target && e.target.object) {
                      const obj = e.target.object;
                      const newZ = Math.max(0, obj.position.z);
                      onUpdateModelTransform(selectedModel.id, {
                        position: { x: obj.position.x, y: obj.position.y, z: newZ },
                        rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
                        scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
                      });
                    }
                  }}
                />
              )}
            </>
          )}

          {/* Mode 2: Preview (Render Sliced G-Code Toolpath Layers) */}
          {mode === 'preview' && <GCodeVisualizer layers={gcodeLayers} visibleLayerIndex={visibleLayerIndex} />}

          <Environment preset="city" />
        </Suspense>
      </Canvas>

      {/* Empty State Overlay */}
      {mode === 'prepare' && models.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div className="text-center bg-slate-900/70 backdrop-blur-md border border-slate-800 p-8 rounded-2xl max-w-sm shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold mb-1">Build Plate is Empty</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Drag & drop STL or 3MF files anywhere, or click <span className="text-blue-400 font-medium">Add Model</span> / <span className="text-blue-400 font-medium">Samples</span> in the header to get started!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

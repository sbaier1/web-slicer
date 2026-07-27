import React from 'react';
import type { Model3D } from '../../types/slicer';
import { Move, RotateCw, Maximize2, RefreshCw, Anchor } from 'lucide-react';

interface ModelTransformPanelProps {
  model: Model3D;
  onUpdateTransform: (updated: Partial<Model3D>) => void;
}

export const ModelTransformPanel: React.FC<ModelTransformPanelProps> = ({ model, onUpdateTransform }) => {
  const rotateAxis = (axis: 'x' | 'y' | 'z', degrees: number) => {
    const rad = (degrees * Math.PI) / 180;
    onUpdateTransform({
      rotation: {
        ...model.rotation,
        [axis]: (model.rotation[axis] + rad) % (Math.PI * 2),
      },
    });
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 text-xs shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="font-semibold text-slate-200 flex items-center gap-2">
          <Move className="w-3.5 h-3.5 text-blue-400" />
          {model.name}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          {(model.fileSize / 1024).toFixed(0)} KB
        </span>
      </div>

      {/* Position (mm) */}
      <div className="space-y-1.5">
        <label className="text-slate-400 font-medium flex items-center gap-1.5">
          <Move className="w-3 h-3 text-slate-500" /> Position (mm)
        </label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="text-[10px] text-red-400 font-mono font-bold">X</span>
            <input
              type="number"
              value={Math.round(model.position.x * 10) / 10}
              onChange={(e) =>
                onUpdateTransform({
                  position: { ...model.position, x: parseFloat(e.target.value) || 0 },
                })
              }
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <span className="text-[10px] text-green-400 font-mono font-bold">Y</span>
            <input
              type="number"
              value={Math.round(model.position.y * 10) / 10}
              onChange={(e) =>
                onUpdateTransform({
                  position: { ...model.position, y: parseFloat(e.target.value) || 0 },
                })
              }
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <span className="text-[10px] text-blue-400 font-mono font-bold">Z</span>
            <input
              type="number"
              value={Math.round(model.position.z * 10) / 10}
              onChange={(e) =>
                onUpdateTransform({
                  position: { ...model.position, z: Math.max(0, parseFloat(e.target.value) || 0) },
                })
              }
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Rotation (deg) + 90° Quick Rotate Buttons */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-slate-400 font-medium flex items-center gap-1.5">
            <RotateCw className="w-3 h-3 text-slate-500" /> Rotation (°)
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="text-[10px] text-red-400 font-mono font-bold">X</span>
            <input
              type="number"
              value={Math.round((model.rotation.x * 180) / Math.PI)}
              onChange={(e) => {
                const deg = parseFloat(e.target.value) || 0;
                onUpdateTransform({
                  rotation: { ...model.rotation, x: (deg * Math.PI) / 180 },
                });
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <span className="text-[10px] text-green-400 font-mono font-bold">Y</span>
            <input
              type="number"
              value={Math.round((model.rotation.y * 180) / Math.PI)}
              onChange={(e) => {
                const deg = parseFloat(e.target.value) || 0;
                onUpdateTransform({
                  rotation: { ...model.rotation, y: (deg * Math.PI) / 180 },
                });
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <span className="text-[10px] text-blue-400 font-mono font-bold">Z</span>
            <input
              type="number"
              value={Math.round((model.rotation.z * 180) / Math.PI)}
              onChange={(e) => {
                const deg = parseFloat(e.target.value) || 0;
                onUpdateTransform({
                  rotation: { ...model.rotation, z: (deg * Math.PI) / 180 },
                });
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Quick +90° rotation buttons per axis */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <button
            onClick={() => rotateAxis('x', 90)}
            className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-[10px] text-red-300 font-mono font-semibold"
          >
            +90° X
          </button>
          <button
            onClick={() => rotateAxis('y', 90)}
            className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-[10px] text-green-300 font-mono font-semibold"
          >
            +90° Y
          </button>
          <button
            onClick={() => rotateAxis('z', 90)}
            className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-[10px] text-blue-300 font-mono font-semibold"
          >
            +90° Z
          </button>
        </div>
      </div>

      {/* Scale (%) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-slate-400 font-medium flex items-center gap-1.5">
            <Maximize2 className="w-3 h-3 text-slate-500" /> Scale Factor (%)
          </label>
          <button
            onClick={() => onUpdateTransform({ scale: { x: 1, y: 1, z: 1 } })}
            className="text-[10px] text-slate-400 hover:text-blue-400 flex items-center gap-1 font-medium"
          >
            <RefreshCw className="w-2.5 h-2.5" /> 100%
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="text-[10px] text-red-400 font-mono font-bold">X</span>
            <input
              type="number"
              value={Math.round(model.scale.x * 100)}
              onChange={(e) => {
                const pct = (parseFloat(e.target.value) || 100) / 100;
                onUpdateTransform({
                  scale: { x: pct, y: pct, z: pct },
                });
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <span className="text-[10px] text-green-400 font-mono font-bold">Y</span>
            <input
              type="number"
              value={Math.round(model.scale.y * 100)}
              onChange={(e) => {
                const pct = (parseFloat(e.target.value) || 100) / 100;
                onUpdateTransform({
                  scale: { x: pct, y: pct, z: pct },
                });
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <span className="text-[10px] text-blue-400 font-mono font-bold">Z</span>
            <input
              type="number"
              value={Math.round(model.scale.z * 100)}
              onChange={(e) => {
                const pct = (parseFloat(e.target.value) || 100) / 100;
                onUpdateTransform({
                  scale: { x: pct, y: pct, z: pct },
                });
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Snap to Bed Button */}
      <button
        onClick={() => onUpdateTransform({ position: { ...model.position, z: 0 } })}
        className="w-full py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 hover:text-white font-semibold flex items-center justify-center gap-1.5 transition-all text-xs"
      >
        <Anchor className="w-3.5 h-3.5 text-blue-400" />
        Snap Model to Bed Z=0
      </button>
    </div>
  );
};

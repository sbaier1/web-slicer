import React from 'react';
import {
  Move,
  RotateCw,
  Maximize2,
  Layers,
  Trash2,
  Copy,
  AlignCenter,
  Eye,
  Grid,
  Sparkles,
  Anchor,
  Compass,
} from 'lucide-react';

interface ViewportToolbarProps {
  activeTool: 'select' | 'move' | 'rotate' | 'scale';
  onSelectTool: (tool: 'select' | 'move' | 'rotate' | 'scale') => void;
  onCenterModel: () => void;
  onSnapToBed: () => void;
  onAutoOrient: () => void;
  onLayFlat: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAutoArrange: () => void;
  wireframe: boolean;
  onToggleWireframe: () => void;
  hasSelection: boolean;
  mode: 'prepare' | 'preview';
  onToggleMode: (mode: 'prepare' | 'preview') => void;
  hasGCode: boolean;
}

export const ViewportToolbar: React.FC<ViewportToolbarProps> = ({
  activeTool,
  onSelectTool,
  onCenterModel,
  onSnapToBed,
  onAutoOrient,
  onLayFlat,
  onDuplicate,
  onDelete,
  onAutoArrange,
  wireframe,
  onToggleWireframe,
  hasSelection,
  mode,
  onToggleMode,
  hasGCode,
}) => {
  return (
    <div className="absolute top-4 left-4 z-30 flex flex-col gap-2 pointer-events-auto">
      {/* View Mode Toggle: Prepare (3D Models) vs Preview (G-Code Toolpaths) */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1 flex gap-1 shadow-2xl">
        <button
          onClick={() => onToggleMode('prepare')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mode === 'prepare' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Prepare (3D)
        </button>
        <button
          onClick={() => onToggleMode('preview')}
          disabled={!hasGCode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mode === 'preview'
              ? 'bg-blue-600 text-white shadow-md'
              : hasGCode
              ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              : 'text-slate-600 cursor-not-allowed opacity-50'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          Preview (G-Code)
        </button>
      </div>

      {/* Model Manipulator Tools (Prepare mode) */}
      {mode === 'prepare' && (
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-2 flex flex-col gap-1.5 shadow-2xl w-52">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1 pb-1 border-b border-slate-800">
            3D Model Tools
          </span>

          <button
            onClick={() => onSelectTool('move')}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTool === 'move' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Move className="w-3.5 h-3.5 text-blue-400" />
            <span>Move (X/Y/Z)</span>
          </button>

          <button
            onClick={() => onSelectTool('rotate')}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTool === 'rotate' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
            <span>Rotate (°)</span>
          </button>

          <button
            onClick={() => onSelectTool('scale')}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTool === 'scale' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Scale (%)</span>
          </button>

          <div className="h-px bg-slate-800 my-1" />

          {/* SNAP TO BED Z=0 (Highlighted Prominently) */}
          <button
            onClick={onSnapToBed}
            disabled={!hasSelection}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-300 hover:text-white bg-blue-500/10 hover:bg-blue-600/30 border border-blue-500/30 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          >
            <Anchor className="w-3.5 h-3.5 text-blue-400" />
            <span>Snap Model to Bed Z=0</span>
          </button>

          {/* AUTO-ORIENT FOR MINIMAL OVERHANGS */}
          <button
            onClick={onAutoOrient}
            disabled={!hasSelection}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-600/30 border border-amber-500/30 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Auto-Orient (Min. Overhang)</span>
          </button>

          <button
            onClick={onLayFlat}
            disabled={!hasSelection}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Lay Flat</span>
          </button>

          <button
            onClick={onCenterModel}
            disabled={!hasSelection}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          >
            <AlignCenter className="w-3.5 h-3.5 text-cyan-400" />
            <span>Center on Bed</span>
          </button>

          {/* SMART AUTO-ARRANGE & ORIENT */}
          <button
            onClick={onAutoArrange}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
          >
            <Grid className="w-3.5 h-3.5 text-violet-400" />
            <span>Auto-Orient & Arrange</span>
          </button>

          <button
            onClick={onDuplicate}
            disabled={!hasSelection}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          >
            <Copy className="w-3.5 h-3.5 text-blue-400" />
            <span>Duplicate</span>
          </button>

          <button
            onClick={onDelete}
            disabled={!hasSelection}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/20 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>

          <div className="h-px bg-slate-800 my-1" />

          <button
            onClick={onToggleWireframe}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              wireframe ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Wireframe Mode</span>
          </button>
        </div>
      )}
    </div>
  );
};

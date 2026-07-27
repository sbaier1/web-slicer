import React, { useState, useEffect } from 'react';
import type { SlicedResult } from '../../types/slicer';
import { Play, Pause, Clock, Weight, DollarSign, FileText } from 'lucide-react';

interface GCodeLayerSliderProps {
  slicedResult: SlicedResult;
  visibleLayerIndex: number;
  onChangeVisibleLayer: (layerIdx: number | ((prev: number) => number)) => void;
}

export const GCodeLayerSlider: React.FC<GCodeLayerSliderProps> = ({
  slicedResult,
  visibleLayerIndex,
  onChangeVisibleLayer,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const { stats, layers } = slicedResult;
  const maxLayer = Math.max(0, layers.length - 1);

  // Auto-play layer slider animation
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        onChangeVisibleLayer((prev: number) => {
          if (prev >= maxLayer) {
            setIsPlaying(false);
            return maxLayer;
          }
          return prev + 1;
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isPlaying, maxLayer, onChangeVisibleLayer]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const currentZ = layers[visibleLayerIndex]?.z || 0;

  return (
    <div className="absolute right-4 top-4 bottom-4 z-10 flex gap-3 pointer-events-none">
      {/* Sliced Stats Panel (Bottom-right float) */}
      <div className="self-end bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl pointer-events-auto text-xs space-y-3 w-64">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-emerald-400" /> Sliced Print Summary
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono">
          <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block font-sans">Print Time</span>
            <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatTime(stats.estimatedTimeSeconds)}
            </span>
          </div>

          <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block font-sans">Filament Weight</span>
            <span className="text-amber-400 font-bold text-xs flex items-center gap-1">
              <Weight className="w-3 h-3" /> {stats.filamentUsedGrams} g
            </span>
          </div>

          <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block font-sans">Total Length</span>
            <span className="text-blue-400 font-bold text-xs">{stats.filamentUsedMeters} m</span>
          </div>

          <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block font-sans">Est. Cost</span>
            <span className="text-slate-200 font-bold text-xs flex items-center gap-0.5">
              <DollarSign className="w-3 h-3 text-slate-400" /> {stats.estimatedCost.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Feature Color Legend */}
        <div className="border-t border-slate-800/80 pt-2 space-y-1 text-[10px]">
          <span className="text-slate-400 font-semibold uppercase tracking-wider block">Toolpath Color Legend</span>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-medium">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Outer Wall
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Inner Wall
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Solid Infill
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Infill
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Support
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Travel
            </span>
          </div>
        </div>
      </div>

      {/* Vertical Layer Scrubber Slider */}
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-3 shadow-2xl pointer-events-auto flex flex-col items-center gap-3">
        <div className="text-center font-mono text-[11px]">
          <span className="text-slate-400 block text-[9px] uppercase font-bold">Layer</span>
          <span className="text-blue-400 font-extrabold text-sm">
            {visibleLayerIndex + 1}/{stats.totalLayers}
          </span>
          <span className="text-slate-500 block text-[9px] mt-0.5">{currentZ.toFixed(2)}mm</span>
        </div>

        {/* Vertical Range Slider */}
        <div className="flex-1 flex items-center my-1">
          <input
            type="range"
            min="0"
            max={maxLayer}
            value={visibleLayerIndex}
            onChange={(e) => onChangeVisibleLayer(parseInt(e.target.value))}
            className="h-48 accent-blue-500 cursor-pointer"
            style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
          />
        </div>

        {/* Play / Pause Toggle */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition-all"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
      </div>
    </div>
  );
};

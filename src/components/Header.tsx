import React, { useRef } from 'react';
import {
  Upload,
  Play,
  Download,
  Send,
  Boxes,
  Cpu,
  Server,
  Loader2,
  Sparkles,
  ChevronDown,
  Package,
} from 'lucide-react';
import type { SlicerEngineType } from '../types/slicer';
import { SAMPLE_MODELS } from '../services/sampleModels';

interface HeaderProps {
  onFileUpload: (file: File) => void;
  onSelectSampleModel: (sampleId: string) => void;
  onSlice: () => void;
  isSlicing: boolean;
  slicingProgress: number;
  slicingStepMessage?: string;
  hasGCode: boolean;
  onExportGCode: () => void;
  onExportUFP: () => void;
  onOpenPrinterModal: () => void;
  engineType: SlicerEngineType;
  modelCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onFileUpload,
  onSelectSampleModel,
  onSlice,
  isSlicing,
  slicingProgress,
  hasGCode,
  onExportGCode,
  onExportUFP,
  onOpenPrinterModal,
  engineType,
  modelCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSamplesMenu, setShowSamplesMenu] = React.useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between text-xs select-none z-20 relative">
      {/* Left: Branding & Engine Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-extrabold shadow-lg shadow-blue-500/20">
            <Boxes className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-100 text-sm tracking-tight flex items-center gap-1.5">
              OrcaWeb <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">v1.0</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Browser 3D Printer Slicer</p>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        {/* Engine Badge */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300">
          {engineType === 'browser-wasm' ? (
            <>
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-semibold text-[11px]">WASM Local Engine</span>
            </>
          ) : (
            <>
              <Server className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold text-[11px]">OrcaSlicer API</span>
            </>
          )}
        </div>
      </div>

      {/* Middle: File Upload & Sample Models */}
      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".stl,.3mf,.obj"
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 font-semibold flex items-center gap-1.5 transition-all shadow-sm"
        >
          <Upload className="w-3.5 h-3.5 text-blue-400" />
          Add Model (STL/OBJ/3MF)
        </button>

        {/* Sample Models Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSamplesMenu(!showSamplesMenu)}
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 font-semibold flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Samples
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showSamplesMenu && (
            <div className="absolute top-full left-0 mt-1 w-52 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1 z-30 animate-in fade-in">
              {SAMPLE_MODELS.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => {
                    onSelectSampleModel(sample.id);
                    setShowSamplesMenu(false);
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-slate-800/80 transition-all text-xs"
                >
                  <span className="font-semibold text-slate-200 block mb-0.5">{sample.name}</span>
                  <span className="text-[10px] text-slate-400 block">{sample.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Slice Action & Printer Dispatch */}
      <div className="flex items-center gap-2">
        {/* SLICE BUTTON */}
        <button
          onClick={onSlice}
          disabled={isSlicing || modelCount === 0}
          className={`px-4 py-1.5 rounded-lg font-extrabold flex items-center gap-2 transition-all shadow-lg text-xs ${
            isSlicing
              ? 'bg-blue-600/50 text-white cursor-wait'
              : modelCount > 0
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {isSlicing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              Slicing {slicingProgress}%...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 text-white fill-white" />
              SLICE NOW
            </>
          )}
        </button>

        {/* Export G-Code */}
        <button
          onClick={onExportGCode}
          disabled={!hasGCode}
          className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all ${
            hasGCode
              ? 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700'
              : 'bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed opacity-50'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          Export .gcode
        </button>

        {/* Export UFP (Ultimaker Format Package with Fluidd Thumbnail) */}
        <button
          onClick={onExportUFP}
          disabled={!hasGCode}
          className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all ${
            hasGCode
              ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/20'
              : 'bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed opacity-50'
          }`}
        >
          <Package className="w-3.5 h-3.5 text-emerald-400" />
          Export .ufp
        </button>

        {/* Send to 3D Printer */}
        <button
          onClick={onOpenPrinterModal}
          disabled={!hasGCode}
          className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all ${
            hasGCode
              ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
              : 'bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed opacity-50'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          Print
        </button>
      </div>

      {/* Slicing Progress Bar Overlay */}
      {isSlicing && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-950 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-200"
            style={{ width: `${slicingProgress}%` }}
          />
        </div>
      )}
    </header>
  );
};

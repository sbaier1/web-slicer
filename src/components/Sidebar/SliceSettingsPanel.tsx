import React, { useState, useRef } from 'react';
import type {
  SlicerSettings,
  InfillPattern,
  SlicerEngineType,
  RemoteSlicerConfig,
} from '../../types/slicer';
import { PRINTER_PRESETS, FILAMENT_PRESETS } from '../../constants/presets';
import {
  Printer,
  Flame,
  Sliders,
  Shield,
  Layers,
  Server,
  Cpu,
  Code,
  Download,
  Upload,
} from 'lucide-react';

interface SliceSettingsPanelProps {
  settings: SlicerSettings;
  onUpdateSettings: (updated: Partial<SlicerSettings>) => void;
  engineType: SlicerEngineType;
  onSelectEngine: (engine: SlicerEngineType) => void;
  remoteConfig: RemoteSlicerConfig;
  onUpdateRemoteConfig: (cfg: Partial<RemoteSlicerConfig>) => void;
}

export const SliceSettingsPanel: React.FC<SliceSettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  engineType,
  onSelectEngine,
  remoteConfig,
  onUpdateRemoteConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'preset' | 'quality' | 'infill' | 'supports' | 'speed' | 'engine'>('preset');

  // Resizable sidebar width state
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('orcaweb_sidebar_width');
      if (saved) return Math.max(300, Math.min(600, parseInt(saved, 10)));
    } catch {}
    return 360;
  });

  const isResizingRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = window.innerWidth - moveEvent.clientX;
      const clamped = Math.max(300, Math.min(600, newWidth));
      setSidebarWidth(clamped);
      try {
        localStorage.setItem('orcaweb_sidebar_width', clamped.toString());
      } catch {}
    };

    const onMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleExportProfile = () => {
    let printerConnection = null;
    let startPrint = true;
    try {
      const savedConn = localStorage.getItem('orcaweb_printer_connection');
      if (savedConn) printerConnection = JSON.parse(savedConn);
      const savedStart = localStorage.getItem('orcaweb_printer_start_print');
      if (savedStart !== null) startPrint = JSON.parse(savedStart);
    } catch {}

    const exportData = {
      ...settings,
      printerConnection: printerConnection || {
        type: 'moonraker',
        url: '',
        apiKey: '',
      },
      startPrint,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `orca_settings_${settings.bed.id || 'profile'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportProfile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files[0]) {
      fileReader.readAsText(event.target.files[0], 'UTF-8');
      fileReader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);

          // Import printer connection parameters if present
          if (parsed.printerConnection || parsed.url) {
            const conn = parsed.printerConnection || {
              type: parsed.printerType || 'moonraker',
              url: parsed.url || '',
              apiKey: parsed.apiKey || '',
            };
            localStorage.setItem('orcaweb_printer_connection', JSON.stringify(conn));
            if (parsed.startPrint !== undefined) {
              localStorage.setItem('orcaweb_printer_start_print', JSON.stringify(parsed.startPrint));
            }
            window.dispatchEvent(new Event('orcaweb_printer_settings_updated'));
          }

          onUpdateSettings(parsed);
        } catch {
          alert('Failed to parse settings JSON file.');
        }
      };
    }
  };

  return (
    <div
      style={{ width: `${sidebarWidth}px` }}
      className="relative bg-slate-900 border-l border-slate-800 h-full flex flex-col overflow-hidden text-xs select-none shrink-0"
    >
      {/* Draggable Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 transition-colors z-30"
        title="Drag to resize sidebar width"
      />

      {/* Header Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/50 p-1 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('preset')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap transition-all ${
            activeTab === 'preset' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Printer className="w-3.5 h-3.5" />
          Printer
        </button>
        <button
          onClick={() => setActiveTab('quality')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap transition-all ${
            activeTab === 'quality' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Quality
        </button>
        <button
          onClick={() => setActiveTab('infill')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap transition-all ${
            activeTab === 'infill' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Infill
        </button>
        <button
          onClick={() => setActiveTab('supports')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap transition-all ${
            activeTab === 'supports' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          Support
        </button>
        <button
          onClick={() => setActiveTab('engine')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap transition-all ${
            activeTab === 'engine' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          Engine
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* TAB 1: PRINTER & FILAMENT PRESETS */}
        {activeTab === 'preset' && (
          <div className="space-y-4">
            {/* Import / Export JSON Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleExportProfile}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:border-slate-700 font-medium flex items-center justify-center gap-1.5 transition-all text-xs"
                title="Export profile settings & printer connection to JSON"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                Export Profile
              </button>
              <label
                className="flex-1 px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:border-slate-700 font-medium flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer"
                title="Import profile settings & printer connection from JSON"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                Import Profile
                <input type="file" accept=".json" onChange={handleImportProfile} className="hidden" />
              </label>
            </div>

            {/* Printer Profile */}
            <div className="space-y-2">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-blue-400" /> Printer Presets
                </span>
              </label>
              <select
                value={settings.bed.id}
                onChange={(e) => {
                  const selected = PRINTER_PRESETS.find((p) => p.id === e.target.value);
                  if (selected) onUpdateSettings({ bed: selected });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-medium focus:border-blue-500 outline-none"
              >
                {PRINTER_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.width}x{p.depth}x{p.height}mm)
                  </option>
                ))}
              </select>
            </div>

            {/* Bed Dimensions Preview */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-400">
              <div>
                <span className="text-slate-500 block text-[10px]">Width X</span>
                <span className="text-slate-200 font-semibold">{settings.bed.width} mm</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Depth Y</span>
                <span className="text-slate-200 font-semibold">{settings.bed.depth} mm</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Height Z</span>
                <span className="text-slate-200 font-semibold">{settings.bed.height} mm</span>
              </div>
            </div>

            {/* Filament Profile */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" /> Filament Profile
              </label>
              <select
                value={settings.filament.id}
                onChange={(e) => {
                  const selected = FILAMENT_PRESETS.find((f) => f.id === e.target.value);
                  if (selected) {
                    onUpdateSettings({
                      filament: selected,
                      nozzleTemp: selected.nozzleTemp,
                      bedTemp: selected.bedTemp,
                    });
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-medium focus:border-blue-500 outline-none"
              >
                {FILAMENT_PRESETS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.nozzleTemp}°C / {f.bedTemp}°C)
                  </option>
                ))}
              </select>
            </div>

            {/* Temps */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <span className="text-slate-400 text-[10px] block mb-1">Nozzle Temp (°C)</span>
                <input
                  type="number"
                  value={settings.nozzleTemp}
                  onChange={(e) => onUpdateSettings({ nozzleTemp: parseInt(e.target.value) || 200 })}
                  className="w-full bg-transparent text-slate-200 font-mono text-sm font-semibold outline-none"
                />
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <span className="text-slate-400 text-[10px] block mb-1">Bed Temp (°C)</span>
                <input
                  type="number"
                  value={settings.bedTemp}
                  onChange={(e) => onUpdateSettings({ bedTemp: parseInt(e.target.value) || 60 })}
                  className="w-full bg-transparent text-slate-200 font-mono text-sm font-semibold outline-none"
                />
              </div>
            </div>

            {/* Klipper Custom G-Code Macros */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-emerald-400" /> Klipper G-Code Macros
              </label>

              <div>
                <label className="text-slate-400 text-[10px] block mb-1 font-mono">Start G-Code Macro</label>
                <textarea
                  rows={3}
                  value={settings.startGCode || ''}
                  onChange={(e) => onUpdateSettings({ startGCode: e.target.value })}
                  placeholder="PRINT_START EXTRUDER={nozzleTemp} BED={bedTemp}"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-[11px] font-mono text-emerald-300 focus:border-blue-500 outline-none resize-y"
                />
              </div>

              <div>
                <label className="text-slate-400 text-[10px] block mb-1 font-mono">End G-Code Macro</label>
                <textarea
                  rows={2}
                  value={settings.endGCode || ''}
                  onChange={(e) => onUpdateSettings({ endGCode: e.target.value })}
                  placeholder="PRINT_END"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-[11px] font-mono text-emerald-300 focus:border-blue-500 outline-none resize-y"
                />
              </div>

              <div>
                <label className="text-slate-400 text-[10px] block mb-1 font-mono">Layer Change G-Code</label>
                <textarea
                  rows={2}
                  value={settings.layerChangeGCode || ''}
                  onChange={(e) => onUpdateSettings({ layerChangeGCode: e.target.value })}
                  placeholder=";AFTER_LAYER_CHANGE"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-[11px] font-mono text-emerald-300 focus:border-blue-500 outline-none resize-y"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: QUALITY & LAYERS */}
        {activeTab === 'quality' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-slate-300 font-medium">
                <span>Layer Height (mm)</span>
                <span className="font-mono text-blue-400 font-semibold">{settings.layerHeight} mm</span>
              </div>
              <input
                type="range"
                min="0.08"
                max="0.36"
                step="0.04"
                value={settings.layerHeight}
                onChange={(e) => onUpdateSettings({ layerHeight: parseFloat(e.target.value) })}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.08 (Extra Fine)</span>
                <span>0.20 (Standard)</span>
                <span>0.32 (Draft)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <span className="text-slate-400 text-[10px] block mb-1">Wall Perimeters</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.wallPerimeters}
                  onChange={(e) => onUpdateSettings({ wallPerimeters: parseInt(e.target.value) || 2 })}
                  className="w-full bg-transparent text-slate-200 font-mono text-sm font-semibold outline-none"
                />
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <span className="text-slate-400 text-[10px] block mb-1">First Layer (mm)</span>
                <input
                  type="number"
                  step="0.02"
                  value={settings.firstLayerHeight}
                  onChange={(e) => onUpdateSettings({ firstLayerHeight: parseFloat(e.target.value) || 0.24 })}
                  className="w-full bg-transparent text-slate-200 font-mono text-sm font-semibold outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <span className="text-slate-400 text-[10px] block mb-1">Top Solid Layers</span>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={settings.topSolidLayers}
                  onChange={(e) => onUpdateSettings({ topSolidLayers: parseInt(e.target.value) || 4 })}
                  className="w-full bg-transparent text-slate-200 font-mono text-sm font-semibold outline-none"
                />
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <span className="text-slate-400 text-[10px] block mb-1">Bottom Solid Layers</span>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={settings.bottomSolidLayers}
                  onChange={(e) => onUpdateSettings({ bottomSolidLayers: parseInt(e.target.value) || 3 })}
                  className="w-full bg-transparent text-slate-200 font-mono text-sm font-semibold outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: INFILL */}
        {activeTab === 'infill' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-slate-300 font-medium">
                <span>Infill Density (%)</span>
                <span className="font-mono text-amber-400 font-semibold">{settings.infillDensity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={settings.infillDensity}
                onChange={(e) => onUpdateSettings({ infillDensity: parseInt(e.target.value) })}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0% (Hollow)</span>
                <span>15-20% (Standard)</span>
                <span>100% (Solid)</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-slate-300 font-semibold block">Infill Pattern</label>
              <div className="grid grid-cols-2 gap-2">
                {(['gyroid', 'grid', 'honeycomb', 'triangles', 'cubic', 'concentric'] as InfillPattern[]).map((pattern) => (
                  <button
                    key={pattern}
                    onClick={() => onUpdateSettings({ infillPattern: pattern })}
                    className={`px-3 py-2 rounded-lg border text-left font-medium capitalize transition-all ${
                      settings.infillPattern === pattern
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {pattern}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SUPPORTS */}
        {activeTab === 'supports' && (
          <div className="space-y-4">
            <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer">
              <span className="text-slate-200 font-semibold">Enable Supports</span>
              <input
                type="checkbox"
                checked={settings.enableSupports}
                onChange={(e) => onUpdateSettings({ enableSupports: e.target.checked })}
                className="w-4 h-4 accent-blue-600 rounded"
              />
            </label>

            {settings.enableSupports && (
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Support Structure Style</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onUpdateSettings({ supportStyle: 'normal' })}
                      className={`p-2.5 rounded-lg border text-center font-medium transition-all ${
                        settings.supportStyle === 'normal'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      Normal / Snug
                    </button>
                    <button
                      onClick={() => onUpdateSettings({ supportStyle: 'tree' })}
                      className={`p-2.5 rounded-lg border text-center font-medium transition-all ${
                        settings.supportStyle === 'tree'
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      Tree / Organic
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                  <span className="text-slate-400 text-[10px] block mb-1">Overhang Threshold Angle (°)</span>
                  <input
                    type="number"
                    value={settings.supportAngle}
                    onChange={(e) => onUpdateSettings({ supportAngle: parseInt(e.target.value) || 45 })}
                    className="w-full bg-transparent text-slate-200 font-mono text-sm font-semibold outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SLICING ENGINE SELECTION */}
        {activeTab === 'engine' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" /> Slicing Engine Architecture
              </label>

              {/* Option 1: Browser WASM */}
              <div
                onClick={() => onSelectEngine('browser-wasm')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  engineType === 'browser-wasm'
                    ? 'bg-indigo-600/10 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-indigo-400" /> Browser WASM / Local Engine
                  </span>
                  {engineType === 'browser-wasm' && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Slices 100% locally in your browser using WebAssembly. Zero backend required, completely offline & instant.
                </p>
              </div>

              {/* Option 2: Remote OrcaSlicer */}
              <div
                onClick={() => onSelectEngine('remote-orca')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  engineType === 'remote-orca'
                    ? 'bg-blue-600/10 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold flex items-center gap-2">
                    <Server className="w-4 h-4 text-blue-400" /> Remote OrcaSlicer / PrusaSlicer API
                  </span>
                  {engineType === 'remote-orca' && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Sends model to a headless OrcaSlicer CLI server for native Bambu / Prusa slicing engine performance.
                </p>
              </div>
            </div>

            {/* Remote Config Details */}
            {engineType === 'remote-orca' && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-3">
                <span className="text-slate-300 font-semibold block text-[11px]">Remote Server Configuration</span>
                <div>
                  <label className="text-slate-500 text-[10px] block mb-1 font-mono">API Server Endpoint URL</label>
                  <input
                    type="text"
                    value={remoteConfig.apiUrl}
                    onChange={(e) => onUpdateRemoteConfig({ apiUrl: e.target.value })}
                    placeholder="http://localhost:8080"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-500 text-[10px] block mb-1 font-mono">API Authorization Key (Optional)</label>
                  <input
                    type="password"
                    value={remoteConfig.apiKey || ''}
                    onChange={(e) => onUpdateRemoteConfig({ apiKey: e.target.value })}
                    placeholder="sk_orca_12345..."
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

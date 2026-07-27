import React, { useState, useEffect } from 'react';
import type { PrinterConnection } from '../types/slicer';
import { uploadGCodeToPrinter, testPrinterConnection } from '../services/printerApi';
import { Send, Server, CheckCircle2, XCircle, Loader2, X, Package, FileCode } from 'lucide-react';

interface PrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  gcode: string;
  filename: string;
}

const LOCAL_STORAGE_KEY = 'orcaweb_printer_connection';
const LOCAL_STORAGE_START_PRINT = 'orcaweb_printer_start_print';
const LOCAL_STORAGE_FORMAT = 'orcaweb_printer_upload_format';

const getInitialConnection = (): PrinterConnection => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        type: parsed.type || 'moonraker',
        url: parsed.url !== undefined ? parsed.url : '',
        apiKey: parsed.apiKey || '',
        connected: false,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return {
    type: 'moonraker',
    url: '',
    apiKey: '',
    connected: false,
  };
};

const getInitialStartPrint = (): boolean => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_START_PRINT);
    if (saved !== null) return JSON.parse(saved);
  } catch {}
  return true;
};

const getInitialFormat = (): 'gcode' | 'ufp' => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_FORMAT);
    if (saved === 'ufp' || saved === 'gcode') return saved;
  } catch {}
  return 'ufp';
};

export const PrinterModal: React.FC<PrinterModalProps> = ({ isOpen, onClose, gcode, filename }) => {
  const [connection, setConnection] = useState<PrinterConnection>(getInitialConnection);
  const [startPrint, setStartPrint] = useState<boolean>(getInitialStartPrint);
  const [uploadFormat, setUploadFormat] = useState<'gcode' | 'ufp'>(getInitialFormat);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok?: boolean; text?: string }>({});
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ isError?: boolean; text?: string }>({});

  // Sync state if profile import updates localStorage
  useEffect(() => {
    const handleStorageSync = () => {
      setConnection(getInitialConnection());
      setStartPrint(getInitialStartPrint());
    };
    window.addEventListener('orcaweb_printer_settings_updated', handleStorageSync);
    return () => {
      window.removeEventListener('orcaweb_printer_settings_updated', handleStorageSync);
    };
  }, []);

  // Persist printer parameters to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          type: connection.type,
          url: connection.url,
          apiKey: connection.apiKey,
        })
      );
    } catch {
      // Storage full/disabled fallback
    }
  }, [connection.type, connection.url, connection.apiKey]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_START_PRINT, JSON.stringify(startPrint));
    } catch {}
  }, [startPrint]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_FORMAT, uploadFormat);
    } catch {}
  }, [uploadFormat]);

  if (!isOpen) return null;

  const captureCanvasThumbnail = (): string => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return '';
    try {
      return canvas.toDataURL('image/png');
    } catch (e) {
      return '';
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult({});
    const res = await testPrinterConnection(connection);
    setTesting(false);
    setTestResult({ ok: res.ok, text: res.statusText });
    setConnection((prev) => ({ ...prev, connected: res.ok }));
  };

  const handleSendToPrinter = async () => {
    setUploading(true);
    setStatusMessage({});
    try {
      const thumbnailPngDataUrl = captureCanvasThumbnail();
      const res = await uploadGCodeToPrinter(
        connection,
        gcode,
        filename,
        startPrint,
        thumbnailPngDataUrl,
        uploadFormat
      );
      setUploading(false);
      setStatusMessage({ isError: false, text: res.message });
    } catch (err: any) {
      setUploading(false);
      setStatusMessage({ isError: true, text: err.message || 'Upload failed' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base">Send to 3D Printer</h3>
            <p className="text-slate-400 text-xs">Direct API dispatch to Klipper / OctoPrint</p>
          </div>
        </div>

        {/* Printer Type Selector */}
        <div className="space-y-2">
          <label className="text-slate-300 font-semibold text-xs">Printer Firmware / API Interface</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setConnection((p) => ({ ...p, type: 'moonraker' }))}
              className={`p-3 rounded-xl border text-left font-medium transition-all text-xs ${
                connection.type === 'moonraker'
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span className="font-bold block mb-0.5">Moonraker (Klipper)</span>
              <span className="text-[10px] text-slate-400 block">Mainsail / Fluidd</span>
            </button>
            <button
              onClick={() => setConnection((p) => ({ ...p, type: 'octoprint' }))}
              className={`p-3 rounded-xl border text-left font-medium transition-all text-xs ${
                connection.type === 'octoprint'
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span className="font-bold block mb-0.5">OctoPrint</span>
              <span className="text-[10px] text-slate-400 block">OctoEverywhere</span>
            </button>
          </div>
        </div>

        {/* Upload Format Selector (UFP vs G-Code) */}
        <div className="space-y-2">
          <label className="text-slate-300 font-semibold text-xs flex items-center justify-between">
            <span>Upload File Format</span>
            <span className="text-[10px] text-emerald-400 font-medium">Includes 3D Render Preview</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setUploadFormat('ufp')}
              className={`p-2.5 rounded-xl border text-left transition-all text-xs flex items-center gap-2 ${
                uploadFormat === 'ufp'
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="block font-semibold">UFP Package (.ufp)</span>
                <span className="text-[9px] text-slate-400 block">Fluidd / Mainsail ZIP</span>
              </div>
            </button>
            <button
              onClick={() => setUploadFormat('gcode')}
              className={`p-2.5 rounded-xl border text-left transition-all text-xs flex items-center gap-2 ${
                uploadFormat === 'gcode'
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <span className="block font-semibold">Standard G-Code</span>
                <span className="text-[9px] text-slate-400 block">With embedded comments</span>
              </div>
            </button>
          </div>
        </div>

        {/* URL Input */}
        <div className="space-y-1.5">
          <label className="text-slate-300 font-semibold text-xs">Printer Address / URL</label>
          <input
            type="text"
            value={connection.url}
            onChange={(e) => setConnection((p) => ({ ...p, url: e.target.value }))}
            placeholder="http://192.168.1.100:7125 (or leave empty if KLIPPER_URL is set)"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 text-xs font-mono focus:border-blue-500 outline-none"
          />
        </div>

        {/* API Key Input */}
        <div className="space-y-1.5">
          <label className="text-slate-300 font-semibold text-xs">API Key (Optional for Moonraker)</label>
          <input
            type="password"
            value={connection.apiKey || ''}
            onChange={(e) => setConnection((p) => ({ ...p, apiKey: e.target.value }))}
            placeholder="Key from OctoPrint settings..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 text-xs font-mono focus:border-blue-500 outline-none"
          />
        </div>

        {/* Options */}
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={startPrint}
            onChange={(e) => setStartPrint(e.target.checked)}
            className="w-4 h-4 accent-blue-600 rounded"
          />
          Automatically start printing upon upload
        </label>

        {/* Status indicator */}
        {testResult.text && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              testResult.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            {testResult.text}
          </div>
        )}

        {statusMessage.text && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              !statusMessage.isError
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {!statusMessage.isError ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            {statusMessage.text}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
            Test
          </button>

          <button
            onClick={handleSendToPrinter}
            disabled={uploading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send to Printer
          </button>
        </div>
      </div>
    </div>
  );
};

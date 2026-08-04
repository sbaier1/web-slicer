import { useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { parseModelGeometry } from './services/modelLoader';
import confetti from 'canvas-confetti';

import { Header } from './components/Header';
import { ThreeCanvas } from './components/Viewport/ThreeCanvas';
import { ViewportToolbar } from './components/Viewport/ViewportToolbar';
import { SliceSettingsPanel } from './components/Sidebar/SliceSettingsPanel';
import { ModelTransformPanel } from './components/Sidebar/ModelTransformPanel';
import { GCodeLayerSlider } from './components/GCodeViewer/GCodeLayerSlider';
import { PrinterModal } from './components/PrinterModal';

import type {
  Model3D,
  SlicerSettings,
  SlicedResult,
  SlicerEngineType,
  RemoteSlicerConfig,
} from './types/slicer';
import { DEFAULT_SLICER_SETTINGS } from './constants/presets';
import { SAMPLE_MODELS } from './services/sampleModels';
import { sliceModelsInBrowser } from './services/slicerEngine';
import { sliceWithRemoteOrcaSlicer } from './services/remoteSlicerApi';
import { createUFPPackage, embedKlipperThumbnails, downloadFile } from './services/ufpExporter';
import { findOptimalPrintOrientation } from './services/orientationOptimizer';

const getInitialRemoteConfig = (): RemoteSlicerConfig => {
  const saved = localStorage.getItem('orcaweb_remote_config_v1');
  if (saved) {
    try { return JSON.parse(saved); } catch (e) {}
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  return { apiUrl: `${protocol}//${host}:8080` };
};
const LOCAL_STORAGE_SETTINGS_KEY = 'orcaweb_slicer_settings_v1';
const LOCAL_STORAGE_ENGINE_KEY = 'orcaweb_engine_type_v1';
const LOCAL_STORAGE_REMOTE_CONFIG_KEY = 'orcaweb_remote_config_v1';
const LOCAL_STORAGE_PRINTER_KEY = 'orcaweb_printer_connection';

export function App() {
  const [models, setModels] = useState<Model3D[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'move' | 'rotate' | 'scale'>('move');

  // Load saved settings from localStorage or fallback to defaults
  const [settings, setSettings] = useState<SlicerSettings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_SLICER_SETTINGS;
  });

  // Fetch default settings from container on mount to populate printer URL & profile defaults
  useEffect(() => {
    fetch('/api/settings/default')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          // 1. Sync Printer Connection if missing or empty in local storage
          const connData = data.printerConnection || {
            type: data.printerType || 'moonraker',
            url: data.printerUrl || data.url || '',
            apiKey: data.apiKey || '',
          };

          const savedConnStr = localStorage.getItem(LOCAL_STORAGE_PRINTER_KEY);
          let savedConn = null;
          try {
            if (savedConnStr) savedConn = JSON.parse(savedConnStr);
          } catch {}

          if (connData.url && (!savedConn || !savedConn.url)) {
            localStorage.setItem(
              LOCAL_STORAGE_PRINTER_KEY,
              JSON.stringify({
                type: connData.type || 'moonraker',
                url: connData.url,
                apiKey: connData.apiKey || '',
              })
            );
            if (data.startPrint !== undefined) {
              localStorage.setItem('orcaweb_printer_start_print', JSON.stringify(data.startPrint));
            }
            window.dispatchEvent(new Event('orcaweb_printer_settings_updated'));
          }

          // 2. Sync Slicer Settings if initial load
          const isInitialized = localStorage.getItem('orcaweb_initialized_v2');
          if (!isInitialized) {
            localStorage.setItem('orcaweb_initialized_v2', 'true');
            setSettings((prev) => ({ ...prev, ...data }));
          }
        }
      })
      .catch(() => {});
  }, []);

  const [engineType, setEngineType] = useState<SlicerEngineType>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_ENGINE_KEY);
      if (saved === 'browser-wasm' || saved === 'remote-orca') return saved;
    } catch (e) {}
    return 'browser-wasm';
  });

  const [remoteConfig, setRemoteConfig] = useState<RemoteSlicerConfig>(getInitialRemoteConfig);

  // Save settings to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {}
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_ENGINE_KEY, engineType);
    } catch (e) {}
  }, [engineType]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_REMOTE_CONFIG_KEY, JSON.stringify(remoteConfig));
    } catch (e) {}
  }, [remoteConfig]);

  const [mode, setMode] = useState<'prepare' | 'preview'>('prepare');
  const [wireframe, setWireframe] = useState(false);

  // Slicing state
  const [isSlicing, setIsSlicing] = useState(false);
  const [slicingProgress, setSlicingProgress] = useState(0);
  const [slicingStepMessage, setSlicingStepMessage] = useState('');
  const [slicedResult, setSlicedResult] = useState<SlicedResult | null>(null);
  const [visibleLayerIndex, setVisibleLayerIndex] = useState(0);

  // Printer Upload Modal
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);

  // Handle STL / OBJ / 3MF file upload
  const handleFileUpload = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer) return;

      try {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'stl';
        const geometry = parseModelGeometry(buffer, file.name);

        const bb = geometry.boundingBox!;
        const sizeX = bb.max.x - bb.min.x;
        const sizeY = bb.max.y - bb.min.y;
        const sizeZ = bb.max.z - bb.min.z;

        const newModel: Model3D = {
          id: `model-${Date.now()}`,
          name: file.name,
          geometry,
          position: { x: settings.bed.width / 2, y: settings.bed.depth / 2, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          size: { x: sizeX, y: sizeY, z: sizeZ },
          originalSize: { x: sizeX, y: sizeY, z: sizeZ },
          fileSize: file.size,
          fileType: fileExt,
          color: '#38bdf8',
          visible: true,
        };

        setModels((prev) => [...prev, newModel]);
        setSelectedModelId(newModel.id);
      } catch (err: any) {
        alert(`Failed to parse 3D model (${file.name}): ${err.message || err}`);
      }
    };

    reader.readAsArrayBuffer(file);
  }, [settings.bed.width, settings.bed.depth]);

  // Handle sample model selection
  const handleSelectSampleModel = (sampleId: string) => {
    const sample = SAMPLE_MODELS.find((s) => s.id === sampleId);
    if (!sample) return;

    const geo = sample.generator();
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const sizeX = bb.max.x - bb.min.x;
    const sizeY = bb.max.y - bb.min.y;
    const sizeZ = bb.max.z - bb.min.z;

    const newModel: Model3D = {
      id: `model-${Date.now()}`,
      name: sample.name,
      geometry: geo,
      position: { x: (models.length * 35) % 120, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      size: { x: sizeX, y: sizeY, z: sizeZ },
      originalSize: { x: sizeX, y: sizeY, z: sizeZ },
      fileSize: 32 * 1024,
      fileType: 'stl',
      color: '#eab308',
      visible: true,
    };

    setModels((prev) => [...prev, newModel]);
    setSelectedModelId(newModel.id);
  };

  // Model updates
  const handleUpdateModelTransform = (updated: Partial<Model3D>) => {
    if (!selectedModelId) return;
    setModels((prev) =>
      prev.map((m) => (m.id === selectedModelId ? { ...m, ...updated } : m))
    );
  };

  const selectedModel = models.find((m) => m.id === selectedModelId);

  // Model operations
  const handleCenterModel = () => {
    if (!selectedModelId) return;
    handleUpdateModelTransform({ position: { x: settings.bed.width / 2, y: settings.bed.depth / 2, z: 0 } });
  };

  const handleSnapToBed = () => {
    if (!selectedModelId) return;
    handleUpdateModelTransform({ position: { ...selectedModel!.position, z: 0 } });
  };

  const handleLayFlat = () => {
    if (!selectedModelId) return;
    handleUpdateModelTransform({ rotation: { x: 0, y: 0, z: 0 }, position: { ...selectedModel!.position, z: 0 } });
  };

  // Auto-Orient Selected Model for Minimal Overhangs & Max Base Contact
  const handleAutoOrient = () => {
    if (!selectedModel) return;
    const bestRot = findOptimalPrintOrientation(selectedModel.geometry);
    handleUpdateModelTransform({
      rotation: bestRot,
      position: { ...selectedModel.position, z: 0 },
    });
  };

  const handleDuplicateModel = () => {
    if (!selectedModel) return;
    const clonedGeo = selectedModel.geometry.clone();
    const dup: Model3D = {
      ...selectedModel,
      id: `model-${Date.now()}`,
      name: `${selectedModel.name} (Copy)`,
      geometry: clonedGeo,
      position: {
        x: selectedModel.position.x + 30,
        y: selectedModel.position.y + 30,
        z: selectedModel.position.z,
      },
    };
    setModels((prev) => [...prev, dup]);
    setSelectedModelId(dup.id);
  };

  const handleDeleteModel = () => {
    if (!selectedModelId) return;
    setModels((prev) => prev.filter((m) => m.id !== selectedModelId));
    setSelectedModelId(null);
  };

  // Intelligent Auto-Orient & Arrange All Models on Build Plate
  const handleAutoArrange = () => {
    const cols = Math.ceil(Math.sqrt(models.length));
    const spacing = 45;
    const centerX = settings.bed.width / 2;
    const centerY = settings.bed.depth / 2;

    setModels((prev) =>
      prev.map((m, idx) => {
        // Optimize orientation for max contact area & minimal overhangs
        const bestRot = findOptimalPrintOrientation(m.geometry);

        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const offsetX = centerX + (col - (cols - 1) / 2) * spacing;
        const offsetY = centerY + (row - (cols - 1) / 2) * spacing;

        return {
          ...m,
          rotation: bestRot,
          position: { x: offsetX, y: offsetY, z: 0 },
        };
      })
    );
  };

  // Drag & drop STL / 3MF directly onto canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Perform Slicing
  const handleSlice = async () => {
    if (models.length === 0) return;

    setIsSlicing(true);
    setSlicingProgress(0);
    setSlicingStepMessage('Starting slice...');

    try {
      let result: SlicedResult;

      if (engineType === 'browser-wasm') {
        result = await sliceModelsInBrowser(models, settings, (percent, msg) => {
          setSlicingProgress(percent);
          setSlicingStepMessage(msg);
        });
      } else {
        // Remote OrcaSlicer API Engine: Bake exact 3D transformations (Rotation, Scale, Bed Position)
        // into exported STL mesh using Three.js world matrices so OrcaSlicer receives the exact 3D orientation
        const exporter = new STLExporter();
        const transformedGeometries: THREE.BufferGeometry[] = [];

        for (const m of models) {
          if (!m.visible) continue;
          const clonedGeo = m.geometry.clone();

          const scaleMatrix = new THREE.Matrix4().makeScale(m.scale.x, m.scale.y, m.scale.z);
          const rotMatrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(m.rotation.x, m.rotation.y, m.rotation.z));
          const rotScaleMatrix = new THREE.Matrix4().multiplyMatrices(scaleMatrix, rotMatrix);

          clonedGeo.applyMatrix4(rotScaleMatrix);
          clonedGeo.computeBoundingBox();

          let zOffset = 0;
          if (clonedGeo.boundingBox) {
            zOffset = -clonedGeo.boundingBox.min.z;
          }

          const transMatrix = new THREE.Matrix4().makeTranslation(
            m.position.x,
            m.position.y,
            m.position.z + zOffset
          );
          clonedGeo.applyMatrix4(transMatrix);
          transformedGeometries.push(clonedGeo);
        }

        const mergedGeo = transformedGeometries.length === 1
          ? transformedGeometries[0]
          : mergeGeometries(transformedGeometries, false) || transformedGeometries[0];

        const tempMesh = new THREE.Mesh(mergedGeo);
        const stlString = exporter.parse(tempMesh) as string;
        const blob = new Blob([stlString], { type: 'model/stl' });

        const modelName = models[0]?.name.replace(/\.[^/.]+$/, '') || 'model';
        const sliceFileName = `${modelName}.stl`;

        result = await sliceWithRemoteOrcaSlicer(
          blob,
          sliceFileName,
          {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
          },
          settings,
          remoteConfig,
          (percent, msg) => {
            setSlicingProgress(percent);
            setSlicingStepMessage(msg);
          }
        );
      }

      setSlicedResult(result);
      setVisibleLayerIndex(result.layers.length - 1);
      setMode('preview'); // Switch to G-code preview mode

      // Confetti celebration
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (err: any) {
      alert(`Slicing Error: ${err.message || err}`);
    } finally {
      setIsSlicing(false);
    }
  };

  // Export Operations (G-Code & UFP with Fluidd/Mainsail Thumbnail Cards)
  const captureCanvasThumbnail = (): string => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return '';
    try {
      return canvas.toDataURL('image/png');
    } catch (e) {
      return '';
    }
  };

  const handleExportGCode = () => {
    if (!slicedResult) return;
    const thumbnailDataUrl = captureCanvasThumbnail();
    const gcodeWithThumbnail = embedKlipperThumbnails(slicedResult.gcode, thumbnailDataUrl);
    const blob = new Blob([gcodeWithThumbnail], { type: 'text/plain;charset=utf-8' });
    const modelName = models[0]?.name.replace(/\.[^/.]+$/, '') || 'sliced_model';
    downloadFile(blob, `${modelName}.gcode`);
  };

  const handleExportUFP = async () => {
    if (!slicedResult) return;
    const thumbnailDataUrl = captureCanvasThumbnail();
    const modelName = models[0]?.name.replace(/\.[^/.]+$/, '') || 'sliced_model';
    const ufpBlob = await createUFPPackage(slicedResult.gcode, thumbnailDataUrl);
    downloadFile(ufpBlob, `${modelName}.ufp`);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex flex-col h-screen w-screen bg-slate-950 overflow-hidden text-slate-100 select-none"
    >
      {/* Header Bar */}
      <Header
        onFileUpload={handleFileUpload}
        onSelectSampleModel={handleSelectSampleModel}
        onSlice={handleSlice}
        isSlicing={isSlicing}
        slicingProgress={slicingProgress}
        slicingStepMessage={slicingStepMessage}
        hasGCode={!!slicedResult}
        onExportGCode={handleExportGCode}
        onExportUFP={handleExportUFP}
        onOpenPrinterModal={() => setIsPrinterModalOpen(true)}
        engineType={engineType}
        modelCount={models.length}
      />

      {/* Main Workspace (Viewport + Sidebar) */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* 3D Viewport Container */}
        <div className="flex-1 h-full relative overflow-hidden">
          {/* Viewport Toolbar Overlay */}
          <ViewportToolbar
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            onCenterModel={handleCenterModel}
            onSnapToBed={handleSnapToBed}
            onAutoOrient={handleAutoOrient}
            onLayFlat={handleLayFlat}
            onDuplicate={handleDuplicateModel}
            onDelete={handleDeleteModel}
            onAutoArrange={handleAutoArrange}
            wireframe={wireframe}
            onToggleWireframe={() => setWireframe(!wireframe)}
            hasSelection={!!selectedModelId}
            mode={mode}
            onToggleMode={setMode}
            hasGCode={!!slicedResult}
          />

          {/* Floating Numeric Model Transform Panel */}
          {selectedModel && mode === 'prepare' && (
            <div className="absolute left-4 bottom-4 z-10 w-64">
              <ModelTransformPanel model={selectedModel} onUpdateTransform={handleUpdateModelTransform} />
            </div>
          )}

          {/* G-Code Toolpath Layer Inspector (Preview Mode) */}
          {mode === 'preview' && slicedResult && (
            <GCodeLayerSlider
              slicedResult={slicedResult}
              visibleLayerIndex={visibleLayerIndex}
              onChangeVisibleLayer={setVisibleLayerIndex}
            />
          )}

          {/* 3D Interactive Three.js Viewport */}
          <ThreeCanvas
            models={models}
            selectedModelId={selectedModelId}
            onSelectModel={setSelectedModelId}
            onUpdateModelTransform={(id, updated) => {
              setModels((prev) => prev.map((m) => (m.id === id ? { ...m, ...updated } : m)));
            }}
            bed={settings.bed}
            wireframe={wireframe}
            activeTool={activeTool}
            mode={mode}
            gcodeLayers={slicedResult?.layers || []}
            visibleLayerIndex={visibleLayerIndex}
          />
        </div>

        {/* Resizable Settings Sidebar */}
        <SliceSettingsPanel
          settings={settings}
          onUpdateSettings={(updated) => setSettings((prev) => ({ ...prev, ...updated }))}
          engineType={engineType}
          onSelectEngine={setEngineType}
          remoteConfig={remoteConfig}
          onUpdateRemoteConfig={(cfg) => setRemoteConfig((prev) => ({ ...prev, ...cfg }))}
        />
      </div>

      {/* Direct Printer Dispatch Modal */}
      <PrinterModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
        gcode={slicedResult?.gcode || ''}
        filename={`${models[0]?.name.replace(/\.[^/.]+$/, '') || 'print'}.gcode`}
      />
    </div>
  );
}

export type Vector3D = {
  x: number;
  y: number;
  z: number;
};

export type PrinterBed = {
  id: string;
  name: string;
  width: number; // X in mm
  depth: number; // Y in mm
  height: number; // Z in mm
  shape: 'rectangular' | 'circular';
  nozzleDiameter: number; // mm
};

export type FilamentProfile = {
  id: string;
  name: string;
  density: number; // g/cm3
  diameter: number; // mm
  nozzleTemp: number; // °C
  bedTemp: number; // °C
  color: string;
  pricePerKg: number; // USD
};

export type InfillPattern = 'gyroid' | 'grid' | 'honeycomb' | 'triangles' | 'cubic' | 'concentric';

export type SupportStyle = 'normal' | 'tree';

export type SupportPlacement = 'everywhere' | 'buildplate';

export type SlicerSettings = {
  // Quality
  layerHeight: number; // mm
  firstLayerHeight: number; // mm
  wallPerimeters: number;
  topSolidLayers: number;
  bottomSolidLayers: number;

  // Infill
  infillDensity: number; // 0-100%
  infillPattern: InfillPattern;

  // Supports
  enableSupports: boolean;
  supportStyle: SupportStyle;
  supportPlacement: SupportPlacement;
  supportAngle: number; // degrees

  // Speeds (mm/s)
  printSpeed: number;
  outerWallSpeed: number;
  infillSpeed: number;
  travelSpeed: number;

  // Temperatures & Cooling
  nozzleTemp: number;
  bedTemp: number;
  fanSpeed: number; // 0-100%

  // Retraction
  retractionDistance: number; // mm
  retractionSpeed: number; // mm/s
  zHop: number; // mm

  // Bed & Printer
  bed: PrinterBed;
  filament: FilamentProfile;

  // Custom Klipper G-Code Scripts / Macros
  startGCode?: string;
  endGCode?: string;
  layerChangeGCode?: string;
};

export type Model3D = {
  id: string;
  name: string;
  geometry: import('three').BufferGeometry;
  position: Vector3D;
  rotation: Vector3D; // in radians
  scale: Vector3D;
  size: Vector3D; // bounding box dimensions in mm
  originalSize: Vector3D;
  fileSize: number;
  fileType: string;
  color?: string;
  visible: boolean;
};

export type SlicerEngineType = 'browser-wasm' | 'remote-orca';

export type RemoteSlicerConfig = {
  apiUrl: string; // e.g. http://localhost:8080
  apiKey?: string;
};

export type GCodeFeatureType = 'outer_wall' | 'inner_wall' | 'infill' | 'solid_infill' | 'support' | 'travel' | 'first_layer';

export type GCodeSegment = {
  type: GCodeFeatureType;
  points: Vector3D[];
  extrusion: number; // mm
  feedrate: number; // mm/min
  layerIndex: number;
};

export type GCodeLayer = {
  layerIndex: number;
  z: number; // height in mm
  segments: GCodeSegment[];
};

export type SlicedResult = {
  gcode: string;
  layers: GCodeLayer[];
  stats: {
    totalLayers: number;
    estimatedTimeSeconds: number;
    filamentUsedMeters: number;
    filamentUsedGrams: number;
    estimatedCost: number;
    fileSizeBytes: number;
  };
};

export type PrinterConnection = {
  type: 'moonraker' | 'octoprint';
  url: string;
  apiKey?: string;
  connected: boolean;
  status?: string;
};

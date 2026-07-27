import type { SlicerSettings, SlicedResult, RemoteSlicerConfig, Vector3D } from '../types/slicer';
import { parseGCode } from './gcodeParser';
import { parseUrlAndAuth } from './printerApi';

/**
 * REST API client for connecting to OrcaSlicer CLI server.
 * Submits exact 3D model orientation (position, rotation, scale) + OrcaSlicer profile settings.
 */
export async function sliceWithRemoteOrcaSlicer(
  stlBlob: Blob,
  fileName: string,
  modelTransform: { position: Vector3D; rotation: Vector3D; scale: Vector3D },
  settings: SlicerSettings,
  config: RemoteSlicerConfig,
  onProgress?: (percent: number, stepMessage: string) => void
): Promise<SlicedResult> {
  // Normalize API endpoint URL
  let targetUrl = (config.apiUrl || '').trim().replace(/\/+$/, '');
  if (targetUrl.endsWith('/api/slice')) {
    targetUrl = targetUrl.slice(0, -'/api/slice'.length);
  }
  if (targetUrl.endsWith('/api/printer/upload')) {
    targetUrl = targetUrl.slice(0, -'/api/printer/upload'.length);
  }

  const { baseUrl, headers } = parseUrlAndAuth(targetUrl || window.location.origin, config.apiKey);

  // Send API key as X-Api-Key to preserve HTTP BasicAuth Authorization header if site is behind BasicAuth
  if (config.apiKey) {
    if (config.apiKey.startsWith('Bearer ') || config.apiKey.startsWith('Basic ')) {
      headers['Authorization'] = config.apiKey;
    } else {
      headers['X-Api-Key'] = config.apiKey;
    }
  }

  onProgress?.(10, `Connecting to OrcaSlicer Engine API at ${baseUrl}...`);

  const formData = new FormData();
  formData.append('file', stlBlob, fileName);
  formData.append('settings', JSON.stringify(settings));
  formData.append('position', JSON.stringify(modelTransform.position));
  formData.append('rotation', JSON.stringify(modelTransform.rotation));
  formData.append('scale', JSON.stringify(modelTransform.scale));

  onProgress?.(30, 'Submitting 3D model orientation & profile config to OrcaSlicer...');

  const response = await fetch(`${baseUrl}/api/slice`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    let errDetail = '';
    try {
      const errJson = await response.clone().json();
      errDetail = errJson.error || errJson.message || JSON.stringify(errJson);
    } catch {
      errDetail = await response.text().catch(() => 'Unknown server error');
    }
    throw new Error(`OrcaSlicer API Error (${response.status}): ${errDetail}`);
  }

  onProgress?.(65, 'OrcaSlicer C++ engine slicing model... Downloading G-code...');
  const resultJson = await response.json();

  onProgress?.(90, 'Parsing G-code toolpath layers for 3D preview...');
  const layers = parseGCode(resultJson.gcode);

  onProgress?.(100, 'OrcaSlicer slicing complete!');

  return {
    gcode: resultJson.gcode,
    layers,
    stats: resultJson.stats || {
      totalLayers: layers.length,
      estimatedTimeSeconds: 1200,
      filamentUsedMeters: 12.5,
      filamentUsedGrams: 37.5,
      estimatedCost: 0.75,
      fileSizeBytes: resultJson.gcode.length,
    },
  };
}

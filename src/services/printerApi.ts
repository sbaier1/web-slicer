import type { PrinterConnection } from '../types/slicer';
import { embedKlipperThumbnails, createUFPPackage } from './ufpExporter';

/**
 * Parses printer URL, automatically extracting embedded BasicAuth credentials (user:pass@host)
 * to prevent browser `Window.fetch: url with embedded credentials` security errors.
 */
export function parseUrlAndAuth(rawUrl: string, apiKey?: string): { baseUrl: string; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  let targetUrl = rawUrl.trim();

  try {
    const parsed = new URL(targetUrl);
    if (parsed.username || parsed.password) {
      const user = decodeURIComponent(parsed.username);
      const pass = decodeURIComponent(parsed.password);
      const credentials = btoa(`${user}:${pass}`);
      headers['Authorization'] = `Basic ${credentials}`;
      parsed.username = '';
      parsed.password = '';
      targetUrl = parsed.toString();
    }
  } catch {
    // String fallback if URL parsing fails
  }

  const baseUrl = targetUrl.endsWith('/') ? targetUrl.slice(0, -1) : targetUrl;

  if (apiKey) {
    if (apiKey.startsWith('Basic ') || apiKey.startsWith('Bearer ')) {
      headers['Authorization'] = apiKey;
    } else {
      headers['X-Api-Key'] = apiKey;
    }
  }

  return { baseUrl, headers };
}

/**
 * Uploads G-code or UFP Package to Moonraker (Klipper / Fluidd / Mainsail) or OctoPrint API with embedded preview thumbnails
 */
export async function uploadGCodeToPrinter(
  connection: PrinterConnection,
  gcode: string,
  filename: string,
  startPrintImmediately: boolean = false,
  thumbnailPngDataUrl?: string,
  uploadFormat: 'gcode' | 'ufp' = 'gcode'
): Promise<{ success: boolean; message: string }> {
  // Always embed Klipper comments into G-code if thumbnailPngDataUrl is provided
  const gcodeWithThumbnails = thumbnailPngDataUrl ? embedKlipperThumbnails(gcode, thumbnailPngDataUrl) : gcode;

  let fileBlob: Blob;
  let finalFilename = filename;

  if (uploadFormat === 'ufp' || filename.endsWith('.ufp')) {
    fileBlob = await createUFPPackage(gcode, thumbnailPngDataUrl || '');
    if (!finalFilename.endsWith('.ufp')) {
      finalFilename = finalFilename.replace(/\.[^/.]+$/, '') + '.ufp';
    }
  } else {
    fileBlob = new Blob([gcodeWithThumbnails], { type: 'text/plain' });
    if (!finalFilename.endsWith('.gcode')) {
      finalFilename = finalFilename.replace(/\.[^/.]+$/, '') + '.gcode';
    }
  }

  if (!connection.url) {
    // Empty URL: Upload directly via backend proxy (KLIPPER_URL env variable)
    return uploadViaBackendProxyBlob(connection, fileBlob, finalFilename, startPrintImmediately);
  }

  const { baseUrl, headers } = parseUrlAndAuth(connection.url, connection.apiKey);

  if (connection.type === 'moonraker') {
    // Moonraker REST API endpoint: /server/files/upload
    const formData = new FormData();
    formData.append('file', fileBlob, finalFilename);
    if (startPrintImmediately) {
      formData.append('print', 'true');
    }

    try {
      const response = await fetch(`${baseUrl}/server/files/upload`, {
        method: 'POST',
        headers,
        body: formData,
        cache: 'no-store',
      });

      if (!response.ok) {
        console.warn(`[PrinterApi] Direct fetch returned HTTP ${response.status}, trying backend proxy fallback...`);
        return uploadViaBackendProxyBlob(connection, fileBlob, finalFilename, startPrintImmediately);
      }

      await response.json();
      return {
        success: true,
        message: `Successfully uploaded ${finalFilename} to Moonraker (Klipper)!${startPrintImmediately ? ' Print started.' : ''}`,
      };
    } catch (directErr: any) {
      console.warn('[PrinterApi] Direct fetch failed, attempting backend proxy upload...', directErr);
      return uploadViaBackendProxyBlob(connection, fileBlob, finalFilename, startPrintImmediately);
    }
  } else {
    // OctoPrint REST API endpoint: /api/files/local
    const formData = new FormData();
    formData.append('file', fileBlob, finalFilename);
    if (startPrintImmediately) {
      formData.append('print', 'true');
    }

    try {
      const response = await fetch(`${baseUrl}/api/files/local`, {
        method: 'POST',
        headers,
        body: formData,
        cache: 'no-store',
      });

      if (!response.ok) {
        console.warn(`[PrinterApi] Direct OctoPrint fetch returned HTTP ${response.status}, trying proxy fallback...`);
        return uploadViaBackendProxyBlob(connection, fileBlob, finalFilename, startPrintImmediately);
      }

      return {
        success: true,
        message: `Successfully uploaded ${finalFilename} to OctoPrint!${startPrintImmediately ? ' Print started.' : ''}`,
      };
    } catch (directErr: any) {
      console.warn('[PrinterApi] Direct OctoPrint fetch failed, attempting backend proxy upload...', directErr);
      return uploadViaBackendProxyBlob(connection, fileBlob, finalFilename, startPrintImmediately);
    }
  }
}

/**
 * Fallback uploader via backend Python API (bypasses browser CORS / Mixed Content / BasicAuth blockages)
 */
async function uploadViaBackendProxyBlob(
  connection: PrinterConnection,
  fileBlob: Blob,
  filename: string,
  startPrintImmediately: boolean
): Promise<{ success: boolean; message: string }> {
  const formData = new FormData();
  formData.append('file', fileBlob, filename);
  if (connection.url) formData.append('printer_url', connection.url);
  formData.append('printer_type', connection.type);
  if (connection.apiKey) formData.append('api_key', connection.apiKey);
  if (startPrintImmediately) formData.append('print', 'true');

  const response = await fetch('/api/printer/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({ error: 'Proxy upload failed' }));
    throw new Error(errJson.error || `Proxy Upload Error (${response.status})`);
  }

  const resJson = await response.json();
  return {
    success: true,
    message: resJson.message || `Successfully uploaded ${filename} via backend proxy!`,
  };
}

/**
 * Checks connection status to Moonraker or OctoPrint
 */
export async function testPrinterConnection(connection: PrinterConnection): Promise<{ ok: boolean; statusText: string }> {
  if (!connection.url) {
    try {
      const proxyRes = await fetch('/api/printer/info');
      const proxyJson = await proxyRes.json();
      return { ok: proxyJson.ok, statusText: proxyJson.statusText || (proxyJson.ok ? 'Connected via proxy!' : 'Proxy connection failed') };
    } catch {
      return { ok: false, statusText: 'No printer URL configured on server' };
    }
  }

  const { baseUrl, headers } = parseUrlAndAuth(connection.url, connection.apiKey);

  try {
    const testEndpoint = connection.type === 'moonraker' ? `${baseUrl}/printer/info` : `${baseUrl}/api/version`;

    const res = await fetch(testEndpoint, { headers, cache: 'no-store' });
    if (res.ok) {
      return { ok: true, statusText: `Connected to ${connection.type.toUpperCase()}!` };
    } else {
      // Direct fetch returned non-200 (e.g. 401), fallback to backend proxy
      const proxyRes = await fetch(`/api/printer/info?printer_url=${encodeURIComponent(connection.url)}`);
      const proxyJson = await proxyRes.json();
      return { ok: proxyJson.ok, statusText: proxyJson.statusText || `HTTP Error ${res.status}` };
    }
  } catch {
    try {
      const proxyRes = await fetch(`/api/printer/info?printer_url=${encodeURIComponent(connection.url)}`);
      const proxyJson = await proxyRes.json();
      return { ok: proxyJson.ok, statusText: proxyJson.statusText || 'Connection failed' };
    } catch {
      return { ok: false, statusText: 'Network error / CORS blocked' };
    }
  }
}

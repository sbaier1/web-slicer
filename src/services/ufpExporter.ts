import JSZip from 'jszip';

/**
 * Converts a Base64 data URL (data:image/png;base64,...) to raw base64 string
 */
function extractBase64(dataUrl: string): string {
  const parts = dataUrl.split(',');
  return parts.length > 1 ? parts[1] : dataUrl;
}

/**
 * Formats Base64 PNG image string into standard Klipper / Fluidd / Mainsail G-code thumbnail comments
 * Example:
 * ; thumbnail begin 300x300 4820
 * ; iVBORw0KGgoAAAANSUhEUgAAASwAAAEs...
 * ; thumbnail end
 */
export function embedKlipperThumbnails(gcode: string, thumbnailPngDataUrl: string): string {
  if (!thumbnailPngDataUrl) return gcode;

  const base64Png = extractBase64(thumbnailPngDataUrl);
  const chunkSize = 78; // G-code comment line length limit

  const lines: string[] = [];
  lines.push(`;`);
  lines.push(`; thumbnail begin 300x300 ${base64Png.length}`);

  for (let i = 0; i < base64Png.length; i += chunkSize) {
    lines.push(`; ${base64Png.substring(i, i + chunkSize)}`);
  }

  lines.push(`; thumbnail end`);
  lines.push(`;`);
  lines.push(``);

  return lines.join('\n') + '\n' + gcode;
}

/**
 * Creates a UFP (Ultimaker Format Package) ZIP archive compliant with Moonraker metadata.py:
 * Moonraker extract_ufp queries '/3D/model.gcode' with leading slash.
 */
export async function createUFPPackage(
  gcode: string,
  thumbnailPngDataUrl: string
): Promise<Blob> {
  const zip = new JSZip();

  // 1. Embed thumbnail comments into G-code for Fluidd / Moonraker
  const gcodeWithThumbnails = embedKlipperThumbnails(gcode, thumbnailPngDataUrl);

  // Moonraker metadata.py extract_ufp explicitly queries '/3D/model.gcode' with leading slash
  zip.file('/3D/model.gcode', gcodeWithThumbnails);
  zip.file('3D/model.gcode', gcodeWithThumbnails);
  zip.file('/model.gcode', gcodeWithThumbnails);
  zip.file('model.gcode', gcodeWithThumbnails);

  // 2. Add metadata thumbnail PNG files if provided
  if (thumbnailPngDataUrl) {
    const base64Png = extractBase64(thumbnailPngDataUrl);
    zip.file('/metadata/thumbnail.png', base64Png, { base64: true });
    zip.file('metadata/thumbnail.png', base64Png, { base64: true });
    zip.file('/metadata/thumbnail_300x300.png', base64Png, { base64: true });
    zip.file('metadata/thumbnail_300x300.png', base64Png, { base64: true });
  }

  // 3. Generate ZIP blob
  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/x-ufp',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * Triggers browser download of a Blob as a file
 */
export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Browser-only: decode a local photo, resize and re-encode as JPEG on a canvas.
// Re-encoding means only pixels are kept (no SVG, metadata or scripts survive).
import { LIMITS, validateImageFile, isSafeImageDataUrl } from './model.js';

async function decode(file) {
  if ('createImageBitmap' in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compressImage(file) {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);
  let source;
  try { source = await decode(file); } catch { throw new Error('That photo couldn’t be opened. Try a different JPEG, PNG or WebP file.'); }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let maxSide = 1280;
  let quality = 0.82;
  for (let attempt = 0; attempt < 10; attempt++) {
    const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    ctx.fillStyle = '#2b2622'; // background for transparent PNG/WebP
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= LIMITS.imageChars && isSafeImageDataUrl(dataUrl)) {
      source.close?.();
      return dataUrl;
    }
    if (quality > 0.55) quality -= 0.12;
    else maxSide = Math.round(maxSide * 0.75);
  }
  source.close?.();
  throw new Error('That photo couldn’t be made small enough to keep. Try another one.');
}

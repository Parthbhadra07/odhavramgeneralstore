/** Minimal ESC/POS helpers for 58/80mm Bluetooth thermal printers. */

const ESC = 0x1b;
const GS = 0x1d;

export function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function escInit(): Uint8Array {
  return new Uint8Array([ESC, 0x40]);
}

export function escAlign(align: "left" | "center" | "right"): Uint8Array {
  const n = align === "center" ? 1 : align === "right" ? 2 : 0;
  return new Uint8Array([ESC, 0x61, n]);
}

export function escBold(on: boolean): Uint8Array {
  return new Uint8Array([ESC, 0x45, on ? 1 : 0]);
}

/** ESC/POS GS ! n (Select character size: widthMult and heightMult 1..4) */
export function escTextSize(widthMult: 1 | 2 | 3 | 4 = 1, heightMult: 1 | 2 | 3 | 4 = 1): Uint8Array {
  const n = (((widthMult - 1) & 0x07) << 4) | ((heightMult - 1) & 0x07);
  return new Uint8Array([GS, 0x21, n]);
}

export function escFeed(lines = 1): Uint8Array {
  return new Uint8Array([ESC, 0x64, Math.max(0, Math.min(255, lines))]);
}

export function escCut(): Uint8Array {
  return new Uint8Array([GS, 0x56, 0x42, 0x00]);
}

export function escText(text: string): Uint8Array {
  const ascii = text
    .replace(/₹/g, "Rs ")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "?");
  const encoder = new TextEncoder();
  return concatBytes(encoder.encode(ascii), new Uint8Array([0x0a]));
}

export function escBarcodeHeight(px: number): Uint8Array {
  return new Uint8Array([GS, 0x68, Math.max(20, Math.min(160, px))]);
}

export function escBarcodeWidth(module: 2 | 3): Uint8Array {
  return new Uint8Array([GS, 0x77, module]);
}

export function escHriPosition(position: 0 | 1 | 2 | 3): Uint8Array {
  return new Uint8Array([GS, 0x48, position]);
}

/** CODE128 with Code B. Falls back cleanly on printers that ignore GS k. */
export function escCode128(value: string): Uint8Array {
  const payload = `{B${value}`;
  const data = new TextEncoder().encode(payload);
  const out = new Uint8Array(4 + data.length);
  out[0] = GS;
  out[1] = 0x6b;
  out[2] = 73;
  out[3] = data.length;
  out.set(data, 4);
  return out;
}

/**
 * GS v 0 raster bit image from a canvas (1-bit, white background).
 * Near-black pixels become ink. Padded to full bytes.
 */
export function canvasToEscPosRaster(canvas: HTMLCanvasElement, threshold = 128): Uint8Array {
  const ctx = canvas.getContext("2d");
  if (!ctx) return new Uint8Array();

  const width = canvas.width;
  const height = canvas.height;
  const image = ctx.getImageData(0, 0, width, height).data;
  const widthBytes = Math.ceil(width / 8);
  const raster = new Uint8Array(widthBytes * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const luminance = image[i] * 0.299 + image[i + 1] * 0.587 + image[i + 2] * 0.114;
      const ink = luminance < threshold && image[i + 3] > 128;
      if (ink) {
        raster[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }

  const header = new Uint8Array([
    GS,
    0x76,
    0x30,
    0x00,
    widthBytes & 0xff,
    (widthBytes >> 8) & 0xff,
    height & 0xff,
    (height >> 8) & 0xff,
  ]);
  return concatBytes(header, raster);
}

/**
 * Scales and centers a canvas onto the full printer dot width (e.g. 384 or 576 dots).
 * Filling with white ensures widthBytes is an exact line buffer match for ESC/POS GS v 0.
 */
export function scaleCanvasForPrinter(
  source: HTMLCanvasElement,
  maxWidthDots: number,
  centerOnLineWidth = true
): HTMLCanvasElement {
  const srcW = Math.max(1, source.width);
  const srcH = Math.max(1, source.height);
  const targetW = Math.min(maxWidthDots, srcW);
  const targetH = Math.max(1, Math.round((srcH * targetW) / srcW));
  const canvasW = centerOnLineWidth ? maxWidthDots : targetW;
  const out = document.createElement("canvas");
  out.width = canvasW;
  out.height = targetH;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasW, targetH);
  ctx.imageSmoothingEnabled = false;
  const offsetX = centerOnLineWidth ? Math.max(0, Math.floor((maxWidthDots - targetW) / 2)) : 0;
  ctx.drawImage(source, offsetX, 0, targetW, targetH);
  return out;
}

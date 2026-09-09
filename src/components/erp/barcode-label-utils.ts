import JsBarcode from "jsbarcode";
import type { BarcodeLabelConfig } from "@/types/erp";
import { DEFAULT_LABEL_CONFIG, PRINTER_PROFILES } from "@/services/erp/barcode-label.service";
import {
  PRINT_DENSITY_WEIGHT,
  PRINT_FONT_CSS,
} from "@/utils/print-style-shared";

export interface BarcodeLabelData {
  value: string;
  productName: string;
  shopName?: string;
  sku?: string;
  sellingPrice?: number;
  mrp?: number;
  mfgDate?: string;
  expiryDate?: string;
}

export const FONT_FAMILY_CSS = PRINT_FONT_CSS;

/** Integer module widths only. Fractional bars anti-alias and print as a solid black block. */
export const DENSITY_BAR_WIDTH = {
  light: 1,
  normal: 1,
  dark: 1,
} as const;

export function mmToPx(mm: number, dpi = 203): number {
  return Math.round((mm / 25.4) * dpi);
}

export function getBarcodeBarWidth(
  config: BarcodeLabelConfig,
  valueLength = 12
): number {
  const usablePx = Math.max(80, mmToPx(config.labelWidthMm) - 24);
  const estimatedModules = Math.max(80, valueLength * 11 + 40);
  if (config.paperType === "roll80" && estimatedModules * 2 <= usablePx) {
    return 2;
  }
  return 1;
}

export function getPageSize(config: BarcodeLabelConfig): { width: string; height: string } {
  if (config.paperType === "label") {
    return {
      width: `${config.labelWidthMm}mm`,
      height: `${config.labelHeightMm}mm`,
    };
  }
  if (config.paperType === "roll80") {
    return { width: "80mm", height: "auto" };
  }
  return { width: "58mm", height: "auto" };
}

export function getBarcodePrintCss(config: BarcodeLabelConfig): string {
  const profile = PRINTER_PROFILES[config.printerType];
  const fontFamily = FONT_FAMILY_CSS[config.fontFamily];
  const fontWeight = PRINT_DENSITY_WEIGHT[config.printDensity];
  const pageSize =
    config.paperType === "label"
      ? `${config.labelWidthMm}mm ${config.labelHeightMm}mm`
      : config.paperType === "roll80"
        ? "80mm auto"
        : "58mm auto";
  const rollWidth = config.paperType === "roll80" ? "80mm" : "58mm";
  const pageWidth =
    config.paperType === "label" ? `${config.labelWidthMm}mm` : rollWidth;

  return `
    @page {
      margin: 0;
      size: ${pageSize};
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    html {
      color-scheme: light;
      background: #fff;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: ${pageWidth};
      max-width: ${pageWidth};
      min-width: ${pageWidth};
      font-family: ${fontFamily};
      font-size: ${config.fontSize}px;
      color: #000;
      background: #fff !important;
    }
    body p,
    body span {
      font-weight: ${fontWeight};
    }
    .label-grid {
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
      align-items: center;
      gap: 2mm;
      width: ${pageWidth};
      max-width: ${pageWidth};
      padding: ${profile.marginMm}mm;
      background: #fff;
    }
    .thermal-label {
      box-sizing: border-box;
      page-break-inside: avoid;
      break-inside: avoid;
      width: ${config.labelWidthMm}mm;
      max-width: ${config.labelWidthMm}mm;
      min-height: ${config.labelHeightMm}mm;
      overflow: visible;
      background: #fff !important;
      color: #000;
      font-family: ${fontFamily};
    }
    .thermal-label p,
    .thermal-label span {
      font-family: ${fontFamily};
      color: #000;
    }
    .thermal-label img.barcode-img,
    .thermal-label canvas,
    .thermal-label svg {
      display: block;
      margin: 0 auto;
      width: auto !important;
      max-width: 100%;
      height: auto !important;
      background: #fff !important;
      image-rendering: pixelated;
      image-rendering: -moz-crisp-edges;
      image-rendering: crisp-edges;
      -ms-interpolation-mode: nearest-neighbor;
      filter: none !important;
    }
    @media print {
      html, body {
        margin: 0;
        padding: 0;
        width: ${pageWidth};
        max-width: ${pageWidth};
        background: #fff !important;
      }
      .label-grid { padding: ${profile.marginMm}mm; background: #fff; }
    }
  `;
}

export function resolveJsBarcodeFormat(
  format: BarcodeLabelConfig["format"],
  value: string
): string {
  if (format === "QR") return "CODE128";
  if (format === "EAN13" && /^\d{13}$/.test(value)) return "EAN13";
  if (format === "EAN8" && /^\d{8}$/.test(value)) return "EAN8";
  if (format === "UPC" && /^\d{12}$/.test(value)) return "UPC";
  return "CODE128";
}

export function getJsBarcodeOptions(config: BarcodeLabelConfig, value: string) {
  return {
    format: resolveJsBarcodeFormat(config.format, value),
    width: getBarcodeBarWidth(config, value.length),
    height: Math.max(32, config.barcodeHeight),
    displayValue: config.showBarcodeNumber,
    fontSize: config.fontSize,
    font: FONT_FAMILY_CSS[config.fontFamily].split(",")[0].replace(/"/g, ""),
    margin: 10,
    background: "#ffffff",
    lineColor: "#000000",
  };
}

/** Crisp barcode canvas for thermal print and Bluetooth (integer bar width). */
export function renderBarcodeToCanvas(
  value: string,
  config: BarcodeLabelConfig,
  maxWidthPx?: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const options = getJsBarcodeOptions(config, value);

  const draw = (moduleWidth: number, format?: string) => {
    JsBarcode(canvas, value, {
      ...options,
      format: format ?? options.format,
      width: moduleWidth,
    });
  };

  try {
    draw(options.width);
  } catch {
    draw(1, "CODE128");
  }

  if (maxWidthPx && canvas.width > maxWidthPx) {
    draw(1, options.format === "CODE128" ? "CODE128" : options.format);
  }
  if (maxWidthPx && canvas.width > maxWidthPx) {
    draw(1, "CODE128");
  }

  if (maxWidthPx && canvas.width > maxWidthPx) {
    const out = document.createElement("canvas");
    const scale = maxWidthPx / canvas.width;
    out.width = maxWidthPx;
    out.height = Math.max(1, Math.round(canvas.height * scale));
    const ctx = out.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, 0, 0, out.width, out.height);
      return out;
    }
  }

  return canvas;
}

export function barcodeValueToPngDataUrl(value: string, config: BarcodeLabelConfig): string {
  return renderBarcodeToCanvas(value, config).toDataURL("image/png");
}

function replaceNodeWithBarcodePng(
  node: Element,
  value: string,
  config: BarcodeLabelConfig
) {
  const img = document.createElement("img");
  img.src = barcodeValueToPngDataUrl(value, config);
  img.alt = value;
  img.className = "barcode-img";
  img.style.background = "#ffffff";
  node.replaceWith(img);
}

async function rasterizeLabelsForPrint(
  source: HTMLElement,
  config: BarcodeLabelConfig
): Promise<string> {
  const clone = source.cloneNode(true) as HTMLElement;
  const barcodeNodes = Array.from(
    clone.querySelectorAll("svg[data-barcode-value], canvas[data-barcode-value]")
  );
  for (const node of barcodeNodes) {
    const value = node.getAttribute("data-barcode-value")?.trim();
    if (!value) continue;
    try {
      replaceNodeWithBarcodePng(node, value, config);
    } catch {
      /* keep original */
    }
  }

  const leftoverCanvases = Array.from(clone.querySelectorAll("canvas"));
  for (const orig of leftoverCanvases) {
    try {
      const img = document.createElement("img");
      img.src = orig.toDataURL("image/png");
      img.alt = orig.getAttribute("data-barcode-value") || "barcode";
      img.className = "barcode-img";
      img.style.background = "#ffffff";
      orig.replaceWith(img);
    } catch {
      orig.remove();
    }
  }

  return clone.innerHTML;
}

function waitForDocumentImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  if (images.length === 0) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  ).then(() => undefined);
}

function buildPrintHtml(elementHtml: string, config: BarcodeLabelConfig, title: string) {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
    <style>${getBarcodePrintCss(config)}</style>
  </head>
  <body><div class="label-grid">${elementHtml}</div></body>
</html>`;
}

/** Direct thermal print — uses label/roll @page size, not A4. */
export async function printBarcodeLabelsFromElement(
  elementId: string,
  title: string,
  config: BarcodeLabelConfig
): Promise<boolean> {
  const el = document.getElementById(elementId);
  if (!el) return false;

  const bodyHtml = await rasterizeLabelsForPrint(el, config);
  const html = buildPrintHtml(bodyHtml, config, title);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = iframe.contentDocument ?? frameWindow?.document;
  if (!frameDoc || !frameWindow) {
    document.body.removeChild(iframe);
    return printBarcodePopup(bodyHtml, config, title);
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  await waitForDocumentImages(frameDoc);
  frameWindow.focus();
  frameWindow.print();
  setTimeout(cleanup, 1000);
  return true;
}

function printBarcodePopup(
  elementHtml: string,
  config: BarcodeLabelConfig,
  title: string
) {
  const w = window.open("", "_blank", "width=320,height=480");
  if (!w) return false;
  w.document.write(buildPrintHtml(elementHtml, config, title));
  w.document.close();
  w.focus();
  const trigger = async () => {
    await waitForDocumentImages(w.document);
    w.print();
    w.close();
  };
  void trigger();
  return true;
}

export function downloadBarcodePng(
  element: SVGSVGElement | HTMLCanvasElement,
  filename: string
) {
  const finish = (href: string) => {
    const link = document.createElement("a");
    link.download = filename;
    link.href = href;
    link.click();
  };

  if (element instanceof HTMLCanvasElement) {
    finish(element.toDataURL("image/png"));
    return;
  }

  const value = element.getAttribute("data-barcode-value");
  if (value) {
    finish(barcodeValueToPngDataUrl(value, DEFAULT_LABEL_CONFIG));
    return;
  }

  const svgData = new XMLSerializer().serializeToString(element);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  img.onload = () => {
    if (!ctx) return;
    canvas.width = img.width || 400;
    canvas.height = img.height || 120;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    finish(canvas.toDataURL("image/png"));
  };
  img.src = url;
}

export async function downloadBarcodePdf(
  elementId: string,
  title: string,
  config: BarcodeLabelConfig
) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const bodyHtml = await rasterizeLabelsForPrint(el, config);
  printBarcodePopup(bodyHtml, config, title);
}

export function buildLabelStyle(config: BarcodeLabelConfig): Record<string, string | number> {
  const widthPx = mmToPx(config.labelWidthMm);
  const minHeightPx = mmToPx(config.labelHeightMm);
  return {
    width: `${widthPx}px`,
    minHeight: `${minHeightPx}px`,
    fontSize: `${config.fontSize}px`,
    fontFamily: FONT_FAMILY_CSS[config.fontFamily],
    padding: "2mm",
    background: "#ffffff",
  };
}

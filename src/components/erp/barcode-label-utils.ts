import type { BarcodeLabelConfig, BarcodeFontFamily, PrintDensity } from "@/types/erp";
import { PRINTER_PROFILES } from "@/services/erp/barcode-label.service";
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

export const DENSITY_BAR_WIDTH: Record<PrintDensity, number> = {
  light: 1,
  normal: 1.6,
  dark: 2.4,
};

export function mmToPx(mm: number, dpi = 203): number {
  return Math.round((mm / 25.4) * dpi);
}

export function getBarcodeBarWidth(config: BarcodeLabelConfig): number {
  const base = DENSITY_BAR_WIDTH[config.printDensity];
  const printerBoost = config.printerType === "zebra" ? 1.1 : 1;
  return Math.round(base * printerBoost * 10) / 10;
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

  return `
    @page {
      margin: 0;
      size: ${pageSize};
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: ${config.paperType === "label" ? `${config.labelWidthMm}mm` : rollWidth};
      max-width: ${config.paperType === "label" ? `${config.labelWidthMm}mm` : rollWidth};
      min-width: ${config.paperType === "label" ? `${config.labelWidthMm}mm` : rollWidth};
      font-family: ${fontFamily};
      font-size: ${config.fontSize}px;
      font-weight: ${fontWeight};
      color: #000;
      background: #fff;
    }
    .label-grid {
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
      align-items: center;
      gap: 1mm;
      width: ${config.paperType === "label" ? `${config.labelWidthMm}mm` : rollWidth};
      max-width: ${config.paperType === "label" ? `${config.labelWidthMm}mm` : rollWidth};
      padding: ${profile.marginMm}mm;
    }
    .thermal-label {
      box-sizing: border-box;
      page-break-inside: avoid;
      break-inside: avoid;
      width: ${config.labelWidthMm}mm;
      max-width: ${config.labelWidthMm}mm;
      min-height: ${config.labelHeightMm}mm;
      overflow: hidden;
      background: #fff;
      color: #000;
      font-family: ${fontFamily};
    }
    .thermal-label p,
    .thermal-label span {
      font-family: ${fontFamily};
    }
    .thermal-label svg rect,
    .thermal-label svg line,
    .thermal-label svg text {
      fill: #000 !important;
      stroke: #000 !important;
      color: #000 !important;
    }
    @media print {
      html, body {
        margin: 0;
        padding: 0;
        width: ${config.paperType === "label" ? `${config.labelWidthMm}mm` : rollWidth};
        max-width: ${config.paperType === "label" ? `${config.labelWidthMm}mm` : rollWidth};
      }
      .label-grid { padding: ${profile.marginMm}mm; }
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
export function printBarcodeLabelsFromElement(
  elementId: string,
  title: string,
  config: BarcodeLabelConfig
) {
  const el = document.getElementById(elementId);
  if (!el) return false;

  const html = buildPrintHtml(el.innerHTML, config, title);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = iframe.contentDocument ?? frameWindow?.document;
  if (!frameDoc || !frameWindow) {
    document.body.removeChild(iframe);
    return printBarcodePopup(el.innerHTML, config, title);
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  const doPrint = () => {
    frameWindow.focus();
    frameWindow.print();
    setTimeout(cleanup, 1000);
  };

  if (frameDoc.readyState === "complete") {
    requestAnimationFrame(doPrint);
  } else {
    iframe.onload = doPrint;
  }

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
  w.onload = () => {
    w.print();
    w.close();
  };
  return true;
}

export function downloadBarcodePng(
  svgElement: SVGSVGElement,
  filename: string
) {
  const svgData = new XMLSerializer().serializeToString(svgElement);
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
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  img.src = url;
}

export function downloadBarcodePdf(
  elementId: string,
  title: string,
  config: BarcodeLabelConfig
) {
  const el = document.getElementById(elementId);
  if (!el) return;
  printBarcodePopup(el.innerHTML, config, title);
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
  };
}

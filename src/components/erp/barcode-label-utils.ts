import type { BarcodeFormat, BarcodeLabelConfig, ThermalPrinterType } from "@/types/erp";
import { PRINTER_PROFILES } from "@/services/erp/barcode-label.service";

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

export function mmToPx(mm: number, dpi = 203): number {
  return Math.round((mm / 25.4) * dpi);
}

export function getPrinterCss(printerType: ThermalPrinterType): string {
  const profile = PRINTER_PROFILES[printerType];
  return `
    @page { margin: ${profile.marginMm}mm; size: auto; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
    .label-grid { display: flex; flex-wrap: wrap; gap: 2mm; }
    .thermal-label { box-sizing: border-box; page-break-inside: avoid; }
  `;
}

export function resolveJsBarcodeFormat(
  format: BarcodeFormat,
  value: string
): string {
  if (format === "QR") return "CODE128";
  if (format === "EAN13" && /^\d{13}$/.test(value)) return "EAN13";
  if (format === "EAN8" && /^\d{8}$/.test(value)) return "EAN8";
  if (format === "UPC" && /^\d{12}$/.test(value)) return "UPC";
  return "CODE128";
}

export function printBarcodeLabelsFromElement(
  elementId: string,
  title: string,
  printerType: ThermalPrinterType
) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`
    <html><head><title>${title}</title>
    <style>${getPrinterCss(printerType)}</style>
    </head><body><div class="label-grid">${el.innerHTML}</div></body></html>
  `);
  w.document.close();
  w.focus();
  w.print();
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
  printerType: ThermalPrinterType
) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`
    <html><head><title>${title}</title>
    <style>${getPrinterCss(printerType)}</style>
    </head><body>
    <p style="font-size:12px;color:#666">Use browser Print → Save as PDF</p>
    <div class="label-grid">${el.innerHTML}</div>
    <script>window.onload=()=>window.print()</script>
    </body></html>
  `);
  w.document.close();
}

export function buildLabelStyle(config: BarcodeLabelConfig): Record<string, string | number> {
  const widthPx = mmToPx(config.labelWidthMm);
  const minHeightPx = mmToPx(config.labelHeightMm);
  return {
    width: `${widthPx}px`,
    minHeight: `${minHeightPx}px`,
    fontSize: `${config.fontSize}px`,
    padding: "2mm",
  };
}

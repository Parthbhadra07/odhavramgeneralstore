import type { BarcodeFontFamily, PrintDensity } from "@/types/erp";
import type { ReceiptWidth } from "@/utils/printer-prefs";
import { getSharedPrintPrefs } from "@/utils/barcode-printer-prefs";
import {
  PRINT_DENSITY_BORDER,
  PRINT_DENSITY_WEIGHT,
  PRINT_FONT_CSS,
  scaleReceiptFontSize,
} from "@/utils/print-style-shared";

export type { ReceiptWidth };

export interface ReceiptPrintOptions {
  width: ReceiptWidth;
  fontFamily: BarcodeFontFamily;
  printDensity: PrintDensity;
  baseFontSize: number;
}

export function getReceiptPrintOptions(width: ReceiptWidth = "80mm"): ReceiptPrintOptions {
  const shared = getSharedPrintPrefs();
  return {
    width,
    fontFamily: shared.fontFamily,
    printDensity: shared.printDensity,
    baseFontSize: shared.receiptFontSize,
  };
}

export interface ReceiptDimensions {
  width: ReceiptWidth;
  fontSize: string;
  storeTitleSize: string;
  grandTotalSize: string;
  qrSize: number;
  nameMaxLen: number;
  padding: string;
}

export function getReceiptDimensions(
  width: ReceiptWidth,
  opts?: ReceiptPrintOptions
): ReceiptDimensions {
  const options = opts ?? getReceiptPrintOptions(width);
  const base80 = options.baseFontSize;

  if (width === "52mm") {
    const base52 = Math.max(7, Math.round(base80 * 0.75));
    const fontSize = scaleReceiptFontSize(base52, options.printDensity);
    return {
      width: "52mm",
      fontSize,
      storeTitleSize: scaleReceiptFontSize(base52 + 2, options.printDensity),
      grandTotalSize: scaleReceiptFontSize(base52 + 3, options.printDensity),
      qrSize: 85,
      nameMaxLen: 12,
      padding: "4px",
    };
  }

  if (width === "58mm") {
    const base58 = Math.max(7, Math.round(base80 * 0.82));
    const fontSize = scaleReceiptFontSize(base58, options.printDensity);
    return {
      width: "58mm",
      fontSize,
      storeTitleSize: scaleReceiptFontSize(base58 + 3, options.printDensity),
      grandTotalSize: scaleReceiptFontSize(base58 + 4, options.printDensity),
      qrSize: 100,
      nameMaxLen: 14,
      padding: "6px",
    };
  }

  if (width === "64mm") {
    const base64 = Math.max(8, Math.round(base80 * 0.88));
    const fontSize = scaleReceiptFontSize(base64, options.printDensity);
    return {
      width: "64mm",
      fontSize,
      storeTitleSize: scaleReceiptFontSize(base64 + 3, options.printDensity),
      grandTotalSize: scaleReceiptFontSize(base64 + 4, options.printDensity),
      qrSize: 110,
      nameMaxLen: 16,
      padding: "6px",
    };
  }

  if (width === "88mm") {
    const base88 = Math.round(base80 * 1.05);
    const fontSize = scaleReceiptFontSize(base88, options.printDensity);
    return {
      width: "88mm",
      fontSize,
      storeTitleSize: scaleReceiptFontSize(base88 + 4, options.printDensity),
      grandTotalSize: scaleReceiptFontSize(base88 + 6, options.printDensity),
      qrSize: 145,
      nameMaxLen: 24,
      padding: "10px",
    };
  }

  // Default: 80mm
  const fontSize = scaleReceiptFontSize(base80, options.printDensity);
  return {
    width: "80mm",
    fontSize,
    storeTitleSize: scaleReceiptFontSize(base80 + 3, options.printDensity),
    grandTotalSize: scaleReceiptFontSize(base80 + 5, options.printDensity),
    qrSize: 130,
    nameMaxLen: 20,
    padding: "8px",
  };
}

/** Scoped CSS for on-screen preview only — does not affect the rest of the page. */
export function getReceiptPreviewStyles(
  width: ReceiptWidth,
  opts?: ReceiptPrintOptions
): string {
  const options = opts ?? getReceiptPrintOptions(width);
  const dim = getReceiptDimensions(width, options);
  const fontFamily = PRINT_FONT_CSS[options.fontFamily];
  const fontWeight = PRINT_DENSITY_WEIGHT[options.printDensity];
  const borderWidth = PRINT_DENSITY_BORDER[options.printDensity];
  const scope = ".receipt-preview-scope";
  return `
    ${scope} .receipt-container {
      width: ${width};
      max-width: ${width};
      min-width: ${width};
      font-family: ${fontFamily};
      font-size: ${dim.fontSize};
      font-weight: ${fontWeight};
      line-height: 1.4;
      box-sizing: border-box;
      background: #fff;
      color: #000;
      overflow: hidden;
    }
    ${scope} .receipt-container * {
      box-sizing: border-box;
    }
    ${scope} .receipt-container-border {
      border: ${borderWidth} solid #000;
      padding: ${dim.padding};
    }
    ${scope} .receipt-line {
      border-top: 1px dashed #000;
      margin: 6px 0;
      height: 0;
    }
    ${scope} .receipt-line-solid {
      border-top: 2px solid #000;
      margin: 6px 0;
      height: 0;
    }
    ${scope} .receipt-section-title {
      text-align: center;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.85em;
      letter-spacing: 0.05em;
      margin: 4px 0;
    }
    ${scope} .receipt-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    ${scope} .receipt-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 0.95em;
    }
    ${scope} .receipt-table th,
    ${scope} .receipt-table td {
      padding: 2px 0;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    ${scope} .receipt-table th:first-child,
    ${scope} .receipt-table td:first-child { text-align: left; padding-right: 4px; }
    ${scope} .receipt-table th:nth-child(2),
    ${scope} .receipt-table td:nth-child(2) { text-align: center; }
    ${scope} .receipt-table th:nth-child(3),
    ${scope} .receipt-table td:nth-child(3),
    ${scope} .receipt-table th:nth-child(4),
    ${scope} .receipt-table td:nth-child(4) { text-align: right; }
    ${scope} .receipt-table th { font-weight: 700; }
    ${scope} .receipt-logo {
      display: block;
      margin: 0 auto 8px;
      max-height: 48px;
      width: auto;
      object-fit: contain;
    }
    ${scope} .receipt-qr-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    ${scope} .receipt-qr-wrap img,
    ${scope} .receipt-qr-wrap canvas {
      display: block;
      width: ${dim.qrSize}px;
      height: ${dim.qrSize}px;
    }
  `;
}

/** CSS for the isolated print iframe/popup — thermal roll, not A4. */
export function getReceiptPrintStyles(
  width: ReceiptWidth,
  opts?: ReceiptPrintOptions
): string {
  const options = opts ?? getReceiptPrintOptions(width);
  const dim = getReceiptDimensions(width, options);
  const fontFamily = PRINT_FONT_CSS[options.fontFamily];
  const fontWeight = PRINT_DENSITY_WEIGHT[options.printDensity];
  const borderWidth = PRINT_DENSITY_BORDER[options.printDensity];
  const lineSolid = options.printDensity === "dark" ? "3px" : "2px";
  return `
    @page {
      size: ${width} auto;
      margin: 0mm;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${width} !important;
      max-width: ${width} !important;
      min-width: ${width} !important;
      background: #fff !important;
      color: #000 !important;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      color: #000 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: ${fontFamily};
      font-weight: ${fontWeight};
      color: #000;
      background: #fff;
      width: ${width};
      max-width: ${width};
    }
    .receipt-container {
      width: ${width};
      max-width: ${width};
      min-width: ${width};
      font-family: ${fontFamily};
      font-weight: ${fontWeight};
      font-size: ${dim.fontSize};
      line-height: 1.38;
      box-sizing: border-box;
      background: #fff;
      color: #000;
      overflow: hidden;
    }
    .receipt-container-border {
      border: ${borderWidth} solid #000;
      padding: ${dim.padding};
    }
    .receipt-line {
      border-top: 1px dashed #000;
      margin: 6px 0;
      height: 0;
    }
    .receipt-line-solid {
      border-top: ${lineSolid} solid #000;
      margin: 6px 0;
      height: 0;
    }
    .receipt-section-title {
      text-align: center;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.85em;
      letter-spacing: 0.05em;
      margin: 4px 0;
    }
    .receipt-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .receipt-center { text-align: center; }
    .receipt-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 0.95em;
    }
    .receipt-table th,
    .receipt-table td {
      padding: 2px 0;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .receipt-table th:first-child,
    .receipt-table td:first-child { text-align: left; padding-right: 4px; }
    .receipt-table th:nth-child(2),
    .receipt-table td:nth-child(2) { text-align: center; }
    .receipt-table th:nth-child(3),
    .receipt-table td:nth-child(3),
    .receipt-table th:nth-child(4),
    .receipt-table td:nth-child(4) { text-align: right; }
    .receipt-table th { font-weight: 700; }
    .receipt-logo {
      display: block;
      margin: 0 auto 8px;
      max-height: 48px;
      width: auto;
      object-fit: contain;
    }
    .receipt-qr-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .receipt-qr-wrap img,
    .receipt-qr-wrap canvas {
      display: block;
      width: ${dim.qrSize}px;
      height: ${dim.qrSize}px;
    }
    @media print {
      @page {
        size: ${width} auto;
        margin: 0mm;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: ${width} !important;
        max-width: ${width} !important;
        min-width: ${width} !important;
        background: #fff !important;
      }
      .receipt-container {
        width: ${width} !important;
        max-width: ${width} !important;
        min-width: ${width} !important;
        font-family: ${fontFamily};
        font-weight: ${fontWeight};
        box-sizing: border-box;
        border: none !important;
        padding: ${dim.padding} !important;
        margin: 0 auto !important;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .receipt-container-border {
        border: none !important;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `;
}

/** Clone receipt DOM for print — preserves inline styles and converts canvas QR to image. */
export function cloneReceiptHtml(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;

  const sourceCanvases = element.querySelectorAll("canvas");
  const cloneCanvases = clone.querySelectorAll("canvas");
  sourceCanvases.forEach((canvas, index) => {
    const target = cloneCanvases[index];
    if (!target) return;
    try {
      const img = document.createElement("img");
      img.src = canvas.toDataURL("image/png");
      img.alt = "UPI QR";
      img.style.width = canvas.style.width || `${canvas.width}px`;
      img.style.height = canvas.style.height || `${canvas.height}px`;
      img.style.display = "block";
      target.replaceWith(img);
    } catch {
      // canvas may be tainted — keep as-is
    }
  });

  return clone.outerHTML;
}

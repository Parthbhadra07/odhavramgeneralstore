export type ReceiptWidth = "58mm" | "80mm";

export interface ReceiptDimensions {
  width: ReceiptWidth;
  fontSize: string;
  storeTitleSize: string;
  grandTotalSize: string;
  qrSize: number;
  nameMaxLen: number;
  padding: string;
}

export function getReceiptDimensions(width: ReceiptWidth): ReceiptDimensions {
  if (width === "58mm") {
    return {
      width: "58mm",
      fontSize: "9px",
      storeTitleSize: "12px",
      grandTotalSize: "13px",
      qrSize: 100,
      nameMaxLen: 14,
      padding: "6px",
    };
  }
  return {
    width: "80mm",
    fontSize: "11px",
    storeTitleSize: "14px",
    grandTotalSize: "16px",
    qrSize: 130,
    nameMaxLen: 20,
    padding: "8px",
  };
}

/** Scoped CSS for on-screen preview only — does not affect the rest of the page. */
export function getReceiptPreviewStyles(width: ReceiptWidth): string {
  const dim = getReceiptDimensions(width);
  const scope = ".receipt-preview-scope";
  return `
    ${scope} .receipt-container {
      width: ${width};
      max-width: ${width};
      min-width: ${width};
      font-family: "Courier New", Courier, monospace;
      font-size: ${dim.fontSize};
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
      border: 2px solid #000;
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

/** CSS for the isolated print popup window only. */
export function getReceiptPrintStyles(width: ReceiptWidth): string {
  const dim = getReceiptDimensions(width);
  return `
    @page { margin: 0; size: ${width} auto; }
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
      font-family: "Courier New", Courier, monospace;
      color: #000;
      background: #fff;
    }
    .receipt-container {
      width: ${width};
      max-width: ${width};
      min-width: ${width};
      font-family: "Courier New", Courier, monospace;
      font-size: ${dim.fontSize};
      line-height: 1.4;
      box-sizing: border-box;
      background: #fff;
      color: #000;
      overflow: hidden;
    }
    .receipt-container-border {
      border: 2px solid #000;
      padding: ${dim.padding};
    }
    .receipt-line {
      border-top: 1px dashed #000;
      margin: 6px 0;
      height: 0;
    }
    .receipt-line-solid {
      border-top: 2px solid #000;
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
      body { margin: 0; padding: 0; }
      .receipt-container {
        width: ${width};
        max-width: ${width};
        min-width: ${width};
        font-family: "Courier New", Courier, monospace;
        box-sizing: border-box;
      }
      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
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

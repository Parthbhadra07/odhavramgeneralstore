"use client";

import { APP_NAME, STORE_ADDRESS, STORE_PHONE } from "@/lib/constants";
import { formatPrice, formatDate } from "@/utils/format";

export interface PrintMetaItem {
  label: string;
  value: string | number | undefined | null;
}

export interface PrintTableColumn {
  header: string;
  align?: "left" | "center" | "right";
  width?: string;
}

export interface PrintTableRow {
  cells: (string | number | undefined | null)[];
}

export interface PrintSummaryRow {
  label: string;
  value: string;
  isBold?: boolean;
  isHighlight?: boolean;
}

export interface PrintDocumentConfig {
  docTitle: string; // e.g. "TAX INVOICE", "PURCHASE VOUCHER / GRN", "SALES RETURN CREDIT NOTE"
  docBadge?: string; // e.g. "ORIGINAL FOR RECIPIENT", "ACCOUNTS COPY"
  docNumber?: string;
  docDate?: string;
  financialYear?: string;
  partyTitle?: string; // e.g. "Supplier Details" or "Customer Details"
  partyDetails?: {
    name?: string;
    mobile?: string;
    address?: string;
    gstin?: string;
    extra?: string;
  };
  metadata?: PrintMetaItem[];
  columns: PrintTableColumn[];
  rows: PrintTableRow[];
  summaryRows?: PrintSummaryRow[];
  notes?: string[];
  signatories?: string[]; // e.g. ["Prepared By", "Checked By", "Authorized Signatory"]
}

const DOCUMENT_PRINT_STYLES = `
  @page {
    size: A4 portrait;
    margin: 12mm 15mm 15mm 15mm;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #111827;
    background: #ffffff;
    font-size: 11px;
    line-height: 1.4;
    margin: 0;
    padding: 0;
  }
  .doc-container {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
  }
  .header-table {
    width: 100%;
    border-bottom: 2px solid #047857;
    padding-bottom: 10px;
    margin-bottom: 12px;
  }
  .store-title {
    font-size: 20px;
    font-weight: 800;
    color: #065f46;
    letter-spacing: -0.02em;
    margin: 0;
  }
  .store-sub {
    font-size: 10px;
    color: #4b5563;
    margin: 2px 0 0;
  }
  .doc-badge-box {
    text-align: right;
  }
  .doc-title {
    font-size: 15px;
    font-weight: 800;
    color: #111827;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }
  .doc-badge {
    display: inline-block;
    padding: 2px 8px;
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
    margin-top: 4px;
    text-transform: uppercase;
  }
  .meta-grid {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }
  .card-box {
    flex: 1;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 8px 10px;
    background: #f9fafb;
  }
  .card-title {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    color: #6b7280;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 3px;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    font-size: 10.5px;
    margin-bottom: 2px;
  }
  .info-label {
    color: #6b7280;
  }
  .info-value {
    font-weight: 600;
    color: #111827;
  }
  table.items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 14px;
  }
  table.items-table th {
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    padding: 6px 8px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: #374151;
  }
  table.items-table td {
    border: 1px solid #e5e7eb;
    padding: 5px 8px;
    font-size: 10.5px;
    color: #1f2937;
  }
  table.items-table tr:nth-child(even) td {
    background: #fbfbfb;
  }
  .summary-section {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-top: 10px;
    margin-bottom: 20px;
  }
  .notes-box {
    flex: 1;
    font-size: 9.5px;
    color: #6b7280;
    border-left: 2px solid #10b981;
    padding-left: 8px;
  }
  .summary-table {
    width: 260px;
    border-collapse: collapse;
    border: 1px solid #d1d5db;
    background: #ffffff;
    border-radius: 4px;
  }
  .summary-table td {
    padding: 4px 8px;
    font-size: 10.5px;
    border-bottom: 1px solid #e5e7eb;
  }
  .summary-table tr.highlight td {
    background: #ecfdf5;
    font-weight: 700;
    color: #065f46;
    font-size: 12px;
    border-top: 2px solid #047857;
  }
  .sign-grid {
    display: flex;
    justify-content: space-between;
    margin-top: 40px;
    padding-top: 10px;
  }
  .sign-item {
    text-align: center;
    width: 160px;
    border-top: 1px dashed #9ca3af;
    padding-top: 6px;
    font-size: 9.5px;
    color: #4b5563;
    font-weight: 600;
  }
  .footer-note {
    text-align: center;
    margin-top: 24px;
    font-size: 9px;
    color: #9ca3af;
    border-top: 1px solid #f3f4f6;
    padding-top: 8px;
  }
`;

export function printSystematicDocument(config: PrintDocumentConfig, title = "Document"): boolean {
  if (typeof window === "undefined") return false;

  const metadataHtml = (config.metadata || [])
    .map(
      (m) => `
      <div class="info-row">
        <span class="info-label">${m.label}:</span>
        <span class="info-value">${m.value ?? "—"}</span>
      </div>`
    )
    .join("");

  const partyHtml = config.partyDetails
    ? `
      <div class="card-box">
        <div class="card-title">${config.partyTitle || "Party Details"}</div>
        <div style="font-weight:700;font-size:11px;color:#111827">${config.partyDetails.name || "Walk-in Party"}</div>
        ${config.partyDetails.mobile ? `<div style="font-size:10px;color:#4b5563">Phone: ${config.partyDetails.mobile}</div>` : ""}
        ${config.partyDetails.address ? `<div style="font-size:10px;color:#4b5563">${config.partyDetails.address}</div>` : ""}
        ${config.partyDetails.gstin ? `<div style="font-size:10px;color:#4b5563;font-family:monospace">GSTIN: ${config.partyDetails.gstin}</div>` : ""}
        ${config.partyDetails.extra ? `<div style="font-size:10px;color:#047857">${config.partyDetails.extra}</div>` : ""}
      </div>`
    : "";

  const thHtml = config.columns
    .map(
      (col) => `
      <th style="text-align:${col.align || "left"}${col.width ? `;width:${col.width}` : ""}">
        ${col.header}
      </th>`
    )
    .join("");

  const trsHtml = config.rows
    .map(
      (row) => `
      <tr>
        ${row.cells
          .map((cell, idx) => {
            const col = config.columns[idx];
            const align = col?.align || "left";
            return `<td style="text-align:${align}">${cell ?? "—"}</td>`;
          })
          .join("")}
      </tr>`
    )
    .join("");

  const summaryHtml = (config.summaryRows || [])
    .map(
      (s) => `
      <tr class="${s.isHighlight ? "highlight" : ""}">
        <td style="${s.isBold ? "font-weight:bold" : ""}">${s.label}</td>
        <td style="text-align:right;${s.isBold ? "font-weight:bold" : ""}">${s.value}</td>
      </tr>`
    )
    .join("");

  const notesHtml = (config.notes || [
    "This is an electronically generated accounting voucher / report from Odhavram General Store ERP.",
    "Goods once received in good condition shall be acknowledged as per purchase / sales terms.",
  ])
    .map((n) => `<div>• ${n}</div>`)
    .join("");

  const signatories = config.signatories || [
    "Prepared By",
    "Verified / Storekeeper",
    "Authorized Signatory",
  ];
  const signHtml = signatories
    .map((s) => `<div class="sign-item">${s}</div>`)
    .join("");

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>${DOCUMENT_PRINT_STYLES}</style>
  </head>
  <body>
    <div class="doc-container">
      <!-- Store Header -->
      <table class="header-table" style="border:0">
        <tr>
          <td style="vertical-align:top">
            <h1 class="store-title">${APP_NAME}</h1>
            <p class="store-sub">${STORE_ADDRESS}</p>
            <p class="store-sub">Contact: ${STORE_PHONE} • Daily Fresh Grocery &amp; Provisions</p>
          </td>
          <td class="doc-badge-box" style="vertical-align:top">
            <div class="doc-title">${config.docTitle}</div>
            ${config.docBadge ? `<div class="doc-badge">${config.docBadge}</div>` : ""}
            ${config.financialYear ? `<div style="font-size:9.5px;color:#6b7280;margin-top:2px">Financial Year: ${config.financialYear}</div>` : ""}
          </td>
        </tr>
      </table>

      <!-- Meta Grid -->
      <div class="meta-grid">
        ${partyHtml}
        <div class="card-box">
          <div class="card-title">Voucher &amp; Document Info</div>
          ${config.docNumber ? `<div class="info-row"><span class="info-label">Voucher / Doc #:</span><span class="info-value" style="font-family:monospace">${config.docNumber}</span></div>` : ""}
          ${config.docDate ? `<div class="info-row"><span class="info-label">Date:</span><span class="info-value">${config.docDate}</span></div>` : ""}
          ${metadataHtml}
        </div>
      </div>

      <!-- Items Table -->
      <table class="items-table">
        <thead>
          <tr>${thHtml}</tr>
        </thead>
        <tbody>
          ${trsHtml || `<tr><td colspan="${config.columns.length}" style="text-align:center;padding:12px;color:#6b7280">No entries recorded</td></tr>`}
        </tbody>
      </table>

      <!-- Summary & Notes -->
      <div class="summary-section">
        <div class="notes-box">
          <strong style="color:#374151">Terms &amp; Notes:</strong>
          ${notesHtml}
        </div>
        ${
          config.summaryRows && config.summaryRows.length > 0
            ? `<table class="summary-table"><tbody>${summaryHtml}</tbody></table>`
            : ""
        }
      </div>

      <!-- Signatures -->
      <div class="sign-grid">
        ${signHtml}
      </div>

      <!-- Footer Note -->
      <div class="footer-note">
        Printed on ${new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })} at ${new Date().toLocaleTimeString("en-IN", { timeStyle: "short" })} • System Reference: ${APP_NAME} ERP Core
      </div>
    </div>
  </body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;left:0;top:0;width:100%;height:100vh;border:0;opacity:0;pointer-events:none;z-index:-1;";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = iframe.contentDocument ?? frameWindow?.document;
  if (!frameDoc || !frameWindow) {
    document.body.removeChild(iframe);
    const win = window.open("", "_blank");
    if (!win) return false;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    return true;
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
    setTimeout(cleanup, 1200);
  };

  if (frameDoc.readyState === "complete") {
    requestAnimationFrame(doPrint);
  } else {
    iframe.onload = doPrint;
  }

  return true;
}

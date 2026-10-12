"use client";

import { format } from "date-fns";
import type { Customer, StoreSettings, CreditLedgerEntry, PosSale } from "@/types/erp";
import { formatPrice } from "@/utils/format";
import { isMobileDevice, executeMobilePrint } from "@/utils/mobile-print";

interface SummaryReportOptions {
  settings: StoreSettings | null;
  customer: Customer;
  entries: CreditLedgerEntry[];
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  dateRangeLabel: string;
}

interface DetailedReportOptions {
  settings: StoreSettings | null;
  customer: Customer;
  sales: PosSale[];
  creditEntries: CreditLedgerEntry[];
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  dateRangeLabel: string;
}

const KHATA_PRINT_BASE_STYLES = `
  @page {
    size: A4 portrait;
    margin: 10mm 12mm 12mm 12mm;
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
    line-height: 1.35;
    margin: 0;
    padding: 0;
  }
  .container {
    width: 100%;
    max-width: 820px;
    margin: 0 auto;
  }
  .header-card {
    border-bottom: 2px solid #1e3a8a;
    padding-bottom: 8px;
    margin-bottom: 10px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .store-name {
    font-size: 20px;
    font-weight: 900;
    color: #1e3a8a;
    letter-spacing: -0.02em;
    margin: 0;
    text-transform: uppercase;
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
    font-size: 14px;
    font-weight: 900;
    color: #111827;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin: 0;
  }
  .doc-type-badge {
    display: inline-block;
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
    font-size: 9px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 4px;
    margin-top: 3px;
    text-transform: uppercase;
  }
  .meta-grid {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 10px;
    margin-bottom: 12px;
  }
  .party-box, .period-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 10px;
  }
  .box-label {
    font-size: 9px;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }
  .party-name {
    font-size: 13px;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 2px;
    text-transform: uppercase;
  }
  .info-line {
    font-size: 10px;
    color: #334155;
    margin: 1px 0;
  }
  .stats-strip {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .stat-box {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 6px 8px;
    text-align: center;
  }
  .stat-box.highlight {
    background: #fef2f2;
    border-color: #f87171;
  }
  .stat-box.highlight-blue {
    background: #eff6ff;
    border-color: #93c5fd;
  }
  .stat-box.highlight-green {
    background: #f0fdf4;
    border-color: #86efac;
  }
  .stat-lbl {
    font-size: 9px;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
  }
  .stat-val {
    font-size: 13px;
    font-weight: 900;
    color: #0f172a;
    margin-top: 1px;
  }
  .stat-val.red { color: #b91c1c; }
  .stat-val.blue { color: #1d4ed8; }
  .stat-val.green { color: #15803d; }

  /* Tables */
  .report-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
    font-size: 10px;
  }
  .report-table th {
    background: #f1f5f9;
    color: #1e293b;
    font-weight: 800;
    text-transform: uppercase;
    font-size: 9px;
    padding: 6px 6px;
    border: 1px solid #cbd5e1;
    text-align: left;
  }
  .report-table td {
    padding: 5px 6px;
    border: 1px solid #e2e8f0;
    color: #1e293b;
  }
  .report-table tr:nth-child(even) td {
    background: #f8fafc;
  }
  .report-table .totals-row td {
    background: #e2e8f0 !important;
    font-weight: 900;
    border-top: 2px solid #0f172a;
    border-bottom: 2px solid #0f172a;
    color: #0f172a;
  }

  /* Detailed Bill Card */
  .bill-card {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    margin-bottom: 10px;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .bill-head {
    background: #f1f5f9;
    padding: 5px 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #cbd5e1;
    font-size: 10px;
    font-weight: 800;
  }
  .bill-items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5px;
  }
  .bill-items-table th {
    background: #f8fafc;
    border-bottom: 1px solid #cbd5e1;
    padding: 4px 6px;
    text-align: left;
    font-weight: 800;
    font-size: 8.5px;
    color: #475569;
    text-transform: uppercase;
  }
  .bill-items-table td {
    padding: 3.5px 6px;
    border-bottom: 1px solid #f1f5f9;
  }
  .bill-summary-bar {
    background: #f8fafc;
    border-top: 1px solid #cbd5e1;
    padding: 4px 8px;
    display: flex;
    justify-content: space-between;
    font-size: 9.5px;
    font-weight: 700;
  }

  /* Payment Card */
  .payment-card {
    border: 1px solid #86efac;
    background: #f0fdf4;
    border-radius: 6px;
    padding: 6px 10px;
    margin-bottom: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    page-break-inside: avoid;
  }

  /* Signatures */
  .footer-grid {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 12px;
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid #cbd5e1;
    page-break-inside: avoid;
  }
  .bank-box {
    font-size: 9.5px;
    color: #334155;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 6px 8px;
  }
  .sig-block {
    display: flex;
    justify-content: space-between;
    gap: 15px;
  }
  .sig-line {
    flex: 1;
    text-align: center;
    border-top: 1px solid #0f172a;
    padding-top: 4px;
    font-size: 9.5px;
    font-weight: 800;
    margin-top: 28px;
  }
`;

function triggerPrintHtml(html: string, docTitle: string): boolean {
  if (isMobileDevice()) {
    return executeMobilePrint(html, "", docTitle);
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:0;top:0;width:100%;height:100vh;border:0;opacity:0;pointer-events:none;z-index:-1;";
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

/**
 * 1. Summary Statement: Displays Bill Totals Only
 */
export function printKhataSummaryReport(options: SummaryReportOptions) {
  const {
    settings,
    customer,
    entries,
    openingBalance,
    closingBalance,
    totalDebits,
    totalCredits,
    dateRangeLabel,
  } = options;

  const storeName = settings?.store_name || "ODHAVRAM GENERAL STORE";
  const storeAddress = settings?.store_address || "Opp. Station, Main Market, Vapi, Gujarat";
  const storePhone = settings?.store_phone || settings?.store_mobile || "9825123456";
  const storeGst = settings?.gst_number || "24AAACR1234B1Z5";

  const rowsHtml = entries
    .map((e, idx) => {
      const d = format(new Date(e.date), "dd/MM/yyyy");
      const ref = e.referenceType === "pos_sale" ? (e.description.match(/(?:POS|Bill|CDM)[\w/-]+/i)?.[0] || e.description) : (e.description || "Voucher");
      const mode = e.paymentMethod ? e.paymentMethod.toUpperCase() : e.type === "credit" ? "CREDIT" : "CASH/ONLINE";
      const debitText = e.debit > 0 ? formatPrice(e.debit) : "—";
      const creditText = e.credit > 0 ? formatPrice(e.credit) : "—";
      const balText = formatPrice(Math.abs(e.runningBalance)) + (e.runningBalance > 0 ? " Dr" : e.runningBalance < 0 ? " Cr" : "");

      return `
        <tr>
          <td style="text-align:center; color:#64748b; font-family:monospace;">${idx + 1}</td>
          <td><b>${d}</b></td>
          <td style="font-family:monospace; font-weight:700;">${ref}</td>
          <td>${e.description} ${e.notes ? `<span style="color:#64748b;">(${e.notes})</span>` : ""}</td>
          <td><span style="display:inline-block; padding:1px 5px; font-size:8.5px; border-radius:3px; font-weight:700; ${e.debit > 0 ? "background:#fee2e2; color:#991b1b;" : "background:#dcfce7; color:#166534;"}">${mode}</span></td>
          <td style="text-align:right; font-weight:700; color:#b91c1c;">${debitText}</td>
          <td style="text-align:right; font-weight:700; color:#15803d;">${creditText}</td>
          <td style="text-align:right; font-weight:800; font-family:monospace;">${balText}</td>
        </tr>
      `;
    })
    .join("");

  const html = `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>Khata Statement (Summary) - ${customer.name}</title>
    <style>${KHATA_PRINT_BASE_STYLES}</style>
  </head>
  <body>
    <div class="container">
      <div class="header-card">
        <div>
          <h1 class="store-name">${storeName}</h1>
          <p class="store-sub">${storeAddress} &bull; Ph: ${storePhone} &bull; GSTIN: <b>${storeGst}</b></p>
        </div>
        <div class="doc-badge-box">
          <h2 class="doc-title">Party Khata Statement</h2>
          <span class="doc-type-badge">Bill Totals Summary</span>
        </div>
      </div>

      <div class="meta-grid">
        <div class="party-box">
          <div class="box-label">Party Details</div>
          <h3 class="party-name">${customer.name}</h3>
          <p class="info-line">Mobile: <b>${customer.mobile}</b> &bull; GSTIN: <b>${customer.gst_number || "Unregistered"}</b></p>
          <p class="info-line">Address: ${customer.address || "—"}</p>
          <p class="info-line">Credit Limit: <b>${customer.credit_limit && customer.credit_limit > 0 ? formatPrice(customer.credit_limit) : "No Limit Set"}</b> &bull; Status: <b>${(customer.account_status || "Active").toUpperCase()}</b></p>
        </div>
        <div class="period-box">
          <div class="box-label">Statement Parameters</div>
          <p class="info-line">Period: <b>${dateRangeLabel}</b></p>
          <p class="info-line">Generated On: <b>${format(new Date(), "dd/MM/yyyy hh:mm a")}</b></p>
          <p class="info-line">Total Transactions: <b>${entries.length} Entries</b></p>
        </div>
      </div>

      <div class="stats-strip">
        <div class="stat-box">
          <div class="stat-lbl">Opening Balance</div>
          <div class="stat-val">${formatPrice(Math.abs(openingBalance))} ${openingBalance > 0 ? "Dr" : openingBalance < 0 ? "Cr" : ""}</div>
        </div>
        <div class="stat-box highlight">
          <div class="stat-lbl">Total Bills (Debits)</div>
          <div class="stat-val red">${formatPrice(totalDebits)}</div>
        </div>
        <div class="stat-box highlight-green">
          <div class="stat-lbl">Total Paid (Credits)</div>
          <div class="stat-val green">${formatPrice(totalCredits)}</div>
        </div>
        <div class="stat-box ${closingBalance > 0 ? "highlight" : "highlight-blue"}">
          <div class="stat-lbl">Closing Net Balance</div>
          <div class="stat-val ${closingBalance > 0 ? "red" : "blue"}">${closingBalance > 0 ? "You'll Get " : closingBalance < 0 ? "You'll Give " : ""}${formatPrice(Math.abs(closingBalance))}</div>
        </div>
      </div>

      <table class="report-table">
        <thead>
          <tr>
            <th style="width:5%; text-align:center;">#</th>
            <th style="width:11%;">Date</th>
            <th style="width:18%;">Bill / Ref #</th>
            <th style="width:26%;">Particulars</th>
            <th style="width:12%;">Payment Mode</th>
            <th style="width:13%; text-align:right;">Bill Total (Dr)</th>
            <th style="width:13%; text-align:right;">Paid (Cr)</th>
            <th style="width:15%; text-align:right;">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="8" style="text-align:center; padding:15px; color:#64748b;">No transaction entries recorded for the selected period.</td></tr>`}
          <tr class="totals-row">
            <td colspan="5" style="text-align:right;">PERIOD GRAND TOTALS:</td>
            <td style="text-align:right; color:#b91c1c;">${formatPrice(totalDebits)}</td>
            <td style="text-align:right; color:#15803d;">${formatPrice(totalCredits)}</td>
            <td style="text-align:right; font-size:11px;">${formatPrice(Math.abs(closingBalance))} ${closingBalance > 0 ? "Dr" : closingBalance < 0 ? "Cr" : ""}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer-grid">
        <div class="bank-box">
          <b>Store Bank Account (For Remittance):</b><br/>
          Bank: <b>${settings?.bank_name || "TAMILNAD MERCANTILE BANK LTD"}</b> &bull; A/C: <b>${settings?.bank_account_no || "391700050900006"}</b><br/>
          IFSC: <b>${settings?.bank_ifsc || "TMBL0000391"}</b> &bull; Branch: ${settings?.bank_branch || "Main Branch"}<br/>
          <span style="font-size:8.5px; color:#64748b;">Please intimate payment ref / UTR after online remittance.</span>
        </div>
        <div class="sig-block">
          <div class="sig-line">Party / Receiver Sign</div>
          <div class="sig-line">For ${storeName}</div>
        </div>
      </div>
    </div>
  </body>
  </html>`;

  return triggerPrintHtml(html, `Khata-Summary-${customer.mobile}`);
}

/**
 * 2. Detailed Report: Includes Itemized Product Details for Bills
 */
export function printKhataDetailedReport(options: DetailedReportOptions) {
  const {
    settings,
    customer,
    sales,
    creditEntries,
    openingBalance,
    closingBalance,
    totalDebits,
    totalCredits,
    dateRangeLabel,
  } = options;

  const storeName = settings?.store_name || "ODHAVRAM GENERAL STORE";
  const storeAddress = settings?.store_address || "Opp. Station, Main Market, Vapi, Gujarat";
  const storePhone = settings?.store_phone || settings?.store_mobile || "9825123456";
  const storeGst = settings?.gst_number || "24AAACR1234B1Z5";

  // Build unified chronological list of events (sales and payments)
  const salesMap = new Map<string, PosSale>();
  sales.forEach((s) => {
    salesMap.set(s.id, s);
  });

  // Render sales with items
  const salesBlocksHtml = sales
    .map((s) => {
      const d = format(new Date(s.created_at), "dd/MM/yyyy hh:mm a");
      const items = s.pos_sale_items ?? [];
      const subtotal = Number(s.subtotal) || 0;
      const gstAmt = Number(s.cgst || 0) + Number(s.sgst || 0) + Number(s.igst || 0);
      const discount = Number(s.discount) || 0;
      const net = Number(s.total_amount) || 0;

      const itemRows = items
        .map((it, idx) => {
          const rate = Number(it.rate) || 0;
          const qty = Number(it.quantity) || 0;
          const gst = Number(it.gst_percentage) || 0;
          const itTax = Number(it.gst_amount) || 0;
          const total = Number(it.total_amount) || 0;

          return `
            <tr>
              <td style="text-align:center; font-family:monospace; color:#64748b;">${idx + 1}</td>
              <td style="font-weight:700;">${it.product_name}</td>
              <td style="text-align:center; font-weight:800;">${qty} ${it.unit || "pcs"}</td>
              <td style="text-align:right;">${formatPrice(rate)}</td>
              <td style="text-align:center;"><span style="font-size:8.5px; background:#eff6ff; padding:1px 4px; border-radius:3px; font-weight:700;">${gst}%</span></td>
              <td style="text-align:right;">${formatPrice(itTax)}</td>
              <td style="text-align:right; font-weight:800; color:#0f172a;">${formatPrice(total)}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <div class="bill-card">
          <div class="bill-head">
            <div>
              <span style="font-family:monospace; font-size:11px; color:#1e3a8a;">INVOICE: <b>${s.bill_number}</b></span>
              <span style="color:#64748b; margin-left:8px;">Date: <b>${d}</b></span>
            </div>
            <div>
              <span style="font-size:9px; background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:3px; text-transform:uppercase; font-weight:800;">${s.payment_method.toUpperCase()}</span>
              <span style="font-size:11px; color:#0f172a; margin-left:8px;">Bill Total: <b>${formatPrice(net)}</b></span>
            </div>
          </div>
          <table class="bill-items-table">
            <thead>
              <tr>
                <th style="width:5%; text-align:center;">#</th>
                <th style="width:40%;">Product Particulars</th>
                <th style="width:14%; text-align:center;">Qty & Unit</th>
                <th style="width:13%; text-align:right;">Rate (₹)</th>
                <th style="width:10%; text-align:center;">GST %</th>
                <th style="width:10%; text-align:right;">GST (₹)</th>
                <th style="width:14%; text-align:right;">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows || `<tr><td colspan="7" style="text-align:center; color:#64748b; padding:8px;">No line items recorded for this invoice</td></tr>`}
            </tbody>
          </table>
          <div class="bill-summary-bar">
            <span>Taxable: <b>${formatPrice(subtotal)}</b> &bull; GST Tax: <b>${formatPrice(gstAmt)}</b> ${discount > 0 ? `&bull; Disc: <b>-${formatPrice(discount)}</b>` : ""}</span>
            <span style="font-size:10.5px; color:#1e3a8a;">NET INVOICE TOTAL: <b>${formatPrice(net)}</b></span>
          </div>
        </div>
      `;
    })
    .join("");

  // Render payments and vouchers
  const paymentsHtml = creditEntries
    .filter((e) => e.type === "payment" || e.credit > 0)
    .map((p) => {
      const d = format(new Date(p.date), "dd/MM/yyyy");
      const mode = p.paymentMethod ? p.paymentMethod.toUpperCase() : "CASH / BANK";
      return `
        <div class="payment-card">
          <div>
            <span style="color:#15803d; font-weight:800; font-size:10.5px;">✓ PAYMENT COLLECTED: ${formatPrice(p.credit)}</span>
            <span style="color:#334155; margin-left:8px;">Date: <b>${d}</b> &bull; Mode: <b>${mode}</b></span>
            ${p.notes ? `<span style="color:#64748b; margin-left:6px;">(${p.notes})</span>` : ""}
          </div>
          <div style="font-weight:800; font-family:monospace; color:#15803d;">
            Balance after payment: ${formatPrice(Math.abs(p.runningBalance))} ${p.runningBalance > 0 ? "Dr" : p.runningBalance < 0 ? "Cr" : "Settled"}
          </div>
        </div>
      `;
    })
    .join("");

  const totalItemsCount = sales.reduce((sum, s) => sum + (s.pos_sale_items?.length || 0), 0);

  const html = `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>Detailed Khata & Product Statement - ${customer.name}</title>
    <style>${KHATA_PRINT_BASE_STYLES}</style>
  </head>
  <body>
    <div class="container">
      <div class="header-card">
        <div>
          <h1 class="store-name">${storeName}</h1>
          <p class="store-sub">${storeAddress} &bull; Ph: ${storePhone} &bull; GSTIN: <b>${storeGst}</b></p>
        </div>
        <div class="doc-badge-box">
          <h2 class="doc-title">Detailed Khata Statement</h2>
          <span class="doc-type-badge" style="background:#fef3c7; color:#92400e; border-color:#fde68a;">With Itemized Products</span>
        </div>
      </div>

      <div class="meta-grid">
        <div class="party-box">
          <div class="box-label">Party Details</div>
          <h3 class="party-name">${customer.name}</h3>
          <p class="info-line">Mobile: <b>${customer.mobile}</b> &bull; GSTIN: <b>${customer.gst_number || "Unregistered"}</b></p>
          <p class="info-line">Address: ${customer.address || "—"}</p>
          <p class="info-line">Credit Limit: <b>${customer.credit_limit && customer.credit_limit > 0 ? formatPrice(customer.credit_limit) : "No Limit Set"}</b> &bull; Status: <b>${(customer.account_status || "Active").toUpperCase()}</b></p>
        </div>
        <div class="period-box">
          <div class="box-label">Statement Parameters</div>
          <p class="info-line">Period: <b>${dateRangeLabel}</b></p>
          <p class="info-line">Generated On: <b>${format(new Date(), "dd/MM/yyyy hh:mm a")}</b></p>
          <p class="info-line">Total Invoices: <b>${sales.length} Bills (${totalItemsCount} Products)</b></p>
        </div>
      </div>

      <div class="stats-strip">
        <div class="stat-box">
          <div class="stat-lbl">Opening Balance</div>
          <div class="stat-val">${formatPrice(Math.abs(openingBalance))} ${openingBalance > 0 ? "Dr" : openingBalance < 0 ? "Cr" : ""}</div>
        </div>
        <div class="stat-box highlight">
          <div class="stat-lbl">Total Invoiced (Debits)</div>
          <div class="stat-val red">${formatPrice(totalDebits)}</div>
        </div>
        <div class="stat-box highlight-green">
          <div class="stat-lbl">Total Paid (Credits)</div>
          <div class="stat-val green">${formatPrice(totalCredits)}</div>
        </div>
        <div class="stat-box ${closingBalance > 0 ? "highlight" : "highlight-blue"}">
          <div class="stat-lbl">Closing Due Balance</div>
          <div class="stat-val ${closingBalance > 0 ? "red" : "blue"}">${closingBalance > 0 ? "You'll Get " : closingBalance < 0 ? "You'll Give " : ""}${formatPrice(Math.abs(closingBalance))}</div>
        </div>
      </div>

      <!-- Invoices Breakdown with Products -->
      <div style="margin-bottom:12px;">
        <div style="font-size:11px; font-weight:900; color:#1e3a8a; text-transform:uppercase; margin-bottom:6px; letter-spacing:0.04em; border-bottom:1px solid #93c5fd; padding-bottom:3px;">
          1. Invoices &amp; Product Particulars (${sales.length} Invoices)
        </div>
        ${salesBlocksHtml || `<p style="font-size:10px; color:#64748b; padding:8px;">No bill invoices recorded for this period.</p>`}
      </div>

      <!-- Payments & Receipts -->
      ${paymentsHtml ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:11px; font-weight:900; color:#166534; text-transform:uppercase; margin-bottom:6px; letter-spacing:0.04em; border-bottom:1px solid #86efac; padding-bottom:3px;">
            2. Payment Receipts &amp; Collections
          </div>
          ${paymentsHtml}
        </div>
      ` : ""}

      <div class="footer-grid">
        <div class="bank-box">
          <b>Store Bank Account (For Remittance):</b><br/>
          Bank: <b>${settings?.bank_name || "TAMILNAD MERCANTILE BANK LTD"}</b> &bull; A/C: <b>${settings?.bank_account_no || "391700050900006"}</b><br/>
          IFSC: <b>${settings?.bank_ifsc || "TMBL0000391"}</b> &bull; Branch: ${settings?.bank_branch || "Main Branch"}<br/>
          <span style="font-size:8.5px; color:#64748b;">All disputes subject to local jurisdiction. Goods once sold will not be accepted.</span>
        </div>
        <div class="sig-block">
          <div class="sig-line">Party / Receiver Sign</div>
          <div class="sig-line">For ${storeName}</div>
        </div>
      </div>
    </div>
  </body>
  </html>`;

  return triggerPrintHtml(html, `Khata-Detailed-${customer.mobile}`);
}

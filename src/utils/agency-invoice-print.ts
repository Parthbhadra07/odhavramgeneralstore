"use client";

import type { PosSale, StoreSettings } from "@/types/erp";
import { formatPrice } from "@/utils/format";
import { APP_NAME, STORE_ADDRESS, STORE_PHONE } from "@/lib/constants";

/**
 * Converts numbers to Indian English currency words (e.g. 4868 -> Four Thousand Eight Hundred Sixty Eight Only)
 */
export function numberToIndianWords(num: number): string {
  const rounded = Math.round(Number(num) * 100) / 100;
  if (isNaN(rounded) || rounded === 0) return "Zero Only";

  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eightteen",
    "Nineteen",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertTwoDigits(n: number): string {
    if (n < 20) return a[n];
    return `${b[Math.floor(n / 10)]} ${a[n % 10]}`.trim();
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let str = "";
    if (hundred > 0) {
      str += `${a[hundred]} Hundred `;
    }
    if (rest > 0) {
      str += convertTwoDigits(rest);
    }
    return str.trim();
  }

  const intPart = Math.floor(rounded);
  const paise = Math.round((rounded - intPart) * 100);

  let remaining = intPart;
  let words = "";

  // Crores
  if (remaining >= 10000000) {
    const crores = Math.floor(remaining / 10000000);
    words += `${convertTwoDigits(crores)} Crore `;
    remaining %= 10000000;
  }

  // Lakhs
  if (remaining >= 100000) {
    const lakhs = Math.floor(remaining / 100000);
    words += `${convertTwoDigits(lakhs)} Lakh `;
    remaining %= 100000;
  }

  // Thousands
  if (remaining >= 1000) {
    const thousands = Math.floor(remaining / 1000);
    words += `${convertTwoDigits(thousands)} Thousand `;
    remaining %= 1000;
  }

  // Hundreds & units
  if (remaining > 0) {
    words += convertThreeDigits(remaining);
  }

  words = words.trim();

  let result = words ? `${words} Rupees` : "";
  if (paise > 0) {
    result += `${words ? " and " : ""}${convertTwoDigits(paise)} Paise`;
  }

  return `${result} Only`;
}

export interface AgencyInvoicePrintOptions {
  settings?: StoreSettings | null;
  customerBalance?: number;
  bankDetails?: {
    bankName?: string;
    accountNo?: string;
    ifsc?: string;
  };
  customMessage?: string;
}

/**
 * Prints a B2B Agency / FMCG Wholesale GST Tax Invoice exactly formatted
 * like the standard Agency / Wholesale accounting bill invoice (photo format).
 */
export function printAgencyGstInvoice(
  sale: PosSale,
  options?: AgencyInvoicePrintOptions
): boolean {
  if (typeof window === "undefined") return false;

  const settings = options?.settings;
  const storeName = (settings?.store_name || APP_NAME).toUpperCase();
  const storeAddress = settings?.store_address || STORE_ADDRESS;
  const storeMobile = settings?.store_mobile || STORE_PHONE;
  const gstNo = settings?.gst_number || "24AAKGPB9265J1Z1";

  const invDate = new Date(sale.created_at).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const invMode = (sale.payment_method || "CASH").toUpperCase();

  // Customer / Consignee details
  const custName = (sale.customer_name || "WALK-IN CUSTOMER").toUpperCase();
  const custMobile = sale.customer_mobile || "—";

  // Items formatting
  const items = sale.pos_sale_items ?? [];
  let totalQty = 0;
  let totalGross = 0;
  let totalTaxable = 0;
  let totalSgst = 0;
  let totalCgst = 0;
  let totalItemAmount = 0;

  // Track GST slabs
  const gstSlabs: Record<
    number,
    { taxable: number; sgst: number; cgst: number; igst: number }
  > = {};

  const rowsHtml = items
    .map((item, idx) => {
      const qty = Number(item.quantity) || 1;
      const rate = Number(item.rate) || 0;
      const mrp = Number(item.rate); // MRP fallback to rate or base
      const gstPct = Number(item.gst_percentage) || 5;

      const lineGross = Math.round(qty * rate * 100) / 100;
      // Taxable value
      const taxable = Math.round((lineGross / (1 + gstPct / 100)) * 100) / 100;
      const totalTax = Math.round((lineGross - taxable) * 100) / 100;
      const halfTax = Math.round((totalTax / 2) * 100) / 100;
      const halfPct = (gstPct / 2).toFixed(2);
      const disPct = "0.00";

      totalQty += qty;
      totalGross += lineGross;
      totalTaxable += taxable;
      totalSgst += halfTax;
      totalCgst += halfTax;
      totalItemAmount += lineGross;

      // Slab aggregation
      if (!gstSlabs[gstPct]) {
        gstSlabs[gstPct] = { taxable: 0, sgst: 0, cgst: 0, igst: 0 };
      }
      gstSlabs[gstPct].taxable += taxable;
      gstSlabs[gstPct].sgst += halfTax;
      gstSlabs[gstPct].cgst += halfTax;

      const hsn = item.barcode ? item.barcode.slice(0, 8) : "21039020";

      return `<tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td style="text-align:center;font-family:monospace;">${hsn}</td>
        <td style="text-align:left;font-weight:600;">${item.product_name.toUpperCase()}</td>
        <td style="text-align:right;">${mrp.toFixed(2)}</td>
        <td style="text-align:center;font-weight:700;">${qty}</td>
        <td style="text-align:right;">${rate.toFixed(2)}</td>
        <td style="text-align:right;">${disPct}</td>
        <td style="text-align:right;">${taxable.toFixed(2)}</td>
        <td style="text-align:center;">${halfPct}</td>
        <td style="text-align:right;">${halfTax.toFixed(2)}</td>
        <td style="text-align:center;">${halfPct}</td>
        <td style="text-align:right;">${halfTax.toFixed(2)}</td>
        <td style="text-align:right;font-weight:700;">${lineGross.toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  // Slabs table HTML
  const slabEntries = Object.entries(gstSlabs);
  const slabsHtml =
    slabEntries.length > 0
      ? slabEntries
          .map(([pct, data]) => {
            return `<tr>
              <td style="text-align:center;">${Number(pct).toFixed(2)}</td>
              <td style="text-align:right;">${data.taxable.toFixed(2)}</td>
              <td style="text-align:right;">${data.sgst.toFixed(2)}</td>
              <td style="text-align:right;">${data.cgst.toFixed(2)}</td>
              <td style="text-align:right;">0.00</td>
            </tr>`;
          })
          .join("")
      : `<tr>
          <td style="text-align:center;">5.00</td>
          <td style="text-align:right;">${totalTaxable.toFixed(2)}</td>
          <td style="text-align:right;">${totalSgst.toFixed(2)}</td>
          <td style="text-align:right;">${totalCgst.toFixed(2)}</td>
          <td style="text-align:right;">0.00</td>
        </tr>`;

  const finalTotal = Number(sale.total_amount) || totalItemAmount;
  const roundOff =
    Number(sale.round_off) ||
    Math.round((finalTotal - Math.floor(finalTotal)) * 100) / 100;
  const amountWords = numberToIndianWords(finalTotal);
  const custBalance = options?.customerBalance ?? 0;

  const bankName =
    options?.bankDetails?.bankName ||
    settings?.bank_name ||
    "TAMILNAD MERCANTILE BANK LTD";
  const bankAcc =
    options?.bankDetails?.accountNo ||
    settings?.bank_account_no ||
    "391700050900006";
  const bankIfsc =
    options?.bankDetails?.ifsc ||
    settings?.bank_ifsc ||
    "TMBL0000391";
  const bankBranch = settings?.bank_branch || "";

  const termsRaw =
    options?.customMessage ||
    settings?.invoice_terms ||
    "1. GOODS ONCE SOLD WILL NOT BE ACCEPTED.\n2. CHEQUE RETURN CHARGES RS.500 WILL BE TAKEN EXTRA.\n3. ALL DISPUTES SUBJECT TO LOCAL JURISDICTION.";
  const termsHtml = termsRaw
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => `<div>${t}</div>`)
    .join("");

  const billNumber = sale.bill_number;

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invoice - ${billNumber}</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 8mm 10mm 10mm 10mm;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 11px;
        color: #000;
        background: #fff;
        margin: 0;
        padding: 0;
        line-height: 1.25;
      }
      .page-border {
        border: 1.5px solid #000;
        width: 100%;
        max-width: 900px;
        margin: 0 auto;
      }
      table {
        border-collapse: collapse;
        width: 100%;
      }
      th, td {
        border: 1px solid #000;
        padding: 3px 4px;
        font-size: 10.5px;
      }
      .noborder td {
        border: none;
        padding: 1px 3px;
      }
      .header-grid {
        display: flex;
        border-bottom: 1.5px solid #000;
      }
      .header-seller {
        flex: 1.3;
        padding: 6px 8px;
        border-right: 1.5px solid #000;
      }
      .seller-title {
        font-size: 18px;
        font-weight: 900;
        letter-spacing: -0.01em;
        margin: 0 0 2px 0;
      }
      .seller-sub {
        font-size: 10px;
        margin: 1px 0;
      }
      .header-meta {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .inv-title-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 8px;
        border-bottom: 1px solid #000;
        background: #fdfdfd;
      }
      .inv-word {
        font-size: 14px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .inv-number {
        font-size: 20px;
        font-weight: 900;
        font-family: monospace, sans-serif;
      }
      .inv-details-table {
        width: 100%;
        font-size: 10.5px;
      }
      .inv-details-table td {
        border: none;
        padding: 2px 8px;
      }
      .buyer-box {
        border-bottom: 1.5px solid #000;
        padding: 5px 8px;
        background: #fff;
      }
      .buyer-to {
        font-weight: 800;
        font-size: 12px;
      }
      .items-table {
        width: 100%;
        border-collapse: collapse;
      }
      .items-table th {
        background: #f4f4f4;
        font-weight: 800;
        text-align: center;
        font-size: 10px;
        padding: 4px 2px;
      }
      .items-table td {
        padding: 3.5px 3px;
        font-size: 10px;
      }
      .items-table .totals-row td {
        font-weight: 800;
        background: #fafafa;
        border-top: 1.5px solid #000;
        border-bottom: 1.5px solid #000;
      }
      .bottom-section {
        display: flex;
        border-top: 1.5px solid #000;
      }
      .bottom-left {
        flex: 1.5;
        border-right: 1.5px solid #000;
        padding: 4px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .bottom-right {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .gst-slab-table {
        margin-bottom: 5px;
      }
      .gst-slab-table th {
        background: #eee;
        font-size: 9.5px;
        padding: 2px;
      }
      .gst-slab-table td {
        font-size: 9.5px;
        padding: 2px 3px;
      }
      .words-box {
        font-size: 10px;
        margin-top: 4px;
        padding-top: 3px;
        border-top: 1px dashed #666;
      }
      .terms-box {
        font-size: 9px;
        margin-top: 4px;
        line-height: 1.3;
        color: #222;
      }
      .bank-box {
        font-size: 9.5px;
        margin-top: 4px;
        font-family: monospace, sans-serif;
      }
      .calc-table {
        width: 100%;
        font-size: 11px;
      }
      .calc-table td {
        padding: 3px 6px;
        border: none;
        border-bottom: 1px solid #ddd;
      }
      .calc-table .net-row td {
        font-size: 14px;
        font-weight: 900;
        border-top: 1.5px solid #000;
        border-bottom: 1.5px solid #000;
        background: #fbfbfb;
      }
      .sign-box {
        padding: 10px 8px 6px;
        text-align: right;
        margin-top: auto;
      }
      .sign-label {
        font-size: 11px;
        font-weight: 700;
      }
      .sign-space {
        height: 40px;
      }
    </style>
  </head>
  <body>
    <div class="page-border">
      <!-- Header Section -->
      <div class="header-grid">
        <!-- Store / Seller Header -->
        <div class="header-seller">
          <div class="seller-title">${storeName}</div>
          <div class="seller-sub">${storeAddress}</div>
          <div class="seller-sub"><strong>MO. NO.:</strong> ${storeMobile}</div>
        </div>

        <!-- Invoice Meta -->
        <div class="header-meta">
          <div class="inv-title-bar">
            <span class="inv-word">Invoice</span>
            <span class="inv-number">${billNumber}</span>
          </div>
          <table class="inv-details-table">
            <tr>
              <td><strong>Inv Date</strong></td>
              <td>: ${invDate}</td>
            </tr>
            <tr>
              <td><strong>Mode</strong></td>
              <td>: ${invMode}</td>
            </tr>
            <tr>
              <td><strong>Due Date</strong></td>
              <td>: ${invDate}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Buyer / Customer Box ("To,") -->
      <div class="buyer-box">
        <div class="buyer-to">To, ${custName}</div>
        <div style="font-size:10.5px;margin-top:2px;">
          <span><strong>Mobile:</strong> ${custMobile}</span>
          ${sale.notes ? ` &bull; <span><strong>Notes:</strong> ${sale.notes}</span>` : ""}
        </div>
      </div>

      <!-- Line Items Grid (Exact Photo Formate) -->
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:3%;">Sr.</th>
            <th style="width:9%;">HSN Code</th>
            <th style="width:31%;">Description of Goods</th>
            <th style="width:6%;">MRP</th>
            <th style="width:5%;">Qty/Fr</th>
            <th style="width:7%;">Rate</th>
            <th style="width:5%;">Dis.%</th>
            <th style="width:8%;">Taxable</th>
            <th style="width:4%;">(%)</th>
            <th style="width:6%;">SGST</th>
            <th style="width:4%;">(%)</th>
            <th style="width:6%;">CGST</th>
            <th style="width:8%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <!-- Totals Row -->
          <tr class="totals-row">
            <td colspan="4" style="text-align:right;">Totals:</td>
            <td style="text-align:center;">${totalQty}</td>
            <td style="text-align:right;">${totalGross.toFixed(2)}</td>
            <td style="text-align:right;">0.00</td>
            <td style="text-align:right;">${totalTaxable.toFixed(2)}</td>
            <td></td>
            <td style="text-align:right;">${totalSgst.toFixed(2)}</td>
            <td></td>
            <td style="text-align:right;">${totalCgst.toFixed(2)}</td>
            <td style="text-align:right;">${totalItemAmount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Bottom Summary & Terms Section -->
      <div class="bottom-section">
        <!-- Bottom Left: GST slab, Words, Terms, Bank -->
        <div class="bottom-left">
          <!-- GST Slab Breakdown -->
          <table class="gst-slab-table">
            <thead>
              <tr>
                <th>GST %</th>
                <th>Taxable</th>
                <th>SGST</th>
                <th>CGST</th>
                <th>IGST</th>
              </tr>
            </thead>
            <tbody>
              ${slabsHtml}
            </tbody>
          </table>

          <div class="words-box">
            <strong>Amount in Words:</strong> ${amountWords}
          </div>

          <div class="terms-box">
            ${termsHtml}
          </div>

          <div class="bank-box">
            <strong>BANK DETAIL:</strong> ${bankName}<br/>
            <strong>A/C. No.:</strong> ${bankAcc}, <strong>IFSC:</strong> ${bankIfsc}${bankBranch ? `, <strong>BRANCH:</strong> ${bankBranch}` : ""}
          </div>
        </div>

        <!-- Bottom Right: Balances & Grand Net Amount -->
        <div class="bottom-right">
          <table class="calc-table">
            <tr>
              <td>Balance:</td>
              <td style="text-align:right;font-weight:600;">${custBalance > 0 ? custBalance.toFixed(2) : "0.00"}</td>
            </tr>
            <tr>
              <td>Other +/-:</td>
              <td style="text-align:right;">0.00</td>
            </tr>
            <tr>
              <td>Credit Note:</td>
              <td style="text-align:right;">0.00</td>
            </tr>
            <tr>
              <td>Round Off:</td>
              <td style="text-align:right;">${roundOff > 0 ? `+${roundOff.toFixed(2)}` : roundOff.toFixed(2)}</td>
            </tr>
            <tr class="net-row">
              <td>Net Amount:</td>
              <td style="text-align:right;">${finalTotal.toFixed(2)}</td>
            </tr>
          </table>

          <!-- Signatory Box -->
          <div class="sign-box">
            <div class="sign-label">For, ${storeName}</div>
            <div class="sign-space"></div>
            <div style="font-size:10px;border-top:1px solid #444;display:inline-block;padding-top:2px;">
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;

  // Mount hidden iframe and print
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

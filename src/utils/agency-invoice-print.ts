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
 * Generates the complete HTML document for the B2B Agency / FMCG Wholesale GST Tax Invoice.
 */
export function generateAgencyInvoiceHtml(
  sale: PosSale,
  options?: AgencyInvoicePrintOptions
): string {
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
  const billDiscount = Math.max(
    0,
    (Number(sale.discount) || 0) + (Number(sale.loyalty_discount) || 0)
  );

  // Pre-calculate gross amounts and detect explicit item discounts
  let rawGrossSum = 0;
  let explicitItemDiscountsSum = 0;

  const itemDiscounts = items.map((item) => {
    const qty = Number(item.quantity) || 1;
    const rate = Number(item.rate) || 0;
    const lineGross = Math.round(qty * rate * 100) / 100;
    rawGrossSum += lineGross;

    const anyItem = item as any;
    let discPct = 0;
    let discAmt = 0;
    let cleanName = item.product_name;

    // 1. Direct discount fields on item
    if (anyItem.discount_percent != null && Number(anyItem.discount_percent) > 0) {
      discPct = Number(anyItem.discount_percent);
      discAmt = Math.round(lineGross * (discPct / 100) * 100) / 100;
    } else if (anyItem.discountPercent != null && Number(anyItem.discountPercent) > 0) {
      discPct = Number(anyItem.discountPercent);
      discAmt = Math.round(lineGross * (discPct / 100) * 100) / 100;
    } else if (anyItem.discount_percentage != null && Number(anyItem.discount_percentage) > 0) {
      discPct = Number(anyItem.discount_percentage);
      discAmt = Math.round(lineGross * (discPct / 100) * 100) / 100;
    } else if (anyItem.discount_amount != null && Number(anyItem.discount_amount) > 0) {
      discAmt = Number(anyItem.discount_amount);
      discPct = lineGross > 0 ? Math.round((discAmt / lineGross) * 10000) / 100 : 0;
    } else if (anyItem.discount != null && Number(anyItem.discount) > 0) {
      discAmt = Number(anyItem.discount);
      discPct = lineGross > 0 ? Math.round((discAmt / lineGross) * 10000) / 100 : 0;
    }

    // 2. Extracted from product_name pattern (e.g. "NAME (5% off)")
    if (discPct === 0 && item.product_name) {
      const match = item.product_name.match(/^(.*?)\s*\(([0-9.]+)%\s*off\)\s*$/i);
      if (match) {
        cleanName = match[1].trim();
        discPct = Number(match[2]) || 0;
        discAmt = Math.round(lineGross * (discPct / 100) * 100) / 100;
      }
    }

    // 3. Difference between gross (qty * rate) and stored total_amount
    if (discAmt === 0 && item.total_amount != null && Number(item.total_amount) > 0) {
      const storedTotal = Number(item.total_amount);
      if (storedTotal < lineGross - 0.01) {
        discAmt = Math.round((lineGross - storedTotal) * 100) / 100;
        discPct = lineGross > 0 ? Math.round((discAmt / lineGross) * 10000) / 100 : 0;
      }
    }

    explicitItemDiscountsSum += discAmt;
    return { discPct, discAmt, cleanName, lineGross, qty, rate };
  });

  // If there is an overall bill discount not fully covered by explicit item discounts,
  // distribute the remaining bill discount across items
  const remainingBillDiscount = Math.max(0, billDiscount - explicitItemDiscountsSum);
  if (remainingBillDiscount > 0 && rawGrossSum > 0) {
    const eligible = itemDiscounts.filter((d) => d.discAmt === 0);
    const targetList = eligible.length > 0 ? eligible : itemDiscounts;
    const targetGrossSum = targetList.reduce((s, it) => s + it.lineGross, 0);

    if (targetGrossSum > 0) {
      let allocated = 0;
      targetList.forEach((it, idx) => {
        if (idx === targetList.length - 1) {
          const share = Math.round((remainingBillDiscount - allocated) * 100) / 100;
          it.discAmt += share;
        } else {
          const share = Math.round((it.lineGross / targetGrossSum) * remainingBillDiscount * 100) / 100;
          it.discAmt += share;
          allocated += share;
        }
        it.discPct = it.lineGross > 0 ? Math.round((it.discAmt / it.lineGross) * 10000) / 100 : 0;
      });
    }
  }

  let totalQty = 0;
  let totalGross = 0;
  let totalDiscountAmount = 0;
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
      const d = itemDiscounts[idx];
      const qty = d.qty;
      const rate = d.rate;
      const mrp = Number((item as any).mrp) || rate;
      const gstPct = Number(item.gst_percentage) || 5;
      const lineGross = d.lineGross;
      const lineDiscount = d.discAmt;
      const discPct = d.discPct;

      const lineNet = Math.max(0, Math.round((lineGross - lineDiscount) * 100) / 100);

      // Taxable value based on net line total
      const taxable = Math.round((lineNet / (1 + gstPct / 100)) * 100) / 100;
      const totalTax = Math.round((lineNet - taxable) * 100) / 100;
      const halfTax = Math.round((totalTax / 2) * 100) / 100;
      const halfPct = (gstPct / 2).toFixed(2);

      totalQty += qty;
      totalGross += lineGross;
      totalDiscountAmount += lineDiscount;
      totalTaxable += taxable;
      totalSgst += halfTax;
      totalCgst += halfTax;
      totalItemAmount += lineNet;

      // Slab aggregation
      if (!gstSlabs[gstPct]) {
        gstSlabs[gstPct] = { taxable: 0, sgst: 0, cgst: 0, igst: 0 };
      }
      gstSlabs[gstPct].taxable += taxable;
      gstSlabs[gstPct].sgst += halfTax;
      gstSlabs[gstPct].cgst += halfTax;

      const hsn = item.barcode ? item.barcode.slice(0, 8) : "21039020";

      // Dis.% cell: show formatted percentage if > 0, otherwise blank (exact photo format)
      const disPctDisplay =
        discPct > 0
          ? discPct % 1 === 0
            ? discPct.toFixed(0)
            : discPct.toFixed(2)
          : "";

      return `<tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td style="text-align:center;font-family:monospace;">${hsn}</td>
        <td style="text-align:left;font-weight:600;">${d.cleanName.toUpperCase()}</td>
        <td style="text-align:right;">${mrp.toFixed(2)}</td>
        <td style="text-align:center;font-weight:700;">${qty}</td>
        <td style="text-align:right;">${rate.toFixed(2)}</td>
        <td style="text-align:right;font-weight:600;">${disPctDisplay}</td>
        <td style="text-align:right;">${taxable.toFixed(2)}</td>
        <td style="text-align:center;">${halfPct}</td>
        <td style="text-align:right;">${halfTax.toFixed(2)}</td>
        <td style="text-align:center;">${halfPct}</td>
        <td style="text-align:right;">${halfTax.toFixed(2)}</td>
        <td style="text-align:right;font-weight:700;">${lineNet.toFixed(2)}</td>
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
    sale.round_off !== undefined && sale.round_off !== null
      ? Number(sale.round_off)
      : Math.round((finalTotal - totalItemAmount) * 100) / 100;
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
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        font-size: 11px;
        color: #000;
        background: #fff;
        margin: 0;
        padding: 0;
        line-height: 1.25;
      }
      .page-border {
        border: 2px solid #000;
        width: 100%;
        max-width: 900px;
        margin: 0 auto;
        background: #fff;
      }
      table {
        border-collapse: collapse;
        width: 100%;
      }
      th, td {
        border: 1px solid #000;
        padding: 3.5px 4px;
        font-size: 10.5px;
      }
      .header-grid {
        display: flex;
        border-bottom: 1px solid #000;
      }
      .header-seller {
        flex: 1.35;
        padding: 8px 10px;
        border-right: 1px solid #000;
      }
      .seller-title {
        font-size: 20px;
        font-weight: 900;
        letter-spacing: -0.01em;
        margin: 0 0 3px 0;
        text-transform: uppercase;
      }
      .seller-sub {
        font-size: 10.5px;
        margin: 2px 0;
        color: #000;
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
        padding: 6px 10px;
        border-bottom: 1px solid #000;
        background: #f2f2f2;
      }
      .inv-word {
        font-size: 15px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .inv-number {
        font-size: 22px;
        font-weight: 900;
        font-family: monospace, sans-serif;
      }
      .inv-details-table {
        width: 100%;
        height: 100%;
      }
      .inv-details-table td {
        border: none;
        padding: 3px 10px;
        font-size: 10.5px;
      }
      .buyer-box {
        border-bottom: 1px solid #000;
        padding: 6px 10px;
        background: #fff;
      }
      .buyer-to {
        font-weight: 900;
        font-size: 12.5px;
      }
      .items-table {
        width: 100%;
        border-collapse: collapse;
      }
      .items-table th {
        background: #f0f0f0;
        font-weight: 900;
        text-align: center;
        font-size: 10px;
        padding: 5px 3px;
        border: 1px solid #000;
        border-top: none;
        text-transform: uppercase;
      }
      .items-table td {
        padding: 3.5px 4px;
        font-size: 10px;
        border: 1px solid #000;
      }
      /* Outer table edges collapse seamlessly into .page-border (no doubled lines) */
      .items-table th:first-child,
      .items-table td:first-child {
        border-left: none;
      }
      .items-table th:last-child,
      .items-table td:last-child {
        border-right: none;
      }
      /* Clean, balanced accounting bold line for Totals row */
      .items-table .totals-row td {
        font-weight: 900;
        background: #f4f4f4;
        border-top: 2px solid #000 !important;
        border-bottom: 2px solid #000 !important;
        font-size: 10.5px;
        padding: 4px;
      }
      /* border-top: none avoids double-line artifact with totals-row border-bottom */
      .bottom-section {
        display: flex;
        width: 100%;
        border-top: none;
      }
      .bottom-left {
        flex: 1.45;
        border-right: 1px solid #000;
        padding: 6px 8px;
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
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 6px;
      }
      .gst-slab-table th {
        background: #f0f0f0;
        font-weight: 900;
        font-size: 9.5px;
        padding: 3px 4px;
        border: 1px solid #000;
        text-transform: uppercase;
      }
      .gst-slab-table td {
        font-size: 9.5px;
        padding: 2.5px 4px;
        border: 1px solid #000;
      }
      .words-box {
        font-size: 10px;
        margin: 5px 0 4px 0;
        line-height: 1.35;
      }
      .terms-box {
        font-size: 9px;
        margin-top: 4px;
        line-height: 1.35;
        color: #000;
      }
      .bank-box {
        font-size: 9.5px;
        margin-top: 6px;
        line-height: 1.35;
        font-family: monospace, sans-serif;
      }
      .calc-table {
        width: 100%;
        border-collapse: collapse;
      }
      .calc-table td {
        padding: 4px 8px;
        font-size: 10.5px;
        border: 1px solid #000;
      }
      .calc-table tr:first-child td {
        border-top: none;
      }
      .calc-table tr td:first-child {
        border-left: none;
      }
      .calc-table tr td:last-child {
        border-right: none;
      }
      /* Clean, balanced accounting bold line for Net Amount */
      .calc-table .net-row td {
        font-size: 13.5px;
        font-weight: 900;
        border-top: 2px solid #000 !important;
        border-bottom: 2px solid #000 !important;
        background: #f4f4f4;
        padding: 6px 8px;
      }
      /* border-top: none avoids double-line artifact with net-row border-bottom */
      .sign-box {
        padding: 8px 10px 6px;
        text-align: right;
        margin-top: auto;
        border-top: none;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 75px;
      }
      .sign-label {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .sign-line {
        font-size: 10px;
        font-weight: 700;
        border-top: 1px solid #000;
        display: inline-block;
        padding-top: 2px;
        align-self: flex-end;
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
            <td style="text-align:right;">${totalDiscountAmount > 0 ? totalDiscountAmount.toFixed(2) : "0.00"}</td>
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
              <td style="text-align:right;font-weight:700;">${custBalance > 0 ? custBalance.toFixed(2) : "0.00"}</td>
            </tr>
            ${totalDiscountAmount > 0 ? `
            <tr>
              <td>Discount:</td>
              <td style="text-align:right;font-weight:700;">-${totalDiscountAmount.toFixed(2)}</td>
            </tr>` : ""}
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
            <div style="height: 36px;"></div>
            <div class="sign-line">Authorized Signatory</div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;

  return html;
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

  const html = generateAgencyInvoiceHtml(sale, options);

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

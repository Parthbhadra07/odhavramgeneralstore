import { format } from "date-fns";
import type { CreditLedgerEntry, Customer, StoreSettings } from "@/types/erp";
import { formatPrice } from "@/utils/format";

export function buildCreditStatementText(
  customer: Customer,
  entries: CreditLedgerEntry[],
  settings: StoreSettings | null,
  openingBalance = 0,
  closingBalance?: number
) {
  const store = settings?.store_name ?? "Store";
  const lines: string[] = [
    `*${store}*`,
    settings?.store_address ? settings.store_address : "",
    settings?.gst_number ? `GST: ${settings.gst_number}` : "",
    "",
    "*Customer Statement*",
    `Name: ${customer.name}`,
    `Mobile: ${customer.mobile}`,
    customer.gst_number ? `GST: ${customer.gst_number}` : "",
    customer.address ? `Address: ${customer.address}` : "",
    "",
    `Opening Balance: ${formatPrice(openingBalance)}`,
    "",
    "*Transactions*",
  ];

  for (const e of entries) {
    const date = format(new Date(e.date), "dd/MM/yyyy");
    const amt =
      e.debit > 0
        ? `Dr ${formatPrice(e.debit)}`
        : e.credit > 0
          ? `Cr ${formatPrice(e.credit)}`
          : "—";
    lines.push(`${date} | ${e.description} | ${amt} | Bal ${formatPrice(e.runningBalance)}`);
  }

  lines.push(
    "",
    `Closing Balance: ${formatPrice(closingBalance ?? customer.credit_balance)}`,
    "",
    "Thank you for your business!"
  );

  return lines.filter(Boolean).join("\n");
}

import { printSystematicDocument } from "@/utils/document-print";
import { executeMobilePrint } from "@/utils/mobile-print";

export function printThermalCreditStatementHtml(
  customer: Customer,
  entries: CreditLedgerEntry[],
  settings: StoreSettings | null,
  openingBalance = 0,
  dateRangeLabel = "All Time"
) {
  const storeName = settings?.store_name || "ODHAVRAM GENERAL STORE";
  const storeAddress = settings?.store_address || "";
  const storePhone = settings?.store_phone || "";
  const gstin = settings?.gst_number || "";

  const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);
  const closingBalance = Math.round((openingBalance + totalDebit - totalCredit) * 100) / 100;

  const html = `
    <div style="width: 72mm; max-width: 100%; font-family: monospace, monospace; font-size: 11px; color: #000; line-height: 1.35; padding: 2mm 0; margin: 0 auto;">
      <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="font-size: 14px; font-weight: 900; text-transform: uppercase;">${storeName}</div>
        ${storeAddress ? `<div style="font-size: 10px;">${storeAddress}</div>` : ""}
        ${storePhone ? `<div style="font-size: 10px;">Ph: ${storePhone}</div>` : ""}
        ${gstin ? `<div style="font-size: 10px;">GSTIN: ${gstin}</div>` : ""}
        <div style="font-size: 12px; font-weight: bold; margin-top: 4px; padding: 2px 4px; border: 1px solid #000; display: inline-block;">
          CUSTOMER KHATA STATEMENT
        </div>
      </div>

      <div style="font-size: 10.5px; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px;">
        <div><strong>Party:</strong> ${customer.name}</div>
        <div><strong>Mobile:</strong> ${customer.mobile || "—"}</div>
        ${customer.gst_number ? `<div><strong>GSTIN:</strong> ${customer.gst_number}</div>` : ""}
        <div><strong>Period:</strong> ${dateRangeLabel}</div>
        <div><strong>Date:</strong> ${format(new Date(), "dd/MM/yyyy hh:mm a")}</div>
      </div>

      <div style="display: flex; justify-content: space-between; font-weight: bold; padding: 2px 0;">
        <span>Opening Balance:</span>
        <span>${formatPrice(openingBalance)}</span>
      </div>

      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin: 4px 0; padding: 3px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="text-align: left; padding: 2px 0;">Date/Details</th>
              <th style="text-align: right; padding: 2px 0;">Dr (+)</th>
              <th style="text-align: right; padding: 2px 0;">Cr (-)</th>
            </tr>
          </thead>
          <tbody>
            ${entries.length === 0 ? `<tr><td colspan="3" style="text-align: center; padding: 6px 0;">No transactions in period</td></tr>` : entries.map(e => `
              <tr style="border-bottom: 1px dotted #ccc;">
                <td style="padding: 3px 0; vertical-align: top;">
                  <div style="font-weight: bold;">${format(new Date(e.date), "dd/MM/yy")}</div>
                  <div style="font-size: 9px; color: #333;">${e.description}</div>
                </td>
                <td style="text-align: right; vertical-align: top; padding: 3px 0; font-weight: bold;">
                  ${e.debit > 0 ? formatPrice(e.debit) : "—"}
                </td>
                <td style="text-align: right; vertical-align: top; padding: 3px 0; font-weight: bold;">
                  ${e.credit > 0 ? formatPrice(e.credit) : "—"}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div style="font-size: 10.5px; padding: 4px 0; border-bottom: 1px dashed #000;">
        <div style="display: flex; justify-content: space-between; padding: 1px 0;">
          <span>Total Given (Debit):</span>
          <strong>${formatPrice(totalDebit)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 1px 0;">
          <span>Total Received (Credit):</span>
          <strong>${formatPrice(totalCredit)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; margin-top: 4px; padding-top: 4px; border-top: 1px solid #000;">
          <span>NET BALANCE:</span>
          <span>${formatPrice(Math.abs(closingBalance))}</span>
        </div>
        <div style="text-align: right; font-size: 10px; font-weight: bold; margin-top: 2px;">
          ${closingBalance > 0 ? "(You will get / Dr)" : closingBalance < 0 ? "(You will give / Advance Cr)" : "(Account Settled)"}
        </div>
      </div>

      <div style="text-align: center; font-size: 9px; margin-top: 10px; padding-bottom: 10px;">
        <div>Thank you for doing business with us!</div>
        <div style="margin-top: 16px; border-top: 1px solid #aaa; padding-top: 4px; font-size: 8.5px;">
          Authorized Signatory / Store Stamp
        </div>
      </div>
    </div>
  `;

  executeMobilePrint(
    html,
    `@page { size: 80mm auto; margin: 2mm; } body { font-family: monospace; }`,
    `Statement_${customer.name}`
  );
}

export function printCreditStatementHtml(
  customer: Customer,
  entries: CreditLedgerEntry[],
  settings: StoreSettings | null,
  openingBalance = 0
) {
  const closingBalance = customer.credit_balance;
  const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);

  printSystematicDocument({
    docTitle: "CUSTOMER KHATA STATEMENT / PARTY LEDGER",
    docBadge: "OFFICIAL AUDIT COPY",
    docNumber: `KHATA-${customer.mobile}`,
    docDate: format(new Date(), "dd/MM/yyyy hh:mm a"),
    partyTitle: "Customer Account Details",
    partyDetails: {
      name: customer.name,
      mobile: customer.mobile,
      address: customer.address || undefined,
      gstin: customer.gst_number || undefined,
      extra: `Credit Limit: ${formatPrice(customer.credit_limit || 0)} · Status: ${customer.account_status || "Active"}`,
    },
    metadata: [
      {
        label: "Statement Period",
        value: entries.length
          ? `${format(new Date(entries[0].date), "dd/MM/yyyy")} to ${format(new Date(), "dd/MM/yyyy")}`
          : "All Time",
      },
      { label: "Opening Balance", value: formatPrice(openingBalance) },
      { label: "Total Udhaar (Debit)", value: formatPrice(totalDebit) },
      { label: "Total Paid (Credit)", value: formatPrice(totalCredit) },
      {
        label: "Net Balance",
        value:
          closingBalance > 0
            ? `You'll get ${formatPrice(closingBalance)}`
            : closingBalance < 0
            ? `You'll give ${formatPrice(Math.abs(closingBalance))}`
            : "Settled (₹0.00)",
      },
    ],
    columns: [
      { header: "Date", width: "14%" },
      { header: "Particulars / Reference", width: "42%" },
      { header: "Debit / Given (+)", align: "right", width: "14%" },
      { header: "Credit / Received (-)", align: "right", width: "14%" },
      { header: "Running Balance", align: "right", width: "16%" },
    ],
    rows: entries.map((e) => ({
      cells: [
        format(new Date(e.date), "dd/MM/yyyy"),
        e.description + (e.notes ? ` (${e.notes})` : ""),
        e.debit > 0 ? formatPrice(e.debit) : "—",
        e.credit > 0 ? formatPrice(e.credit) : "—",
        formatPrice(e.runningBalance),
      ],
    })),
    summaryRows: [
      { label: "Total Debit (Udhaar Given)", value: formatPrice(totalDebit) },
      { label: "Total Credit (Received Back)", value: formatPrice(totalCredit) },
      {
        label:
          closingBalance >= 0
            ? "Closing Balance (Receivable)"
            : "Closing Balance (Payable Advance)",
        value: formatPrice(Math.abs(closingBalance)),
        isBold: true,
        isHighlight: true,
      },
    ],
    notes: [
      "Please verify all debits and credit entries against physical vouchers and receipts.",
      "Any discrepancy should be notified within 7 business days of statement date.",
      "Thank you for choosing Odhavram General Store!",
    ],
    signatories: ["Customer Signature", "Accountant / Store In-Charge"],
  });
}

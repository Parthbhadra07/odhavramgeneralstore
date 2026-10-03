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

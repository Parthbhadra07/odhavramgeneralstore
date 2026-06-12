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

export function printCreditStatementHtml(
  customer: Customer,
  entries: CreditLedgerEntry[],
  settings: StoreSettings | null,
  openingBalance = 0
) {
  const store = settings?.store_name ?? "Store";
  const rows = entries
    .map(
      (e) => `
    <tr>
      <td>${format(new Date(e.date), "dd/MM/yyyy")}</td>
      <td>${e.description}</td>
      <td style="text-align:right">${e.debit > 0 ? formatPrice(e.debit) : "—"}</td>
      <td style="text-align:right">${e.credit > 0 ? formatPrice(e.credit) : "—"}</td>
      <td style="text-align:right;font-weight:bold">${formatPrice(e.runningBalance)}</td>
    </tr>`
    )
    .join("");

  const html = `
    <html><head><title>Statement - ${customer.name}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111;}
      h1{font-size:20px;color:#166534;margin:0;}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px;}
      th,td{border:1px solid #e5e7eb;padding:8px;text-align:left;}
      th{background:#f9fafb;}
      .header{display:flex;justify-content:space-between;gap:16px;margin-bottom:24px;}
      .summary{margin-top:16px;font-size:14px;}
    </style></head><body>
    <div class="header">
      <div>
        ${settings?.store_logo_url ? `<img src="${settings.store_logo_url}" height="48" alt="Logo"/>` : ""}
        <h1>${store}</h1>
        <p style="margin:4px 0;color:#666;font-size:12px">${settings?.store_address ?? ""}</p>
        ${settings?.gst_number ? `<p style="margin:0;font-size:12px">GST: ${settings.gst_number}</p>` : ""}
      </div>
      <div style="text-align:right">
        <p style="font-weight:bold;margin:0">Customer Statement</p>
        <p style="margin:4px 0;font-size:12px">${customer.name}</p>
        <p style="margin:0;font-size:12px">${customer.mobile}</p>
      </div>
    </div>
    <p class="summary">Opening Balance: <strong>${formatPrice(openingBalance)}</strong></p>
    <table>
      <thead><tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="summary">Closing Balance: <strong>${formatPrice(customer.credit_balance)}</strong></p>
    <script>window.onload=()=>window.print()</script>
    </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

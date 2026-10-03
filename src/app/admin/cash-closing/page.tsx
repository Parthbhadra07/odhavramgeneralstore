"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { cashClosingService } from "@/services/erp";
import type { CashClosing } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice, formatDate } from "@/utils/format";
import { printSystematicDocument } from "@/utils/document-print";

export default function CashClosingPage() {
  const [closings, setClosings] = useState<CashClosing[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [openingCash, setOpeningCash] = useState(0);

  const load = () => cashClosingService.list().then(setClosings);

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    await cashClosingService.generateForDate(date, openingCash);
    load();
  };

  const printCashClosing = (c: CashClosing) => {
    const totalSales = Number(c.cash_sales || 0) + Number(c.upi_sales || 0) + Number(c.card_sales || 0);
    printSystematicDocument(
      {
        docTitle: "DAILY CASH REGISTER CLOSING AUDIT",
        docBadge: "END-OF-DAY VOUCHER",
        docDate: formatDate(c.closing_date),
        metadata: [
          { label: "Closing Date", value: formatDate(c.closing_date) },
          { label: "Total Turnover", value: formatPrice(totalSales) },
          { label: "Physical Drawer Cash", value: formatPrice(c.closing_cash) },
        ],
        columns: [
          { header: "#", width: "40px", align: "center" },
          { header: "Cash Flow & Payment Component", align: "left" },
          { header: "Mode / Type", align: "left" },
          { header: "Amount", align: "right" },
        ],
        rows: [
          { cells: [1, "Opening Cash Float in Register", "Cash Inward", formatPrice(c.opening_cash)] },
          { cells: [2, "Direct Counter Cash Sales", "Cash Sales", formatPrice(c.cash_sales)] },
          { cells: [3, "UPI QR & Online Payments", "Digital Sales", formatPrice(c.upi_sales)] },
          { cells: [4, "Card / POS Terminal Payments", "Card Sales", formatPrice(c.card_sales)] },
          { cells: [5, "Daily Cash Expenses & Payouts", "Cash Outflow", `- ${formatPrice(c.expenses)}`] },
        ],
        summaryRows: [
          { label: "Net Physical Cash in Drawer", value: formatPrice(c.closing_cash), isBold: true, isHighlight: true },
          { label: "Total Combined Daily Sales", value: formatPrice(totalSales), isBold: true },
        ],
        notes: [
          "Cash counted and verified in physical cash register drawer before day-end store lock.",
          "Cash difference, if any, accounted under cash drawer discrepancy ledger.",
        ],
        signatories: ["Cashier Counter Sign", "Auditor / Shift In-Charge", "Store Manager Sign"],
      },
      `Cash-Closing-${c.closing_date}`
    );
  };

  const printClosingRegister = () => {
    printSystematicDocument(
      {
        docTitle: "DAILY CASH CLOSINGS AUDIT REGISTER",
        docBadge: "ACCOUNTS AUDIT COPY",
        docDate: new Date().toLocaleDateString("en-IN", { dateStyle: "medium" }),
        columns: [
          { header: "#", width: "35px", align: "center" },
          { header: "Date", align: "left" },
          { header: "Opening Cash", align: "right" },
          { header: "Cash Sales", align: "right" },
          { header: "UPI Sales", align: "right" },
          { header: "Card Sales", align: "right" },
          { header: "Expenses", align: "right" },
          { header: "Closing Drawer Cash", align: "right" },
        ],
        rows: closings.map((c, idx) => ({
          cells: [
            idx + 1,
            formatDate(c.closing_date),
            formatPrice(c.opening_cash),
            formatPrice(c.cash_sales),
            formatPrice(c.upi_sales),
            formatPrice(c.card_sales),
            formatPrice(c.expenses),
            formatPrice(c.closing_cash),
          ],
        })),
        summaryRows: [
          { label: "Total Days Audited", value: `${closings.length} days`, isBold: true },
          { label: "Cumulative Cash Sales", value: formatPrice(closings.reduce((acc, c) => acc + Number(c.cash_sales || 0), 0)), isBold: true, isHighlight: true },
        ],
        notes: [
          "Complete historical register of daily cash closings, drawer openings, and expenses.",
        ],
      },
      "Cash-Closing-Register"
    );
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Daily Cash Closing</h1>
          <p className="text-sm text-gray-600">Day-end register audit &amp; cash drawer reconciliation</p>
        </div>
        {closings.length > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={printClosingRegister}
            className="gap-1.5 font-bold"
          >
            <Printer className="h-4 w-4 text-emerald-600" />
            <span>Print Closings Register</span>
          </Button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-3 rounded-xl border bg-white p-4 items-center">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        <Input
          type="number"
          placeholder="Opening cash"
          value={openingCash || ""}
          onChange={(e) => setOpeningCash(Number(e.target.value))}
          className="w-40"
        />
        <Button onClick={generate}>Generate EOD Report</Button>
      </div>

      {closings[0] && (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <h2 className="font-bold text-base text-gray-900">
              Latest Closing Summary — {formatDate(closings[0].closing_date)}
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => printCashClosing(closings[0])}
              className="gap-1.5 text-xs font-bold"
            >
              <Printer className="h-3.5 w-3.5 text-emerald-600" />
              <span>Print This EOD Slip</span>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              { label: "Opening Cash", value: closings[0].opening_cash },
              { label: "Cash Sales", value: closings[0].cash_sales },
              { label: "UPI Sales", value: closings[0].upi_sales },
              { label: "Card Sales", value: closings[0].card_sales },
              { label: "Expenses", value: closings[0].expenses },
              { label: "Closing Cash", value: closings[0].closing_cash, highlight: true },
            ].map(({ label, value, highlight }) => (
              <div
                key={label}
                className={`rounded-xl border p-3 ${
                  highlight
                    ? "bg-emerald-50/80 border-emerald-300 text-emerald-950"
                    : "bg-gray-50/70 border-gray-200 text-gray-900"
                }`}
              >
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className="text-lg font-bold mt-0.5">{formatPrice(value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col">
        <div className="overflow-x-auto max-h-[calc(100vh-320px)] min-h-[280px] overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur-xs text-left shadow-2xs font-semibold text-gray-700">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th>Opening</th>
                <th>Cash Sales</th>
                <th>UPI</th>
                <th>Card</th>
                <th>Expenses</th>
                <th>Closing Cash</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {closings.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-gray-50/80">
                  <td className="p-3 text-gray-700 font-medium">{formatDate(c.closing_date)}</td>
                  <td className="p-3 text-gray-600">{formatPrice(c.opening_cash)}</td>
                  <td className="p-3 font-semibold text-emerald-700">{formatPrice(c.cash_sales)}</td>
                  <td className="p-3 text-gray-600">{formatPrice(c.upi_sales)}</td>
                  <td className="p-3 text-gray-600">{formatPrice(c.card_sales)}</td>
                  <td className="p-3 text-red-600">{formatPrice(c.expenses)}</td>
                  <td className="p-3 font-bold text-gray-900">{formatPrice(c.closing_cash)}</td>
                  <td className="p-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => printCashClosing(c)}
                      className="gap-1 text-xs"
                      title="Print Day Closing Statement"
                    >
                      <Printer className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Print</span>
                    </Button>
                  </td>
                </tr>
              ))}
              {closings.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-gray-500">
                    No cash closing records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200/80 bg-gray-50/90 px-4 py-2 text-[11px] text-gray-500 font-medium shrink-0">
          <span>Showing <strong>{closings.length}</strong> closing record(s)</span>
          <span className="text-gray-400">Scroll inside table to view all items</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Printer, Search, History } from "lucide-react";
import { toast } from "sonner";
import { inventoryService } from "@/services/erp";
import { STOCK_MOVEMENT_LABELS } from "@/lib/erp/constants";
import { formatDate } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { printSystematicDocument } from "@/utils/document-print";
import type { StockLedgerRow } from "@/types/erp";

export default function StockHistoryPage() {
  const [rows, setRows] = useState<StockLedgerRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inventoryService
      .getStockLedger(500)
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const filteredRows = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.productName.toLowerCase().includes(q) ||
      (r.referenceNumber || "").toLowerCase().includes(q) ||
      (STOCK_MOVEMENT_LABELS[r.transactionType as keyof typeof STOCK_MOVEMENT_LABELS] || r.transactionType)
        .toLowerCase()
        .includes(q)
    );
  });

  const printStockHistoryRegister = () => {
    if (filteredRows.length === 0) {
      toast.error("No stock movements found to print.");
      return;
    }
    const totalIn = filteredRows.reduce((s, r) => s + (r.qtyIn || 0), 0);
    const totalOut = filteredRows.reduce((s, r) => s + (r.qtyOut || 0), 0);

    printSystematicDocument({
      docTitle: "STOCK LEDGER & MOVEMENT AUDIT REGISTER",
      docBadge: "AUDIT TRAIL COPY",
      docNumber: `STK-HIST-${new Date().toISOString().slice(0, 10)}`,
      metadata: [
        { label: "Total Transactions Logged", value: filteredRows.length },
        { label: "Total Inward Quantity", value: `+${totalIn}` },
        { label: "Total Outward Quantity", value: `-${totalOut}` },
        { label: "Audit Date", value: formatDate(new Date().toISOString()) },
      ],
      columns: [
        { header: "Date", width: "15%" },
        { header: "Product Name", width: "27%" },
        { header: "Transaction Type", width: "16%" },
        { header: "Reference", width: "16%" },
        { header: "Qty In (+)", align: "right", width: "12%" },
        { header: "Qty Out (-)", align: "right", width: "12%" },
        { header: "Balance", align: "right", width: "12%" },
      ],
      rows: filteredRows.map((r) => ({
        cells: [
          formatDate(r.date),
          r.productName,
          STOCK_MOVEMENT_LABELS[r.transactionType as keyof typeof STOCK_MOVEMENT_LABELS] ?? r.transactionType,
          r.referenceNumber?.slice(0, 10) ?? "—",
          r.qtyIn ? `+${r.qtyIn}` : "—",
          r.qtyOut ? `-${r.qtyOut}` : "—",
          r.balance,
        ],
      })),
      summaryRows: [
        { label: "Total Movement Records", value: String(filteredRows.length) },
        { label: "Net Total Qty Inward", value: `+${totalIn}` },
        { label: "Net Total Qty Outward", value: `-${totalOut}` },
      ],
      notes: [
        "Permanent stock ledger log. Every sale, purchase, adjustment, and return recorded chronologically.",
      ],
      signatories: ["Inventory Controller", "Store Proprietor"],
    });
  };

  if (loading) return <p className="p-8 text-gray-500">Loading stock history…</p>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="admin-page-title mb-1">Stock History</h1>
          <p className="text-sm text-gray-600">Complete inventory ledger — every stock movement</p>
        </div>
        {rows.length > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={printStockHistoryRegister}
            className="gap-1.5 font-bold"
          >
            <Printer className="h-4 w-4 text-emerald-600" />
            <span>Print Stock History</span>
          </Button>
        )}
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by product, type, or bill ref..."
          className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="max-h-[calc(100vh-270px)] sm:max-h-[calc(100vh-250px)] min-h-[300px] overflow-y-auto overscroll-contain scrollbar-thin">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur-xs shadow-xs text-xs font-semibold uppercase tracking-wider text-gray-700">
              <tr>
                <th className="p-3 text-left font-semibold">Date</th>
                <th className="p-3 text-left font-semibold">Product</th>
                <th className="p-3 text-left font-semibold">Type</th>
                <th className="p-3 text-left font-semibold">Reference</th>
                <th className="p-3 text-right font-semibold">Qty In</th>
                <th className="p-3 text-right font-semibold">Qty Out</th>
                <th className="p-3 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, i) => (
                <tr key={i} className="border-t hover:bg-gray-50/80 transition-colors">
                  <td className="p-3 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="p-3 font-medium text-gray-900">{r.productName}</td>
                  <td className="p-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {STOCK_MOVEMENT_LABELS[r.transactionType as keyof typeof STOCK_MOVEMENT_LABELS] ?? r.transactionType}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs text-gray-500">{r.referenceNumber?.slice(0, 10) ?? "—"}</td>
                  <td className="p-3 text-right font-semibold text-emerald-700">
                    {r.qtyIn ? `+${r.qtyIn}` : "—"}
                  </td>
                  <td className="p-3 text-right font-semibold text-red-600">
                    {r.qtyOut ? `-${r.qtyOut}` : "—"}
                  </td>
                  <td className="p-3 text-right font-bold text-gray-900">{r.balance}</td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No stock movements found matching filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredRows.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-2 text-xs text-gray-500 flex items-center justify-between">
            <span>Showing {filteredRows.length} stock ledger movement{filteredRows.length === 1 ? "" : "s"}</span>
            <span className="hidden sm:inline text-gray-400">Scroll table vertically to view full transaction ledger</span>
          </div>
        )}
      </div>
    </div>
  );
}

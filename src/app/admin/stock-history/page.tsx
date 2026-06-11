"use client";

import { useEffect, useState } from "react";
import { inventoryService } from "@/services/erp";
import { STOCK_MOVEMENT_LABELS } from "@/lib/erp/constants";
import { formatDate } from "@/utils/format";
import type { StockLedgerRow } from "@/types/erp";

export default function StockHistoryPage() {
  const [rows, setRows] = useState<StockLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inventoryService
      .getStockLedger(500)
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-8 text-gray-500">Loading stock history…</p>;

  return (
    <div>
      <h1 className="admin-page-title mb-1">Stock History</h1>
      <p className="mb-6 text-sm text-gray-600">Complete inventory ledger — every stock movement</p>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-gray-50">
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
            {rows.map((r, i) => (
              <tr key={i} className="border-t hover:bg-gray-50">
                <td className="p-3 whitespace-nowrap">{formatDate(r.date)}</td>
                <td className="p-3">{r.productName}</td>
                <td className="p-3">
                  {STOCK_MOVEMENT_LABELS[r.transactionType as keyof typeof STOCK_MOVEMENT_LABELS] ?? r.transactionType}
                </td>
                <td className="p-3 font-mono text-xs">{r.referenceNumber?.slice(0, 8) ?? "—"}</td>
                <td className="p-3 text-right text-green-700">{r.qtyIn || "—"}</td>
                <td className="p-3 text-right text-red-600">{r.qtyOut || "—"}</td>
                <td className="p-3 text-right font-medium">{r.balance}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">No stock movements yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { deadStockService } from "@/services/erp";
import type { DeadStockItem } from "@/services/erp/dead-stock.service";
import { formatPrice, formatDate } from "@/utils/format";
import { erpReportsService } from "@/services/erp";
import { Button } from "@/components/ui/button";

export default function DeadStockPage() {
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [items, setItems] = useState<DeadStockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    deadStockService.list(days).then(setItems).finally(() => setLoading(false));
  }, [days]);

  const totalValue = items.reduce((s, i) => s + i.stockValue, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="admin-page-title">Dead Stock Report</h1>
          <p className="text-sm text-gray-600">Products with no sales in selected period</p>
        </div>
        <div className="flex gap-2">
          {([30, 60, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${days === d ? "bg-green-600 text-white" : "border hover:bg-gray-50"}`}
            >
              {d} days
            </button>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              erpReportsService.exportCsv(
                items.map((i) => ({
                  product: i.productName,
                  stock: i.currentStock,
                  lastSale: i.lastSaleDate ?? "Never",
                  value: i.stockValue,
                })),
                `dead-stock-${days}d.csv`
              )
            }
          >
            Export CSV
          </Button>
        </div>
      </div>

      <div className="mb-4 admin-card p-4">
        <p className="text-sm text-gray-600">{items.length} dead stock items · Total value {formatPrice(totalValue)}</p>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left font-semibold">Product</th>
                <th className="p-3 text-right font-semibold">Current Stock</th>
                <th className="p-3 text-left font-semibold">Last Sale</th>
                <th className="p-3 text-right font-semibold">Stock Value</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.productId} className="border-t">
                  <td className="p-3">{i.productName}</td>
                  <td className="p-3 text-right">{i.currentStock}</td>
                  <td className="p-3">{i.lastSaleDate ? formatDate(i.lastSaleDate) : "Never sold"}</td>
                  <td className="p-3 text-right font-medium">{formatPrice(i.stockValue)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-gray-500">No dead stock found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

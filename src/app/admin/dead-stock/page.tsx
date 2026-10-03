"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { deadStockService } from "@/services/erp";
import type { DeadStockItem } from "@/services/erp/dead-stock.service";
import { formatPrice, formatDate } from "@/utils/format";
import { erpReportsService } from "@/services/erp";
import { Button } from "@/components/ui/button";
import { printSystematicDocument } from "@/utils/document-print";

export default function DeadStockPage() {
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [items, setItems] = useState<DeadStockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    deadStockService.list(days).then(setItems).finally(() => setLoading(false));
  }, [days]);

  const totalValue = items.reduce((s, i) => s + i.stockValue, 0);

  const printDeadStockReport = () => {
    if (items.length === 0) {
      toast.error("No dead stock items to print.");
      return;
    }
    printSystematicDocument({
      docTitle: "DEAD STOCK & SLOW MOVING INVENTORY AUDIT",
      docBadge: "INVENTORY AUDIT COPY",
      docNumber: `DEAD-STK-${days}D-${new Date().toISOString().slice(0, 10)}`,
      metadata: [
        { label: "Audit Criteria", value: `No sales in last ${days} days` },
        { label: "Total Dead Stock Items", value: items.length },
        { label: "Total Blocked Capital Value", value: formatPrice(totalValue) },
        { label: "Date", value: formatDate(new Date().toISOString()) },
      ],
      columns: [
        { header: "Product Name", width: "40%" },
        { header: "Current Stock", align: "center", width: "15%" },
        { header: "Last Recorded Sale", align: "center", width: "20%" },
        { header: "Blocked Value", align: "right", width: "25%" },
      ],
      rows: items.map((i) => ({
        cells: [
          i.productName,
          i.currentStock,
          i.lastSaleDate ? formatDate(i.lastSaleDate) : "Never Sold",
          formatPrice(i.stockValue),
        ],
      })),
      summaryRows: [
        { label: "Total Dead Stock Products", value: String(items.length) },
        {
          label: "Total Capital Tied in Dead Stock",
          value: formatPrice(totalValue),
          isBold: true,
          isHighlight: true,
        },
      ],
      notes: [
        "Identified for clearance sale, promotional discounts, or return to vendor.",
      ],
      signatories: ["Store Keeper", "Store Proprietor"],
    });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="admin-page-title">Dead Stock Report</h1>
          <p className="text-sm text-gray-600">Products with no sales in selected period</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([30, 60, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                days === d ? "bg-green-700 text-white" : "border bg-white hover:bg-gray-50"
              }`}
            >
              {d} days
            </button>
          ))}
          {items.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={printDeadStockReport}
              className="gap-1.5 font-bold"
            >
              <Printer className="h-4 w-4 text-emerald-600" />
              <span>Print Dead Stock Audit</span>
            </Button>
          )}
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
        <p className="text-sm text-gray-600">
          {items.length} dead stock items · Total blocked value: <strong className="text-gray-900">{formatPrice(totalValue)}</strong>
        </p>
      </div>

      {loading ? (
        <p className="text-gray-500 p-8">Loading dead stock records…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="max-h-[calc(100vh-270px)] sm:max-h-[calc(100vh-250px)] min-h-[300px] overflow-y-auto overscroll-contain scrollbar-thin">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur-xs shadow-xs text-xs font-semibold uppercase tracking-wider text-gray-700">
                <tr>
                  <th className="p-3 text-left font-semibold">Product</th>
                  <th className="p-3 text-right font-semibold">Current Stock</th>
                  <th className="p-3 text-left font-semibold">Last Sale</th>
                  <th className="p-3 text-right font-semibold">Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.productId} className="border-t hover:bg-gray-50/80 transition-colors">
                    <td className="p-3 font-medium text-gray-900">{i.productName}</td>
                    <td className="p-3 text-right">{i.currentStock}</td>
                    <td className="p-3 text-gray-600">{i.lastSaleDate ? formatDate(i.lastSaleDate) : "Never sold"}</td>
                    <td className="p-3 text-right font-semibold text-gray-900">{formatPrice(i.stockValue)}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      No dead stock found for this period. Great turnover!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {items.length > 0 && (
            <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-2 text-xs text-gray-500 flex items-center justify-between">
              <span>Showing {items.length} slow-moving SKU{items.length === 1 ? "" : "s"}</span>
              <span className="hidden sm:inline text-gray-400">Scroll table vertically to review older items</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

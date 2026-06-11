"use client";

import { useEffect, useState } from "react";
import { erpReportsService } from "@/services/erp";
import { formatPrice } from "@/utils/format";
import { Button } from "@/components/ui/button";
import type { ProfitReport } from "@/types/erp";

type Period = "today" | "month" | "custom";

export default function ProfitLossPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [pl, setPl] = useState<ProfitReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    let from: string;
    let to: string;
    const now = new Date();
    if (period === "today") {
      from = `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
      to = now.toISOString();
    } else if (period === "month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      to = now.toISOString();
    } else {
      from = `${dateFrom}T00:00:00.000Z`;
      to = `${dateTo}T23:59:59.999Z`;
    }
    erpReportsService.profitLoss(from, to).then(setPl).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [period, dateFrom, dateTo]);

  const rows = pl
    ? [
        { label: "Total Sales (Revenue)", value: pl.revenue, positive: true },
        { label: "Cost of Goods Sold", value: -pl.cogs, positive: false },
        { label: "Gross Profit", value: pl.grossProfit, positive: pl.grossProfit >= 0 },
        { label: "Operating Expenses", value: -pl.expenses, positive: false },
        { label: "Sales Returns", value: -pl.salesReturns, positive: false },
        { label: "Purchase Returns (Credit)", value: pl.purchaseReturns, positive: true },
        { label: "Discounts Given", value: -pl.discounts, positive: false },
        { label: "Delivery Charges", value: pl.deliveryCharges, positive: true },
        { label: "Net Profit", value: pl.netProfit, highlight: true },
      ]
    : [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="admin-page-title mb-1">Profit & Loss</h1>
      <p className="mb-6 text-sm text-gray-600">Sales − Purchases − Expenses = Net Profit</p>

      <div className="mb-6 flex flex-wrap gap-2">
        {(["today", "month", "custom"] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${period === p ? "bg-green-600 text-white" : "border hover:bg-gray-50"}`}
          >
            {p === "month" ? "This Month" : p}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="mb-4 flex flex-wrap gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
          <span className="self-center text-gray-500">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Calculating P&L…</p>
      ) : pl ? (
        <div className="admin-card overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.label}
                  className={`border-t ${"highlight" in r && r.highlight ? "bg-green-50 font-bold" : ""}`}
                >
                  <td className="p-4">{r.label}</td>
                  <td className={`p-4 text-right ${r.value >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {formatPrice(Math.abs(r.value))}
                    {r.value < 0 ? " (−)" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t p-4">
            <Button
              variant="outline"
              onClick={() =>
                erpReportsService.exportCsv(
                  rows.map((r) => ({ item: r.label, amount: r.value })),
                  `pnl-${period}.csv`
                )
              }
            >
              Export CSV
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

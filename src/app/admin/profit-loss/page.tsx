"use client";

import { useEffect, useState } from "react";
import { erpReportsService } from "@/services/erp";
import { formatPrice } from "@/utils/format";
import { Button } from "@/components/ui/button";
import type { ProfitReport } from "@/types/erp";
import {
  getActiveFinancialYearCode,
  getFinancialYearList,
  getFYDateRange,
  getQuarterDateRange,
  type FinancialYearQuarter,
} from "@/utils/financial-year";
import { Calendar } from "lucide-react";

type Period = "today" | "month" | "financial_year" | "custom";

export default function ProfitLossPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [selectedFY, setSelectedFY] = useState<string>(() => getActiveFinancialYearCode());
  const [selectedQuarter, setSelectedQuarter] = useState<"all" | FinancialYearQuarter>("all");
  const fyList = getFinancialYearList(4, 2);

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
    } else if (period === "financial_year") {
      const range =
        selectedQuarter === "all"
          ? getFYDateRange(selectedFY)
          : getQuarterDateRange(selectedFY, selectedQuarter);
      from = `${range.startDate}T00:00:00.000Z`;
      to = `${range.endDate}T23:59:59.999Z`;
    } else {
      from = `${dateFrom}T00:00:00.000Z`;
      to = `${dateTo}T23:59:59.999Z`;
    }
    erpReportsService.profitLoss(from, to).then(setPl).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [period, selectedFY, selectedQuarter, dateFrom, dateTo]);

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

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPeriod("today")}
          className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
            period === "today" ? "bg-green-600 text-white" : "border hover:bg-gray-50"
          }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setPeriod("month")}
          className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
            period === "month" ? "bg-green-600 text-white" : "border hover:bg-gray-50"
          }`}
        >
          This Month
        </button>
        <button
          type="button"
          onClick={() => setPeriod("financial_year")}
          className={`rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5 ${
            period === "financial_year" ? "bg-emerald-700 text-white" : "border hover:bg-gray-50 text-emerald-800"
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          Financial Year
        </button>
        <button
          type="button"
          onClick={() => setPeriod("custom")}
          className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
            period === "custom" ? "bg-green-600 text-white" : "border hover:bg-gray-50"
          }`}
        >
          Custom Date
        </button>
      </div>

      {period === "financial_year" && (
        <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">FY Selection:</span>
            <select
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm focus:border-emerald-500 focus:outline-none"
            >
              {fyList.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label} {item.isCurrent ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedQuarter("all")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedQuarter === "all"
                  ? "bg-emerald-600 text-white"
                  : "bg-white border text-gray-700 hover:bg-gray-50"
              }`}
            >
              Full FY
            </button>
            {(["Q1", "Q2", "Q3", "Q4"] as FinancialYearQuarter[]).map((q) => {
              const labels: Record<FinancialYearQuarter, string> = {
                Q1: "Q1 (Apr–Jun)",
                Q2: "Q2 (Jul–Sep)",
                Q3: "Q3 (Oct–Dec)",
                Q4: "Q4 (Jan–Mar)",
              };
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setSelectedQuarter(q)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedQuarter === q
                      ? "bg-emerald-600 text-white"
                      : "bg-white border text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {labels[q]}
                </button>
              );
            })}
          </div>
        </div>
      )}

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

"use client";

import { useEffect, useState } from "react";
import { erpReportsService } from "@/services/erp";
import { formatPrice, formatDate } from "@/utils/format";
import { Button } from "@/components/ui/button";
import type { ProfitReport } from "@/types/erp";
import {
  getActiveFinancialYearCode,
  getFinancialYearList,
  getFYDateRange,
  getQuarterDateRange,
  type FinancialYearQuarter,
} from "@/utils/financial-year";
import {
  Calendar,
  Printer,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  Building2,
  PieChart,
  Percent,
  CheckCircle,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { printSystematicDocument } from "@/utils/document-print";

type Period = "today" | "month" | "financial_year" | "custom";
type LayoutMode = "accounting_t" | "schedule_iii";

export default function ProfitLossPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("accounting_t");
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

  const handlePrint = () => {
    if (!pl) return;
    printSystematicDocument(
      {
        docTitle: "STATEMENT OF PROFIT & LOSS",
        docBadge: "SCHEDULE III FINANCIAL STATEMENT",
        docDate: new Date().toLocaleDateString("en-IN", { dateStyle: "medium" }),
        financialYear: `FY ${selectedFY}`,
        metadata: [
          { label: "Accounting Period", value: period === "today" ? "Today" : period === "month" ? "Current Month" : period === "financial_year" ? `FY ${selectedFY} ${selectedQuarter !== "all" ? `(${selectedQuarter})` : ""}` : `${formatDate(dateFrom)} to ${formatDate(dateTo)}` },
          { label: "Financial Year", value: `FY ${selectedFY}` },
          { label: "Accounting Standard", value: "Indian GAAP / Schedule III Format" },
        ],
        columns: [
          { header: "#", width: "40px", align: "center" },
          { header: "Accounting Particulars", align: "left" },
          { header: "Classification", align: "left" },
          { header: "Amount", align: "right" },
        ],
        rows: [
          { cells: [1, "I. Revenue from Operations (Gross Merchandise Turnover)", "Revenue", formatPrice(pl.revenue)] },
          { cells: [2, "II. Less: Sales Returns & Customer Allowances", "Deduction", `- ${formatPrice(pl.salesReturns)}`] },
          { cells: [3, "III. Net Merchandise Revenue (I - II)", "Net Revenue", formatPrice(pl.netSales ?? (pl.revenue - pl.salesReturns))] },
          { cells: [4, "IV. Cost of Goods Sold (Materials Consumed / COGS)", "Direct Cost", formatPrice(pl.cogs)] },
          { cells: [5, "V. Gross Profit Margin on Merchandise (III - IV)", "Trading Profit", formatPrice(pl.grossProfit)] },
          { cells: [6, "VI. Other Operating Income (Delivery Fees Inward + Return Credits)", "Other Income", `+ ${formatPrice(Number(pl.deliveryCharges || 0) + Number(pl.purchaseReturns || 0))}`] },
          { cells: [7, "VII. Store Operating Overheads & Expenses", "Indirect Expenses", `- ${formatPrice(pl.expenses + (pl.deliveryFuelExpense || 0))}`] },
          ...(pl.expensesBreakdown || []).map((e, idx) => ({
            cells: [
              `7.${idx + 1}`,
              `   • ${e.category} Expenses`,
              "Expense Breakdown",
              `- ${formatPrice(e.amount)}`,
            ],
          })),
          ...(Number(pl.deliveryFuelExpense || 0) > 0 ? [{
            cells: [
              `7.${(pl.expensesBreakdown || []).length + 1}`,
              `   • Delivery Vehicle Fuel & Transit Expenses`,
              "Delivery Transit Cost",
              `- ${formatPrice(pl.deliveryFuelExpense || 0)}`,
            ],
          }] : []),
          { cells: [8, "VIII. Sales & Bill Level Price Discounts", "Discounts", `- ${formatPrice(pl.discounts)}`] },
          { cells: [9, "IX. Net Profit / (Loss) for the Period", "Bottom Line Profit", formatPrice(pl.netProfit)] },
        ],
        summaryRows: [
          { label: "Gross Profit Margin", value: formatPrice(pl.grossProfit), isBold: true },
          { label: "Net Profit / (Loss)", value: formatPrice(pl.netProfit), isBold: true, isHighlight: true },
        ],
        notes: [
          "Financial statement generated in accordance with standard retail double-entry principles.",
          "Inventory valuation calculated on FIFO / average landed acquisition cost basis.",
        ],
        signatories: ["Store Accountant", "Internal Auditor", "Proprietor / Authorized Signatory"],
      },
      `Profit-Loss-Statement-FY${selectedFY}`
    );
  };

  const exportCsv = () => {
    if (!pl) return;
    const rows = [
      { Section: "1. Trading Account (Revenue)", Item: "Gross Sales Turnover", Amount: pl.revenue },
      { Section: "1. Trading Account (Revenue)", Item: "POS Sales Turnover", Amount: pl.posRevenue ?? pl.revenue },
      { Section: "1. Trading Account (Revenue)", Item: "Online Goods Turnover (Excl. Delivery)", Amount: pl.onlineProductSales ?? 0 },
      { Section: "1. Trading Account (Revenue)", Item: "Less: Sales Returns", Amount: -pl.salesReturns },
      { Section: "1. Trading Account (Revenue)", Item: "Net Sales Turnover", Amount: pl.netSales ?? (pl.revenue - pl.salesReturns) },
      { Section: "1. Trading Account (Cost)", Item: "POS Cost of Goods Sold", Amount: pl.posCogs ?? (pl.cogs - (pl.onlineCogs ?? 0)) },
      { Section: "1. Trading Account (Cost)", Item: "Online Orders Cost of Goods Sold", Amount: pl.onlineCogs ?? 0 },
      { Section: "1. Trading Account (Cost)", Item: "Total Cost of Goods Sold (COGS)", Amount: pl.cogs },
      { Section: "1. Trading Account (Profit)", Item: "Gross Profit", Amount: pl.grossProfit },
      { Section: "2. Operating Revenue", Item: "Delivery Charges Inward", Amount: pl.deliveryCharges },
      { Section: "2. Operating Revenue", Item: "Purchase Return Credits", Amount: pl.purchaseReturns },
      { Section: "3. Operating Expenses", Item: "Total Operating Expenses", Amount: pl.expenses },
      ...(pl.expensesBreakdown || []).map((e) => ({
        Section: "3. Operating Expenses (Breakdown)",
        Item: e.category,
        Amount: e.amount,
      })),
      { Section: "3. Operating Expenses", Item: "Sales & Bill Discounts", Amount: pl.discounts },
      { Section: "4. Net Profit", Item: "Net Profit / (Loss) for the Period", Amount: pl.netProfit },
    ];
    erpReportsService.exportCsv(rows, `accounting-profit-loss-${period}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Accounting T-Format Balances
  const grossSales = pl?.revenue ?? 0;
  const salesReturns = pl?.salesReturns ?? 0;
  const netSales = pl?.netSales ?? Math.max(0, grossSales - salesReturns);
  const cogs = pl?.cogs ?? 0;
  const grossProfit = pl?.grossProfit ?? 0;
  const isGrossProfit = grossProfit >= 0;

  // Trading Account Totals
  const tradingDrTotal = cogs + (isGrossProfit ? grossProfit : 0);
  const tradingCrTotal = netSales + (!isGrossProfit ? Math.abs(grossProfit) : 0);
  const tradingBalancedTotal = Math.max(tradingDrTotal, tradingCrTotal);

  // Profit & Loss Section
  const otherIncome = (pl?.deliveryCharges ?? 0) + (pl?.purchaseReturns ?? 0);
  const deliveryFuel = pl?.deliveryFuelExpense ?? 0;
  const operatingExpenses = (pl?.expenses ?? 0) + (pl?.discounts ?? 0) + deliveryFuel;
  const netProfit = pl?.netProfit ?? 0;
  const isNetProfit = netProfit >= 0;

  const plCrTotal = (isGrossProfit ? grossProfit : 0) + otherIncome;
  const plDrTotal = (!isGrossProfit ? Math.abs(grossProfit) : 0) + operatingExpenses;
  const plBalancedTotal = Math.max(plCrTotal, plDrTotal + (isNetProfit ? netProfit : 0));

  const grossMargin = pl?.grossProfitMargin ?? (netSales > 0 ? (grossProfit / netSales) * 100 : 0);
  const netMargin = pl?.netProfitMargin ?? (netSales > 0 ? (netProfit / netSales) * 100 : 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Export Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight sm:text-3xl">
              Profit &amp; Loss Statement
            </h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              Accounting Format
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Official Trading &amp; Profit and Loss Account adhering to Indian Accounting Standards
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Format Switcher */}
          <div className="flex rounded-xl bg-slate-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => setLayoutMode("accounting_t")}
              className={`rounded-lg px-3 py-1.5 font-bold transition-all ${
                layoutMode === "accounting_t"
                  ? "bg-white text-emerald-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              T-Account Format (Dr. / Cr.)
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("schedule_iii")}
              className={`rounded-lg px-3 py-1.5 font-bold transition-all ${
                layoutMode === "schedule_iii"
                  ? "bg-white text-emerald-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Vertical Statement
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs font-bold">
            <Printer className="h-4 w-4" />
            Print Statement
          </Button>

          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 text-xs font-bold text-slate-700">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Date & Period Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "today", label: "Today" },
              { id: "month", label: "This Month" },
              { id: "financial_year", label: "Financial Year (FY)", hasIcon: true },
              { id: "custom", label: "Custom Dates" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id as Period)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  period === p.id
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {p.hasIcon && <Calendar className="h-3.5 w-3.5" />}
                {p.label}
              </button>
            ))}
          </div>

          {period === "financial_year" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Select FY:</span>
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-800 focus:border-emerald-600 focus:outline-none"
              >
                {fyList.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label} {item.isCurrent ? "(Current)" : ""}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedQuarter("all")}
                  className={`rounded px-2 py-0.5 font-bold ${
                    selectedQuarter === "all" ? "bg-emerald-600 text-white" : "text-slate-600"
                  }`}
                >
                  Full FY
                </button>
                {(["Q1", "Q2", "Q3", "Q4"] as FinancialYearQuarter[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setSelectedQuarter(q)}
                    className={`rounded px-2 py-0.5 font-bold ${
                      selectedQuarter === q ? "bg-emerald-600 text-white" : "text-slate-600"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {period === "custom" && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="text-slate-500">From:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border px-2.5 py-1 text-xs"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border px-2.5 py-1 text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Financial Health KPI Summary Cards */}
      {pl && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Net Sales Turnover</span>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{formatPrice(netSales)}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Gross {formatPrice(grossSales)} − Returns {formatPrice(salesReturns)}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Gross Profit</span>
              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-800">
                {grossMargin.toFixed(1)}% Margin
              </span>
            </div>
            <p className="mt-1 text-2xl font-extrabold text-emerald-950">{formatPrice(grossProfit)}</p>
            <p className="mt-0.5 text-xs text-emerald-700">
              Turnover − COGS ({formatPrice(cogs)})
              {pl.onlineCogs !== undefined && pl.onlineCogs > 0 && (
                <span className="block text-[10px] text-emerald-800 font-medium mt-0.5">
                  POS Goods: {formatPrice(pl.posCogs ?? (cogs - pl.onlineCogs))} · Online Goods: {formatPrice(pl.onlineCogs)}
                </span>
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">Net Operating Profit</span>
              <span className="rounded-md bg-teal-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-teal-800">
                {netMargin.toFixed(1)}% Net
              </span>
            </div>
            <p className={`mt-1 text-2xl font-extrabold ${netProfit >= 0 ? "text-teal-950" : "text-rose-700"}`}>
              {formatPrice(netProfit)}
            </p>
            <p className="mt-0.5 text-xs text-teal-700">
              After operating expenses ({formatPrice(pl.expenses)}) &amp; discounts
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Closing Stock Valuation</span>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{formatPrice(pl.inventoryValue)}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Current live store assets at purchase rate
            </p>
          </div>
        </div>
      )}

      {/* Official Accounting Report Paper Document */}
      <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Formal Accounting Store Header */}
        <div className="border-b-2 border-slate-900 pb-4 text-center">
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-950">
            {APP_NAME}
          </h2>
          <p className="text-xs font-semibold text-slate-600">
            General Merchant &amp; Kirana Superstore · Odhav, Vapi
          </p>
          <div className="mt-2 inline-block rounded-md border border-slate-800 bg-slate-50 px-3 py-1">
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-slate-900">
              TRADING AND PROFIT &amp; LOSS ACCOUNT
            </h3>
            <p className="text-[11px] text-slate-600">
              For the period: {period === "today" ? "Today" : period === "month" ? "Current Month" : period === "financial_year" ? `FY ${selectedFY} (${selectedQuarter})` : `${dateFrom} to ${dateTo}`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="text-center space-y-2">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent mx-auto" />
              <p className="text-sm font-semibold text-slate-600">Reconciling General Ledger Accounts...</p>
            </div>
          </div>
        ) : pl ? (
          <>
            {/* VIEW 1: TRADITIONAL T-ACCOUNT FORMAT (Debit Left / Credit Right) */}
            {layoutMode === "accounting_t" && (
              <div className="mt-6 space-y-8">
                {/* SECTION A: TRADING ACCOUNT (To determine Gross Profit) */}
                <div className="overflow-hidden rounded-xl border border-slate-800">
                  <div className="bg-slate-900 px-4 py-2 text-center text-xs font-extrabold uppercase tracking-wider text-white">
                    Part 1: Trading Account (Manufacturing &amp; Direct Goods Trade)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-300 text-xs">
                    {/* LEFT SIDE: DEBIT (Dr.) */}
                    <div className="flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between border-b border-slate-300 bg-slate-100 px-3 py-1.5 font-bold uppercase text-slate-800">
                          <span>Dr. (Particulars / Expenses &amp; COGS)</span>
                          <span>Amount (₹)</span>
                        </div>
                        <div className="p-3 space-y-2.5">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-semibold text-slate-900">To Cost of Goods Sold (COGS)</span>
                              <p className="text-[10px] text-slate-500">
                                Purchase cost of inventory sold
                                {pl.onlineCogs !== undefined && pl.onlineCogs > 0 ? (
                                  <> (POS: {formatPrice(pl.posCogs ?? (cogs - pl.onlineCogs))} · Online: {formatPrice(pl.onlineCogs)})</>
                                ) : null}
                              </p>
                            </div>
                            <span className="font-mono font-bold text-slate-900">{formatPrice(cogs)}</span>
                          </div>

                          {pl.purchases !== undefined && pl.purchases > 0 && (
                            <div className="flex justify-between items-start text-slate-600 pl-3 border-l-2 border-slate-200">
                              <div>
                                <span>Total Purchases Inward in Period</span>
                                {pl.purchaseReturns > 0 && (
                                  <p className="text-[10px] text-slate-400">Less Returns: -{formatPrice(pl.purchaseReturns)}</p>
                                )}
                              </div>
                              <span className="font-mono">{formatPrice(pl.purchases)}</span>
                            </div>
                          )}

                          {isGrossProfit && (
                            <div className="flex justify-between items-center rounded-lg bg-emerald-50 p-2 font-bold text-emerald-950 border border-emerald-200">
                              <span>To Gross Profit c/d (transferred to P&amp;L A/c)</span>
                              <span className="font-mono text-emerald-800">{formatPrice(grossProfit)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Debit Balance Total */}
                      <div className="flex justify-between border-t-2 border-slate-800 bg-slate-100 px-3 py-2 font-bold text-slate-950">
                        <span>Total (Dr.)</span>
                        <span className="font-mono underline decoration-double">{formatPrice(tradingBalancedTotal)}</span>
                      </div>
                    </div>

                    {/* RIGHT SIDE: CREDIT (Cr.) */}
                    <div className="flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between border-b border-slate-300 bg-slate-100 px-3 py-1.5 font-bold uppercase text-slate-800">
                          <span>Cr. (Particulars / Sales &amp; Turnover)</span>
                          <span>Amount (₹)</span>
                        </div>
                        <div className="p-3 space-y-2.5">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-semibold text-slate-900">By Gross Sales Turnover</span>
                              <p className="text-[10px] text-slate-500">
                                POS: {formatPrice(pl.posRevenue ?? grossSales)} · Online: {formatPrice(pl.onlineRevenue ?? 0)}
                              </p>
                            </div>
                            <span className="font-mono font-bold text-slate-900">{formatPrice(grossSales)}</span>
                          </div>

                          {salesReturns > 0 && (
                            <div className="flex justify-between items-center text-rose-700 pl-3">
                              <span>Less: Sales Returns &amp; Refunds</span>
                              <span className="font-mono font-semibold">- {formatPrice(salesReturns)}</span>
                            </div>
                          )}

                          <div className="flex justify-between items-center border-t border-slate-200 pt-1 font-semibold text-slate-800">
                            <span>Net Sales Realized</span>
                            <span className="font-mono font-bold">{formatPrice(netSales)}</span>
                          </div>

                          {!isGrossProfit && (
                            <div className="flex justify-between items-center rounded-lg bg-rose-50 p-2 font-bold text-rose-950 border border-rose-200">
                              <span>By Gross Loss c/d</span>
                              <span className="font-mono text-rose-800">{formatPrice(Math.abs(grossProfit))}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Credit Balance Total */}
                      <div className="flex justify-between border-t-2 border-slate-800 bg-slate-100 px-3 py-2 font-bold text-slate-950">
                        <span>Total (Cr.)</span>
                        <span className="font-mono underline decoration-double">{formatPrice(tradingBalancedTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION B: PROFIT & LOSS ACCOUNT (To determine Net Profit) */}
                <div className="overflow-hidden rounded-xl border border-slate-800">
                  <div className="bg-slate-900 px-4 py-2 text-center text-xs font-extrabold uppercase tracking-wider text-white">
                    Part 2: Profit &amp; Loss Account (Operating Income, Overheads &amp; Net Profit)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-300 text-xs">
                    {/* LEFT SIDE: DEBIT (Dr.) - EXPENSES */}
                    <div className="flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between border-b border-slate-300 bg-slate-100 px-3 py-1.5 font-bold uppercase text-slate-800">
                          <span>Dr. (Indirect Expenses &amp; Losses)</span>
                          <span>Amount (₹)</span>
                        </div>
                        <div className="p-3 space-y-2.5">
                          {!isGrossProfit && (
                            <div className="flex justify-between items-center text-rose-700 font-bold">
                              <span>To Gross Loss b/d</span>
                              <span className="font-mono">{formatPrice(Math.abs(grossProfit))}</span>
                            </div>
                          )}

                          {/* Operating Cash Expenses */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center font-semibold text-slate-900">
                              <span>To Operating &amp; Administrative Expenses</span>
                              <span className="font-mono font-bold">{formatPrice(pl.expenses)}</span>
                            </div>

                            {/* Itemized Categories */}
                            {pl.expensesBreakdown && pl.expensesBreakdown.length > 0 && (
                              <div className="space-y-1 pl-3 border-l-2 border-slate-200">
                                {pl.expensesBreakdown.map((exp) => (
                                  <div key={exp.category} className="flex justify-between text-[11px] text-slate-600">
                                    <span>· {exp.category}</span>
                                    <span className="font-mono">{formatPrice(exp.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Delivery Vehicle Fuel & Transit Expenses */}
                          {(pl.deliveryFuelExpense ?? 0) > 0 && (
                            <div className="flex justify-between items-center text-slate-700">
                              <div>
                                <span>To Delivery Vehicle Fuel &amp; Transit Cost</span>
                                <p className="text-[10px] text-slate-400">Fuel &amp; vehicle transit cost during customer delivery</p>
                              </div>
                              <span className="font-mono font-semibold text-rose-700">
                                {formatPrice(pl.deliveryFuelExpense ?? 0)}
                              </span>
                            </div>
                          )}

                          {/* Sales Discounts Allowed */}
                          {pl.discounts > 0 && (
                            <div className="flex justify-between items-center text-slate-700">
                              <span>To Discounts Allowed to Customers</span>
                              <span className="font-mono font-semibold">{formatPrice(pl.discounts)}</span>
                            </div>
                          )}

                          {/* Net Profit Balance */}
                          {isNetProfit && (
                            <div className="mt-3 flex justify-between items-center rounded-lg bg-teal-50 p-2.5 font-bold text-teal-950 border border-teal-300 shadow-2xs">
                              <div>
                                <span>To Net Profit (Transferred to Capital A/c)</span>
                                <p className="text-[10px] text-teal-700 font-normal">
                                  Net Return: {netMargin.toFixed(1)}% of turnover
                                </p>
                              </div>
                              <span className="font-mono text-base text-teal-800">{formatPrice(netProfit)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Total Dr. */}
                      <div className="flex justify-between border-t-2 border-slate-800 bg-slate-100 px-3 py-2 font-bold text-slate-950">
                        <span>Total (Dr.)</span>
                        <span className="font-mono underline decoration-double">{formatPrice(plBalancedTotal)}</span>
                      </div>
                    </div>

                    {/* RIGHT SIDE: CREDIT (Cr.) - INCOMES */}
                    <div className="flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between border-b border-slate-300 bg-slate-100 px-3 py-1.5 font-bold uppercase text-slate-800">
                          <span>Cr. (Gross Profit b/d &amp; Other Incomes)</span>
                          <span>Amount (₹)</span>
                        </div>
                        <div className="p-3 space-y-2.5">
                          {isGrossProfit && (
                            <div className="flex justify-between items-center rounded-lg bg-emerald-50/60 p-2 font-bold text-emerald-950">
                              <span>By Gross Profit b/d</span>
                              <span className="font-mono text-emerald-800">{formatPrice(grossProfit)}</span>
                            </div>
                          )}

                          {pl.deliveryCharges > 0 && (
                            <div className="flex justify-between items-center text-slate-800">
                              <div>
                                <span>By Delivery Charges Inward</span>
                                <p className="text-[10px] text-slate-400">
                                  Gross: {formatPrice(pl.deliveryCharges)} · Net Margin: {formatPrice(pl.netDeliveryProfit ?? (pl.deliveryCharges - (pl.deliveryFuelExpense ?? 0)))}
                                </p>
                              </div>
                              <span className="font-mono font-semibold">{formatPrice(pl.deliveryCharges)}</span>
                            </div>
                          )}

                          {pl.purchaseReturns > 0 && (
                            <div className="flex justify-between items-center text-slate-800">
                              <span>By Purchase Return Credits Received</span>
                              <span className="font-mono font-semibold">{formatPrice(pl.purchaseReturns)}</span>
                            </div>
                          )}

                          {!isNetProfit && (
                            <div className="mt-3 flex justify-between items-center rounded-lg bg-rose-50 p-2.5 font-bold text-rose-950 border border-rose-300">
                              <span>By Net Loss (Transferred to Capital A/c)</span>
                              <span className="font-mono text-rose-800">{formatPrice(Math.abs(netProfit))}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Total Cr. */}
                      <div className="flex justify-between border-t-2 border-slate-800 bg-slate-100 px-3 py-2 font-bold text-slate-950">
                        <span>Total (Cr.)</span>
                        <span className="font-mono underline decoration-double">{formatPrice(plBalancedTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: SCHEDULE III VERTICAL STATEMENT FORMAT */}
            {layoutMode === "schedule_iii" && (
              <div className="mt-6 overflow-hidden rounded-xl border border-slate-300 text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b-2 border-slate-900 bg-slate-100 font-bold uppercase text-slate-900">
                      <th className="p-3">Particulars</th>
                      <th className="p-3 text-right">Details (₹)</th>
                      <th className="p-3 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {/* I. REVENUE FROM OPERATIONS */}
                    <tr className="bg-slate-50 font-bold text-slate-900">
                      <td colSpan={3} className="p-2.5 uppercase tracking-wide">
                        I. Revenue from Operations
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 pl-6">Gross Sales Turnover (POS + Online)</td>
                      <td className="p-2.5 text-right font-mono">{formatPrice(grossSales)}</td>
                      <td className="p-2.5 text-right font-mono"></td>
                    </tr>
                    {salesReturns > 0 && (
                      <tr className="text-rose-700">
                        <td className="p-2.5 pl-6">Less: Sales Returns &amp; Customer Refunds</td>
                        <td className="p-2.5 text-right font-mono">- {formatPrice(salesReturns)}</td>
                        <td className="p-2.5 text-right font-mono"></td>
                      </tr>
                    )}
                    <tr className="font-bold text-slate-900 bg-slate-50/50">
                      <td className="p-2.5 pl-4">Total Net Revenue (A)</td>
                      <td className="p-2.5 text-right font-mono"></td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-950">{formatPrice(netSales)}</td>
                    </tr>

                    {/* II. COST OF GOODS SOLD */}
                    <tr className="bg-slate-50 font-bold text-slate-900">
                      <td colSpan={3} className="p-2.5 uppercase tracking-wide">
                        II. Cost of Materials &amp; Inventory Consumed
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 pl-6">
                        Cost of Goods Sold (COGS)
                        {pl.onlineCogs !== undefined && pl.onlineCogs > 0 && (
                          <span className="block text-[10px] font-normal text-slate-500">
                            POS Sales Cost: {formatPrice(pl.posCogs ?? (cogs - pl.onlineCogs))} · Online Orders Cost: {formatPrice(pl.onlineCogs)}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-mono">{formatPrice(cogs)}</td>
                      <td className="p-2.5 text-right font-mono"></td>
                    </tr>
                    <tr className="font-bold text-slate-900 bg-slate-50/50">
                      <td className="p-2.5 pl-4">Total Direct Cost (B)</td>
                      <td className="p-2.5 text-right font-mono"></td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-950">{formatPrice(cogs)}</td>
                    </tr>

                    {/* III. GROSS PROFIT */}
                    <tr className="bg-emerald-50 font-black text-emerald-950 border-t-2 border-b-2 border-emerald-300">
                      <td className="p-3 pl-4 text-sm">
                        III. Gross Profit (A − B)
                        <span className="ml-2 font-normal text-xs text-emerald-800">({grossMargin.toFixed(1)}% Gross Margin)</span>
                      </td>
                      <td className="p-3 text-right font-mono"></td>
                      <td className="p-3 text-right font-mono text-base font-bold text-emerald-800">{formatPrice(grossProfit)}</td>
                    </tr>

                    {/* IV. OTHER INCOME */}
                    <tr className="bg-slate-50 font-bold text-slate-900">
                      <td colSpan={3} className="p-2.5 uppercase tracking-wide">
                        IV. Other Operating Incomes
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 pl-6">Delivery Charges Inward</td>
                      <td className="p-2.5 text-right font-mono">{formatPrice(pl.deliveryCharges)}</td>
                      <td className="p-2.5 text-right font-mono"></td>
                    </tr>
                    <tr>
                      <td className="p-2.5 pl-6">Purchase Return Credits</td>
                      <td className="p-2.5 text-right font-mono">{formatPrice(pl.purchaseReturns)}</td>
                      <td className="p-2.5 text-right font-mono"></td>
                    </tr>
                    <tr className="font-bold text-slate-900 bg-slate-50/50">
                      <td className="p-2.5 pl-4">Total Other Incomes (C)</td>
                      <td className="p-2.5 text-right font-mono"></td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-950">{formatPrice(otherIncome)}</td>
                    </tr>

                    {/* V. OPERATING EXPENSES */}
                    <tr className="bg-slate-50 font-bold text-slate-900">
                      <td colSpan={3} className="p-2.5 uppercase tracking-wide">
                        V. Operating &amp; Administrative Expenses
                      </td>
                    </tr>
                    {(pl.expensesBreakdown || []).map((exp) => (
                      <tr key={exp.category}>
                        <td className="p-2.5 pl-6">· {exp.category}</td>
                        <td className="p-2.5 text-right font-mono text-slate-600">{formatPrice(exp.amount)}</td>
                        <td className="p-2.5 text-right font-mono"></td>
                      </tr>
                    ))}
                    {pl.discounts > 0 && (
                      <tr>
                        <td className="p-2.5 pl-6">· Sales Discounts &amp; Loyalty Rebates</td>
                        <td className="p-2.5 text-right font-mono text-slate-600">{formatPrice(pl.discounts)}</td>
                        <td className="p-2.5 text-right font-mono"></td>
                      </tr>
                    )}
                    <tr className="font-bold text-slate-900 bg-slate-50/50">
                      <td className="p-2.5 pl-4">Total Operating Expenses (D)</td>
                      <td className="p-2.5 text-right font-mono"></td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-950">{formatPrice(operatingExpenses)}</td>
                    </tr>

                    {/* VI. NET PROFIT */}
                    <tr className="bg-teal-50 font-black text-teal-950 border-t-2 border-b-2 border-teal-400">
                      <td className="p-3.5 pl-4 text-base">
                        VI. Net Profit / (Loss) for the Period (III + C − D)
                        <span className="ml-2 font-normal text-xs text-teal-800">({netMargin.toFixed(1)}% Net Margin)</span>
                      </td>
                      <td className="p-3.5 text-right font-mono"></td>
                      <td className="p-3.5 text-right font-mono text-lg font-extrabold text-teal-900 underline decoration-double">
                        {formatPrice(netProfit)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Formal Accounting Signature Block for Print */}
            <div className="mt-12 hidden pt-12 print:block border-t border-slate-300">
              <div className="flex justify-between text-xs text-slate-800">
                <div className="text-center w-48 border-t border-slate-800 pt-2">
                  <p className="font-bold">Prepared By</p>
                  <p className="text-[10px] text-slate-500">Store Accountant</p>
                </div>
                <div className="text-center w-48 border-t border-slate-800 pt-2">
                  <p className="font-bold">Audited &amp; Checked</p>
                  <p className="text-[10px] text-slate-500">Chartered Accountant</p>
                </div>
                <div className="text-center w-48 border-t border-slate-800 pt-2">
                  <p className="font-bold">For {APP_NAME}</p>
                  <p className="text-[10px] text-slate-500">Proprietor / Partner</p>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

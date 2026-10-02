"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import {
  Calendar,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Warehouse,
  Receipt,
  RotateCcw,
  Undo2,
  Package,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Building2,
  Coins,
  CheckCircle2,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";

type ReportTab = "overview" | "profit_loss" | "gst" | "inventory" | "returns";

export default function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");
  const [selectedFY, setSelectedFY] = useState<string>(() => getActiveFinancialYearCode());
  const [activePreset, setActivePreset] = useState<"custom" | "fy_full" | FinancialYearQuarter>("custom");
  const fyList = getFinancialYearList(4, 2);

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const [sales, setSales] = useState<{
    posSales: number;
    onlineSales: number;
    total: number;
    posCount?: number;
    orderCount?: number;
  } | null>(null);
  const [profitLoss, setProfitLoss] = useState<ProfitReport | null>(null);
  const [purchaseReturns, setPurchaseReturns] = useState<{
    count: number;
    totalValue: number;
  } | null>(null);
  const [salesReturns, setSalesReturns] = useState<{
    count: number;
    totalValue: number;
  } | null>(null);
  const [stock, setStock] = useState<{
    totalProducts: number;
    totalUnits: number;
    inventoryValue: number;
    lowStockCount: number;
  } | null>(null);
  const [topProducts, setTopProducts] = useState<
    { name: string; quantity: number }[]
  >([]);
  const [gstSales, setGstSales] = useState<{ cgst: number; sgst: number; igst: number; total: number } | null>(null);
  const [gstPurchase, setGstPurchase] = useState<{ cgst: number; sgst: number; igst: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const applyFullFY = (fyCode: string) => {
    setSelectedFY(fyCode);
    setActivePreset("fy_full");
    const range = getFYDateRange(fyCode);
    setDateFrom(range.startDate);
    setDateTo(range.endDate);
  };

  const applyQuarter = (q: FinancialYearQuarter) => {
    setActivePreset(q);
    const range = getQuarterDateRange(selectedFY, q);
    setDateFrom(range.startDate);
    setDateTo(range.endDate);
  };

  const load = () => {
    setLoading(true);
    const from = `${dateFrom}T00:00:00.000Z`;
    const to = `${dateTo}T23:59:59.999Z`;

    Promise.all([
      erpReportsService.salesSummary("month").then(setSales),
      erpReportsService.profitLoss(from, to).then(setProfitLoss),
      erpReportsService.purchaseReturnReport(from, to).then((r) =>
        setPurchaseReturns({ count: r.count, totalValue: r.totalValue })
      ),
      erpReportsService.salesReturnReport(from, to).then((r) =>
        setSalesReturns({ count: r.count, totalValue: r.totalValue })
      ),
      erpReportsService.stockSummary().then(setStock),
      erpReportsService.topProducts(10).then(setTopProducts),
      erpReportsService.gstSalesReport(from, to).then(setGstSales),
      erpReportsService.gstPurchaseReport(from, to).then(setGstPurchase),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [dateFrom, dateTo]);

  const handlePrint = () => {
    window.print();
  };

  const exportOverviewCsv = () => {
    if (!sales || !profitLoss) return;
    const rows = [
      { Metric: "Total Sales Turnover", Value: sales.total },
      { Metric: "POS Direct Sales", Value: sales.posSales },
      { Metric: "Online Store Orders", Value: sales.onlineSales },
      { Metric: "Cost of Goods Sold (COGS)", Value: profitLoss.cogs },
      { Metric: "Gross Profit", Value: profitLoss.grossProfit },
      { Metric: "Sales Returns & Refunds", Value: -profitLoss.salesReturns },
      { Metric: "Operating Expenses", Value: -profitLoss.expenses },
      { Metric: "Sales & Bill Discounts", Value: -profitLoss.discounts },
      { Metric: "Delivery Charges Inward", Value: profitLoss.deliveryCharges },
      { Metric: "Net Profit for Period", Value: profitLoss.netProfit },
      { Metric: "Live Inventory Value", Value: profitLoss.inventoryValue },
    ];
    erpReportsService.exportCsv(rows, `executive-report-${dateFrom}-to-${dateTo}.csv`);
  };

  // Accounting metrics calculations
  const netSales = profitLoss?.netSales ?? Math.max(0, (sales?.total ?? 0) - (profitLoss?.salesReturns ?? 0));
  const cogs = profitLoss?.cogs ?? 0;
  const grossProfit = profitLoss?.grossProfit ?? 0;
  const netProfit = profitLoss?.netProfit ?? 0;
  const grossMargin = profitLoss?.grossProfitMargin ?? (netSales > 0 ? (grossProfit / netSales) * 100 : 0);
  const netMargin = profitLoss?.netProfitMargin ?? (netSales > 0 ? (netProfit / netSales) * 100 : 0);

  // GST Net Payable / Carry forward calculation
  const totalOutputGst = gstSales?.total ?? 0;
  const totalInputGst = gstPurchase?.total ?? 0;
  const netGstPayable = totalOutputGst - totalInputGst;

  if (loading && !sales) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Compiling Store &amp; Accounting Reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Executive Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight sm:text-3xl">
              Store &amp; Financial Reports
            </h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              Executive Suite
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Professional accounting statements, tax compliance, stock valuation &amp; performance metrics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5 text-xs font-bold">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>

          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs font-bold">
            <Printer className="h-3.5 w-3.5" />
            Print Report
          </Button>

          <Button variant="outline" size="sm" onClick={exportOverviewCsv} className="gap-1.5 text-xs font-bold text-slate-700">
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Financial Year & Date Range Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Calendar className="h-4 w-4 text-emerald-600" />
              <span>Financial Year:</span>
            </div>

            <select
              value={selectedFY}
              onChange={(e) => applyFullFY(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs focus:border-emerald-600 focus:outline-none"
            >
              {fyList.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label} {item.isCurrent ? "(Current)" : ""}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => applyFullFY(selectedFY)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                activePreset === "fy_full"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Full FY
            </button>

            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none whitespace-nowrap">
              {(["Q1", "Q2", "Q3", "Q4"] as FinancialYearQuarter[]).map((q) => {
                const labels: Record<FinancialYearQuarter, string> = {
                  Q1: "Q1",
                  Q2: "Q2",
                  Q3: "Q3",
                  Q4: "Q4",
                };
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => applyQuarter(q)}
                    className={`rounded-lg px-2 sm:px-2.5 py-1 text-xs font-bold transition-all shrink-0 ${
                      activePreset === q
                        ? "bg-emerald-700 text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {labels[q]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="text-slate-500">Custom Period:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setActivePreset("custom");
              }}
              className="rounded-lg border px-2.5 py-1 text-xs font-semibold text-slate-800"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setActivePreset("custom");
              }}
              className="rounded-lg border px-2.5 py-1 text-xs font-semibold text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* Tabs Navigation (Horizontally scrollable on mobile) */}
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none border-b border-slate-200 bg-white px-2 pt-2 rounded-t-2xl shadow-2xs print:hidden whitespace-nowrap">
        {[
          { id: "overview", label: "Executive Overview", icon: BarChart3 },
          { id: "profit_loss", label: "Trading & P&L (Accounting)", icon: TrendingDown },
          { id: "gst", label: "GST Tax Report (GSTR-3B)", icon: Receipt },
          { id: "inventory", label: "Inventory & Stock Assets", icon: Warehouse },
          { id: "returns", label: "Returns & Adjustments", icon: RotateCcw },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ReportTab)}
              className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold transition-all shrink-0 ${
                isActive
                  ? "border-emerald-600 text-emerald-950 bg-emerald-50/50 rounded-t-xl"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Executive KPI Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Gross Sales Turnover</span>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{formatPrice(sales?.total ?? 0)}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                POS: {formatPrice(sales?.posSales ?? 0)} · Online: {formatPrice(sales?.onlineSales ?? 0)}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Gross Profit</span>
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-800">
                  {grossMargin.toFixed(1)}% Margin
                </span>
              </div>
              <p className="mt-1 text-2xl font-extrabold text-emerald-950">{formatPrice(grossProfit)}</p>
              <p className="mt-0.5 text-xs text-emerald-700">
                Revenue − Cost of Goods Sold ({formatPrice(cogs)})
              </p>
            </div>

            <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">Net Operating Profit</span>
                <span className="rounded-md bg-teal-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-teal-800">
                  {netMargin.toFixed(1)}% Return
                </span>
              </div>
              <p className={`mt-1 text-2xl font-extrabold ${netProfit >= 0 ? "text-teal-950" : "text-rose-700"}`}>
                {formatPrice(netProfit)}
              </p>
              <p className="mt-0.5 text-xs text-teal-700">
                After operating expenses &amp; customer discounts
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Live Inventory Asset Value</span>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{formatPrice(stock?.inventoryValue ?? 0)}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {stock?.totalProducts ?? 0} SKUs · {stock?.totalUnits ?? 0} units in store
              </p>
            </div>
          </div>

          {/* Detailed Accounting Summary & Top Selling Products */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Quick Accounting Summary Card */}
            {profitLoss && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b pb-3">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    Accounting Reconciliation Summary
                  </h2>
                  <Link
                    href="/admin/profit-loss"
                    className="text-xs font-bold text-emerald-700 hover:underline"
                  >
                    View Full P&amp;L Statement &rarr;
                  </Link>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="font-semibold text-slate-700">1. Gross Turnover (Sales)</span>
                    <span className="font-mono font-bold text-slate-900">{formatPrice(profitLoss.revenue)}</span>
                  </div>
                  {profitLoss.salesReturns > 0 && (
                    <div className="flex justify-between py-1 text-rose-700 pl-3">
                      <span>Less: Sales Returns &amp; Customer Refunds</span>
                      <span className="font-mono font-bold">- {formatPrice(profitLoss.salesReturns)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 bg-slate-50 px-2 rounded font-bold text-slate-800">
                    <span>= Net Sales Realized</span>
                    <span className="font-mono">{formatPrice(netSales)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-700">
                    <span>2. Cost of Goods Sold (Purchase Cost)</span>
                    <span className="font-mono font-bold text-slate-900">- {formatPrice(cogs)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 bg-emerald-50 px-2 rounded font-extrabold text-emerald-950 border border-emerald-200">
                    <span>= Gross Profit (Gross Margin {grossMargin.toFixed(1)}%)</span>
                    <span className="font-mono text-emerald-800">{formatPrice(grossProfit)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-700">
                    <span>3. Delivery &amp; Other Operating Incomes</span>
                    <span className="font-mono font-semibold">+ {formatPrice(profitLoss.deliveryCharges + profitLoss.purchaseReturns)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-700">
                    <span>4. Operating &amp; Administrative Expenses</span>
                    <span className="font-mono font-semibold">- {formatPrice(profitLoss.expenses)}</span>
                  </div>
                  {profitLoss.discounts > 0 && (
                    <div className="flex justify-between py-1 text-slate-700 pl-3">
                      <span>Less: Sales Discounts &amp; Rebates</span>
                      <span className="font-mono font-semibold">- {formatPrice(profitLoss.discounts)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 bg-teal-50 px-2 rounded-lg font-black text-teal-950 border border-teal-300 text-sm">
                    <span>= Net Profit for Period ({netMargin.toFixed(1)}%)</span>
                    <span className="font-mono text-teal-900 underline decoration-double">{formatPrice(netProfit)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Top 10 Bestselling Products Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b pb-3">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Top 10 Fast-Moving Products (POS)
                </h2>
                <span className="text-xs text-slate-400">By quantity sold</span>
              </div>

              <div className="mt-4 space-y-3">
                {topProducts.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">No sales recorded in this period</p>
                ) : (
                  topProducts.map((p, i) => {
                    const maxQty = topProducts[0]?.quantity || 1;
                    const percent = Math.min(100, Math.round((p.quantity / maxQty) * 100));
                    return (
                      <div key={p.name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-800 truncate">
                            {i + 1}. {p.name}
                          </span>
                          <span className="font-mono font-bold text-emerald-800 shrink-0 ml-2">
                            {p.quantity} sold
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-600 transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TRADING & PROFIT/LOSS ACCOUNT (ACCOUNTING FORMAT) */}
      {activeTab === "profit_loss" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-slate-100 p-3">
            <div>
              <p className="text-xs font-bold uppercase text-slate-800">
                Official Trading &amp; Profit and Loss Statement
              </p>
              <p className="text-xs text-slate-600">
                Click below to open the full dedicated P&amp;L interface with T-Account (Dr./Cr.) &amp; Schedule III view.
              </p>
            </div>
            <Link
              href="/admin/profit-loss"
              className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800"
            >
              Open Dedicated P&amp;L Page &rarr;
            </Link>
          </div>

          {/* Inlined Accounting Format Table */}
          {profitLoss && (
            <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-xs overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-900 bg-slate-100 font-bold uppercase text-slate-900">
                    <th className="p-3">Accounting Head / Particulars</th>
                    <th className="p-3 text-right">Debit (Dr.) ₹</th>
                    <th className="p-3 text-right">Credit (Cr.) ₹</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* Revenue */}
                  <tr>
                    <td className="p-3 font-semibold text-slate-900">By Sales Turnover (POS &amp; Web)</td>
                    <td className="p-3 text-right font-mono text-slate-400">—</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">{formatPrice(profitLoss.revenue)}</td>
                  </tr>
                  {profitLoss.salesReturns > 0 && (
                    <tr className="text-rose-700">
                      <td className="p-2.5 pl-6">To Sales Returns &amp; Customer Refunds</td>
                      <td className="p-2.5 text-right font-mono font-bold">{formatPrice(profitLoss.salesReturns)}</td>
                      <td className="p-2.5 text-right font-mono text-slate-400">—</td>
                    </tr>
                  )}
                  {/* Direct Cost / COGS */}
                  <tr>
                    <td className="p-3 font-semibold text-slate-900">To Cost of Goods Sold (Purchase Cost of Items Sold)</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">{formatPrice(profitLoss.cogs)}</td>
                    <td className="p-3 text-right font-mono text-slate-400">—</td>
                  </tr>
                  {/* Gross Profit */}
                  <tr className="bg-emerald-50 font-bold text-emerald-950 border-t border-b border-emerald-300">
                    <td className="p-3 pl-6">To Gross Profit c/d ({grossMargin.toFixed(1)}% Gross Margin)</td>
                    <td className="p-3 text-right font-mono text-emerald-800">{formatPrice(grossProfit)}</td>
                    <td className="p-3 text-right font-mono text-slate-400">—</td>
                  </tr>
                  {/* Other Income */}
                  {profitLoss.deliveryCharges > 0 && (
                    <tr>
                      <td className="p-3 pl-6 text-slate-700">By Delivery Charges Collected</td>
                      <td className="p-3 text-right font-mono text-slate-400">—</td>
                      <td className="p-3 text-right font-mono font-semibold">{formatPrice(profitLoss.deliveryCharges)}</td>
                    </tr>
                  )}
                  {profitLoss.purchaseReturns > 0 && (
                    <tr>
                      <td className="p-3 pl-6 text-slate-700">By Purchase Return Credits</td>
                      <td className="p-3 text-right font-mono text-slate-400">—</td>
                      <td className="p-3 text-right font-mono font-semibold">{formatPrice(profitLoss.purchaseReturns)}</td>
                    </tr>
                  )}
                  {/* Expenses */}
                  <tr>
                    <td className="p-3 font-semibold text-slate-900">To Operating &amp; Administrative Expenses</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">{formatPrice(profitLoss.expenses)}</td>
                    <td className="p-3 text-right font-mono text-slate-400">—</td>
                  </tr>
                  {(profitLoss.expensesBreakdown || []).map((exp) => (
                    <tr key={exp.category} className="text-slate-600">
                      <td className="p-2 pl-8">· {exp.category}</td>
                      <td className="p-2 text-right font-mono">{formatPrice(exp.amount)}</td>
                      <td className="p-2 text-right font-mono text-slate-400">—</td>
                    </tr>
                  ))}
                  {profitLoss.discounts > 0 && (
                    <tr>
                      <td className="p-3 pl-6 text-slate-700">To Discounts Allowed to Customers</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">{formatPrice(profitLoss.discounts)}</td>
                      <td className="p-3 text-right font-mono text-slate-400">—</td>
                    </tr>
                  )}
                  {/* Net Profit */}
                  <tr className="bg-teal-50 font-black text-teal-950 border-t-2 border-b-2 border-teal-400 text-sm">
                    <td className="p-3.5">To Net Profit for the Period ({netMargin.toFixed(1)}% Net Margin)</td>
                    <td className="p-3.5 text-right font-mono text-teal-900 font-extrabold underline decoration-double">{formatPrice(netProfit)}</td>
                    <td className="p-3.5 text-right font-mono text-slate-400">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GST TAX SUMMARY (GSTR-3B STYLE) */}
      {activeTab === "gst" && (
        <div className="space-y-6">
          {/* GST Calculation Summary Card */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
                Output Tax on Sales (GSTR-1)
              </span>
              <p className="mt-1 text-2xl font-extrabold text-blue-950">
                {formatPrice(totalOutputGst)}
              </p>
              <p className="mt-0.5 text-xs text-blue-700">
                CGST {formatPrice(gstSales?.cgst ?? 0)} · SGST {formatPrice(gstSales?.sgst ?? 0)}
              </p>
            </div>

            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">
                Input Tax Credit (ITC on Purchases)
              </span>
              <p className="mt-1 text-2xl font-extrabold text-indigo-950">
                {formatPrice(totalInputGst)}
              </p>
              <p className="mt-0.5 text-xs text-indigo-700">
                CGST {formatPrice(gstPurchase?.cgst ?? 0)} · SGST {formatPrice(gstPurchase?.sgst ?? 0)}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Net GST Payable / (Credit)
              </span>
              <p className={`mt-1 text-2xl font-extrabold ${netGstPayable >= 0 ? "text-emerald-950" : "text-blue-900"}`}>
                {formatPrice(Math.abs(netGstPayable))}
              </p>
              <p className="mt-0.5 text-xs text-emerald-700">
                {netGstPayable >= 0 ? "Payable in GSTR-3B Challan" : "ITC carry-forward available"}
              </p>
            </div>
          </div>

          {/* GSTR-3B Style Breakdown Tables */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Sales GST Table */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-slate-900 text-sm uppercase">
                  Table 3.1: Output Supplies (Sales GST)
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    erpReportsService.exportCsv(
                      [{ CGST: gstSales?.cgst ?? 0, SGST: gstSales?.sgst ?? 0, IGST: gstSales?.igst ?? 0, Total: totalOutputGst }],
                      `gstr1-sales-tax-${dateFrom}.csv`
                    )
                  }
                  className="text-xs"
                >
                  Export CSV
                </Button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 font-bold uppercase text-slate-700">
                      <th className="p-2">Tax Component</th>
                      <th className="p-2 text-right">Tax Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2.5 font-medium">Central GST (CGST)</td>
                      <td className="p-2.5 text-right font-mono font-bold">{formatPrice(gstSales?.cgst ?? 0)}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">State GST (SGST / UTGST)</td>
                      <td className="p-2.5 text-right font-mono font-bold">{formatPrice(gstSales?.sgst ?? 0)}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Integrated GST (IGST)</td>
                      <td className="p-2.5 text-right font-mono font-bold">{formatPrice(gstSales?.igst ?? 0)}</td>
                    </tr>
                    <tr className="bg-blue-50/60 font-black text-blue-950 border-t-2 border-blue-200">
                      <td className="p-3">Total Output Tax Liability</td>
                      <td className="p-3 text-right font-mono text-base">{formatPrice(totalOutputGst)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Purchase GST Table */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-slate-900 text-sm uppercase">
                  Table 4: Eligible ITC (Purchases GST)
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    erpReportsService.exportCsv(
                      [{ CGST: gstPurchase?.cgst ?? 0, SGST: gstPurchase?.sgst ?? 0, IGST: gstPurchase?.igst ?? 0, Total: totalInputGst }],
                      `gstr2b-itc-purchases-${dateFrom}.csv`
                    )
                  }
                  className="text-xs"
                >
                  Export CSV
                </Button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 font-bold uppercase text-slate-700">
                      <th className="p-2">ITC Component</th>
                      <th className="p-2 text-right">ITC Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2.5 font-medium">Input CGST</td>
                      <td className="p-2.5 text-right font-mono font-bold">{formatPrice(gstPurchase?.cgst ?? 0)}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Input SGST</td>
                      <td className="p-2.5 text-right font-mono font-bold">{formatPrice(gstPurchase?.sgst ?? 0)}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Input IGST</td>
                      <td className="p-2.5 text-right font-mono font-bold">{formatPrice(gstPurchase?.igst ?? 0)}</td>
                    </tr>
                    <tr className="bg-indigo-50/60 font-black text-indigo-950 border-t-2 border-indigo-200">
                      <td className="p-3">Total Input Tax Credit (ITC)</td>
                      <td className="p-3 text-right font-mono text-base">{formatPrice(totalInputGst)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: INVENTORY & STOCK VALUATION */}
      {activeTab === "inventory" && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Live Inventory Asset Valuation</span>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{formatPrice(stock?.inventoryValue ?? 0)}</p>
              <p className="mt-0.5 text-xs text-slate-500">Valued at wholesale purchase cost</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Catalog Items</span>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{stock?.totalProducts ?? 0}</p>
              <p className="mt-0.5 text-xs text-slate-500">{stock?.totalUnits ?? 0} total units in stock</p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Low Stock Warnings</span>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-1 text-2xl font-extrabold text-amber-950">{stock?.lowStockCount ?? 0}</p>
              <p className="mt-0.5 text-xs text-amber-700">Items below minimum stock threshold</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm uppercase">Inventory Quick Navigation</h3>
              <div className="flex gap-2">
                <Link
                  href="/admin/inventory"
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800"
                >
                  Manage Full Inventory &rarr;
                </Link>
                <Link
                  href="/admin/reorder"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  AI Reorder Sheet &rarr;
                </Link>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Maintain optimal stock levels, print barcodes, perform stock adjustments, and monitor batch expiries through dedicated inventory controls.
            </p>
          </div>
        </div>
      )}

      {/* TAB 5: RETURNS & ADJUSTMENTS */}
      {activeTab === "returns" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Sales Returns */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-3 border-b pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Customer Sales Returns</h3>
                  <p className="text-xs text-slate-500">Goods returned by customers &amp; refunds issued</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center rounded-xl bg-rose-50/60 p-4 border border-rose-200">
                  <span className="text-xs font-bold text-rose-900">Total Value of Returned Goods:</span>
                  <span className="font-mono text-xl font-extrabold text-rose-700">
                    {formatPrice(salesReturns?.totalValue ?? 0)}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Total {salesReturns?.count ?? 0} sales return voucher(s) recorded in this period.
                </p>
                <Link
                  href="/admin/sales-returns"
                  className="inline-block text-xs font-bold text-rose-700 hover:underline pt-1"
                >
                  View itemized sales returns &rarr;
                </Link>
              </div>
            </div>

            {/* Purchase Returns */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-3 border-b pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                  <Undo2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Supplier Purchase Returns</h3>
                  <p className="text-xs text-slate-500">Goods returned to suppliers / damaged inward</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center rounded-xl bg-indigo-50/60 p-4 border border-indigo-200">
                  <span className="text-xs font-bold text-indigo-900">Total Debit Note Credits:</span>
                  <span className="font-mono text-xl font-extrabold text-indigo-700">
                    {formatPrice(purchaseReturns?.totalValue ?? 0)}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Total {purchaseReturns?.count ?? 0} purchase return debit note(s) issued to suppliers.
                </p>
                <Link
                  href="/admin/purchase-returns"
                  className="inline-block text-xs font-bold text-indigo-700 hover:underline pt-1"
                >
                  View itemized purchase returns &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

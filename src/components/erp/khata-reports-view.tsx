"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
  Package,
  Layers,
  Sparkles,
  MessageCircle,
  Building2,
  Percent,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Customer, StoreSettings, CreditLedgerEntry, PosSale } from "@/types/erp";
import { creditService } from "@/services/erp";
import { formatPrice, formatDate } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";
import { downloadCsv } from "@/utils/export";
import { openWhatsAppShare } from "@/utils/whatsapp";
import {
  printKhataSummaryReport,
  printKhataDetailedReport,
} from "@/utils/khata-reports-print";

type ReportType = "summary" | "detailed" | "register";
type DatePreset = "all" | "this_month" | "last_30_days" | "financial_year" | "custom";

interface KhataReportsViewProps {
  customers: Customer[];
  settings: StoreSettings | null;
  onOpenLedger?: (c: Customer) => void;
}

export function KhataReportsView({
  customers,
  settings,
  onOpenLedger,
}: KhataReportsViewProps) {
  // Party selection
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    customers[0]?.id ?? ""
  );
  const [partySearch, setPartySearch] = useState("");
  const [reportType, setReportType] = useState<ReportType>("summary");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Loaded report data
  const [loading, setLoading] = useState(false);
  const [statementData, setStatementData] = useState<{
    customer: Customer;
    openingBalance: number;
    closingBalance: number;
    totalDebits: number;
    totalCredits: number;
    ledger: CreditLedgerEntry[];
    sales: PosSale[];
  } | null>(null);

  // Expanded items in detailed view
  const [expandedSaleIds, setExpandedSaleIds] = useState<Set<string>>(new Set());

  // Current selected party
  const activeParty = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) ?? null;
  }, [customers, selectedCustomerId]);

  // Filtered party list for dropdown
  const filteredCustomers = useMemo(() => {
    const q = partySearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.mobile && c.mobile.includes(q)) ||
        (c.gst_number && c.gst_number.toLowerCase().includes(q))
    );
  }, [customers, partySearch]);

  // Compute effective date range
  const dateRange = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (datePreset === "this_month") {
      const from = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      return { from, to: todayStr, label: format(today, "MMMM yyyy") };
    }
    if (datePreset === "last_30_days") {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      return {
        from: past.toISOString().slice(0, 10),
        to: todayStr,
        label: "Last 30 Days",
      };
    }
    if (datePreset === "financial_year") {
      const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      const from = `${year}-04-01`;
      const to = `${year + 1}-03-31`;
      return { from, to, label: `FY ${year}-${String(year + 1).slice(-2)}` };
    }
    if (datePreset === "custom") {
      const label =
        customFrom && customTo
          ? `${formatDate(customFrom)} to ${formatDate(customTo)}`
          : customFrom
          ? `From ${formatDate(customFrom)}`
          : customTo
          ? `Up to ${formatDate(customTo)}`
          : "Custom Date Range";
      return { from: customFrom || undefined, to: customTo || undefined, label };
    }
    return { from: undefined, to: undefined, label: "All Time (Complete History)" };
  }, [datePreset, customFrom, customTo]);

  // Fetch report data whenever customer or date range changes
  const loadReportData = useCallback(async () => {
    if (!selectedCustomerId || selectedCustomerId === "all") {
      setStatementData(null);
      return;
    }

    setLoading(true);
    try {
      const data = await creditService.getPartyStatementData(selectedCustomerId, {
        fromDate: dateRange.from,
        toDate: dateRange.to,
      });
      setStatementData(data);
      // Auto-expand all bills in detailed view initially
      setExpandedSaleIds(new Set(data.sales.map((s) => s.id)));
    } catch (err) {
      console.error("Failed to load statement:", err);
      toast.error("Could not load party statement details");
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerId, dateRange.from, dateRange.to]);

  useEffect(() => {
    if (reportType !== "register") {
      loadReportData();
    }
  }, [loadReportData, reportType]);

  const toggleExpandSale = (id: string) => {
    setExpandedSaleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePrintPdf = () => {
    if (!activeParty || !statementData) {
      toast.error("Please select a party first");
      return;
    }

    if (reportType === "summary") {
      printKhataSummaryReport({
        settings,
        customer: activeParty,
        entries: statementData.ledger,
        openingBalance: statementData.openingBalance,
        closingBalance: statementData.closingBalance,
        totalDebits: statementData.totalDebits,
        totalCredits: statementData.totalCredits,
        dateRangeLabel: dateRange.label,
      });
      toast.success("Printing Summary Statement (Bill Totals)...");
    } else if (reportType === "detailed") {
      printKhataDetailedReport({
        settings,
        customer: activeParty,
        sales: statementData.sales,
        creditEntries: statementData.ledger,
        openingBalance: statementData.openingBalance,
        closingBalance: statementData.closingBalance,
        totalDebits: statementData.totalDebits,
        totalCredits: statementData.totalCredits,
        dateRangeLabel: dateRange.label,
      });
      toast.success("Printing Detailed Statement (Product Breakdown)...");
    }
  };

  const handleExportCsv = () => {
    if (!activeParty || !statementData) {
      toast.error("No party data to export");
      return;
    }

    if (reportType === "summary") {
      downloadCsv(
        `khata-summary-${activeParty.mobile}.csv`,
        ["Date", "Bill/Ref", "Particulars", "Payment Mode", "Bill Amount (Dr)", "Paid (Cr)", "Balance"],
        statementData.ledger.map((e) => [
          format(new Date(e.date), "dd/MM/yyyy"),
          e.description,
          e.notes || "",
          e.paymentMethod || (e.type === "credit" ? "Credit" : "Cash"),
          e.debit || 0,
          e.credit || 0,
          e.runningBalance,
        ])
      );
      toast.success("Summary Statement exported as CSV");
    } else {
      // Detailed line items CSV
      const rows: (string | number)[][] = [];
      statementData.sales.forEach((s) => {
        (s.pos_sale_items ?? []).forEach((it) => {
          rows.push([
            format(new Date(s.created_at), "dd/MM/yyyy"),
            s.bill_number,
            it.product_name,
            it.quantity,
            it.unit || "pcs",
            it.rate,
            it.gst_percentage,
            it.total_amount,
            s.total_amount,
          ]);
        });
      });
      downloadCsv(
        `khata-detailed-${activeParty.mobile}.csv`,
        ["Date", "Bill No", "Product Name", "Qty", "Unit", "Rate", "GST %", "Item Total", "Bill Net Total"],
        rows
      );
      toast.success("Detailed Product Statement exported as CSV");
    }
  };

  const handleShareWhatsApp = () => {
    if (!activeParty || !statementData) return;
    const store = settings?.store_name || "Odhavram General Store";
    const due = statementData.closingBalance;
    const msg = [
      `*${store} — KHATA STATEMENT*`,
      `Party: *${activeParty.name}* (${activeParty.mobile})`,
      `Period: ${dateRange.label}`,
      ``,
      `Opening Balance: ${formatPrice(statementData.openingBalance)}`,
      `Total Bills (Debits): ${formatPrice(statementData.totalDebits)}`,
      `Total Paid (Credits): ${formatPrice(statementData.totalCredits)}`,
      `*Closing Net Balance: ${formatPrice(Math.abs(due))} ${due > 0 ? "(Due)" : due < 0 ? "(Advance)" : "(Settled)"}*`,
      ``,
      `Bank Details:`,
      `Bank: ${settings?.bank_name || "TAMILNAD MERCANTILE BANK LTD"}`,
      `A/C: ${settings?.bank_account_no || "391700050900006"}`,
      `IFSC: ${settings?.bank_ifsc || "TMBL0000391"}`,
      ``,
      `Please verify and clear pending balance. Thank you!`,
    ].join("\n");

    openWhatsAppShare(msg, activeParty.mobile);
  };

  // Limit utilization calculation
  const limitInfo = useMemo(() => {
    if (!activeParty) return null;
    const limit = Number(activeParty.credit_limit) || 0;
    const bal = Number(activeParty.credit_balance) || 0;
    if (limit <= 0) return { limit: 0, percent: 0, isExceeded: false };
    const pct = Math.min(100, Math.round((bal / limit) * 100));
    const isExceeded = bal >= limit;
    return { limit, percent: pct, isExceeded };
  }, [activeParty]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Party Selector Card */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-700" />
              <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                Party Statements &amp; Khatabook Reports
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Generate official bill totals summary statements or detailed product audit reports with instant PDF export
            </p>
          </div>

          {/* Quick Tab Switcher */}
          <div className="flex items-center rounded-xl bg-gray-100 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setReportType("summary")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
                reportType === "summary"
                  ? "bg-white text-blue-900 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Bill Totals Summary</span>
            </button>
            <button
              type="button"
              onClick={() => setReportType("detailed")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
                reportType === "detailed"
                  ? "bg-white text-blue-900 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Package className="h-3.5 w-3.5" />
              <span>Detailed with Products</span>
            </button>
            <button
              type="button"
              onClick={() => setReportType("register")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
                reportType === "register"
                  ? "bg-white text-blue-900 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Users className="h-3.5 w-3.5" />
              <span>All Parties Register</span>
            </button>
          </div>
        </div>

        {/* Party Selector & Filters Row */}
        {reportType !== "register" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end">
            <div>
              <label className="text-[11px] font-bold text-gray-700 block mb-1">
                Select Customer / Party
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-xs font-bold text-gray-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              >
                {filteredCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.mobile}) {c.credit_balance > 0 ? `• Due: ₹${c.credit_balance.toFixed(2)}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700 block mb-1">
                Statement Period Preset
              </label>
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-xs font-semibold text-gray-800 focus:bg-white focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Time (Complete History)</option>
                <option value="this_month">This Month</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="financial_year">Current Financial Year</option>
                <option value="custom">Custom Date Range...</option>
              </select>
            </div>

            {datePreset === "custom" ? (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-gray-500 block mb-0.5">From</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 p-2 text-xs font-mono"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-gray-500 block mb-0.5">To</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 p-2 text-xs font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 justify-end">
                <Button
                  type="button"
                  onClick={handlePrintPdf}
                  className="font-bold gap-1.5 bg-blue-700 hover:bg-blue-800 text-white shadow-sm flex-1 sm:flex-initial"
                >
                  <Printer className="h-4 w-4" />
                  <span>Download / Print PDF</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportCsv}
                  className="font-bold gap-1 text-gray-700"
                  title="Export Excel CSV"
                >
                  <Download className="h-4 w-4" />
                </Button>
                {activeParty?.mobile && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleShareWhatsApp}
                    className="font-bold gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    title="Send Statement via WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Selected Party Info Banner */}
        {activeParty && reportType !== "register" && (
          <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-black text-blue-950 uppercase">
                    {activeParty.name}
                  </h3>
                  <Badge variant={activeParty.account_status === "blocked" ? "danger" : "default"}>
                    {activeParty.account_status ?? "active"}
                  </Badge>
                  {activeParty.gst_number && (
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-900 border border-blue-200">
                      GSTIN: {activeParty.gst_number}
                    </span>
                  )}
                </div>
                <p className="text-xs text-blue-800 mt-0.5">
                  Mobile: <b>{activeParty.mobile}</b> {activeParty.address ? `• Address: ${activeParty.address}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[10px] font-bold text-gray-500 block uppercase">Credit Limit</span>
                  <span className="text-xs font-black text-gray-800">
                    {activeParty.credit_limit && activeParty.credit_limit > 0 ? formatPrice(activeParty.credit_limit) : "No Limit Set"}
                  </span>
                </div>
                <div className="text-right pl-4 border-l border-blue-200/60">
                  <span className="text-[10px] font-bold text-gray-500 block uppercase">Net Khata Balance</span>
                  <span
                    className={cn(
                      "text-sm font-black",
                      activeParty.credit_balance > 0 ? "text-red-700" : activeParty.credit_balance < 0 ? "text-blue-700" : "text-emerald-700"
                    )}
                  >
                    {activeParty.credit_balance > 0
                      ? `You'll Get ${formatPrice(activeParty.credit_balance)}`
                      : activeParty.credit_balance < 0
                      ? `You'll Give ${formatPrice(Math.abs(activeParty.credit_balance))}`
                      : "Settled (₹0.00)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Credit Limit Alert Banner if limit is reached */}
            {limitInfo && limitInfo.limit > 0 && (
              <div className="pt-1.5 border-t border-blue-200/40">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-semibold text-gray-600">
                    Credit Limit Utilization: <b>{limitInfo.percent}%</b> of {formatPrice(limitInfo.limit)}
                  </span>
                  {limitInfo.isExceeded && (
                    <span className="font-bold text-red-700 flex items-center gap-1">
                      <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                      Limit Reached! Further credit bills blocked
                    </span>
                  )}
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      limitInfo.isExceeded ? "bg-red-600" : limitInfo.percent >= 80 ? "bg-amber-500" : "bg-blue-600"
                    )}
                    style={{ width: `${Math.min(100, limitInfo.percent)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. KPI Summary Cards */}
      {statementData && reportType !== "register" && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Opening Balance
            </span>
            <p className="mt-1 text-lg font-black text-gray-900">
              {formatPrice(Math.abs(statementData.openingBalance))}{" "}
              <span className="text-xs text-gray-500">
                {statementData.openingBalance > 0 ? "Dr" : statementData.openingBalance < 0 ? "Cr" : ""}
              </span>
            </p>
            <span className="text-[10px] text-gray-400">At start of period</span>
          </div>

          <div className="rounded-2xl border border-red-100 bg-red-50/30 p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-700">
              Total Bills (Debits)
            </span>
            <p className="mt-1 text-lg font-black text-red-700">
              {formatPrice(statementData.totalDebits)}
            </p>
            <span className="text-[10px] text-red-600/80">
              {statementData.sales.length} Invoices issued
            </span>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Total Paid (Credits)
            </span>
            <p className="mt-1 text-lg font-black text-emerald-700">
              {formatPrice(statementData.totalCredits)}
            </p>
            <span className="text-[10px] text-emerald-600/80">Collections recorded</span>
          </div>

          <div
            className={cn(
              "rounded-2xl border p-4 shadow-xs",
              statementData.closingBalance > 0
                ? "border-red-200 bg-red-50/60"
                : statementData.closingBalance < 0
                ? "border-blue-200 bg-blue-50/60"
                : "border-emerald-200 bg-emerald-50/60"
            )}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
              Closing Net Due
            </span>
            <p
              className={cn(
                "mt-1 text-xl font-black",
                statementData.closingBalance > 0
                  ? "text-red-800"
                  : statementData.closingBalance < 0
                  ? "text-blue-800"
                  : "text-emerald-800"
              )}
            >
              {formatPrice(Math.abs(statementData.closingBalance))}
            </p>
            <span className="text-[10px] font-semibold text-gray-600">
              {statementData.closingBalance > 0
                ? "You'll Get (Receivable)"
                : statementData.closingBalance < 0
                ? "You'll Give (Advance)"
                : "Account Settled"}
            </span>
          </div>
        </div>
      )}

      {/* 3. REPORT CONTENT: Summary vs Detailed vs Register */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : reportType === "summary" && statementData ? (
        /* ================== OPTION 1: BILL TOTALS ONLY ================== */
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-700" />
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-900">
                Bill Totals Summary Statement ({statementData.ledger.length} Transactions)
              </h3>
            </div>
            <span className="text-[11px] text-gray-500 font-medium">
              Period: {dateRange.label}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                  <th className="py-2.5 px-3 text-center">#</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Bill / Ref #</th>
                  <th className="py-2.5 px-3">Particulars &amp; Notes</th>
                  <th className="py-2.5 px-3 text-center">Payment Mode</th>
                  <th className="py-2.5 px-3 text-right">Bill Total (Dr)</th>
                  <th className="py-2.5 px-3 text-right">Paid (Cr)</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {statementData.ledger.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      No transaction entries found for the selected period.
                    </td>
                  </tr>
                ) : (
                  statementData.ledger.map((entry, idx) => {
                    const d = format(new Date(entry.date), "dd/MM/yyyy");
                    const ref = entry.referenceType === "pos_sale"
                      ? entry.description.match(/(?:POS|Bill|CDM)[\w/-]+/i)?.[0] || entry.description
                      : entry.description;
                    const mode = entry.paymentMethod ? entry.paymentMethod.toUpperCase() : entry.type === "credit" ? "CREDIT" : "CASH";

                    return (
                      <tr key={entry.id} className="hover:bg-blue-50/40 transition">
                        <td className="py-2.5 px-3 text-center font-mono text-gray-400 text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-gray-900 whitespace-nowrap">
                          {d}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-900 whitespace-nowrap">
                          {ref}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="text-gray-900 font-medium">{entry.description}</p>
                          {entry.notes && (
                            <p className="text-[11px] text-gray-400">{entry.notes}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                              entry.debit > 0
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            )}
                          >
                            {mode}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-red-700">
                          {entry.debit > 0 ? formatPrice(entry.debit) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                          {entry.credit > 0 ? formatPrice(entry.credit) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">
                          {formatPrice(Math.abs(entry.runningBalance))}{" "}
                          <span className="text-[10px] text-gray-400 font-sans">
                            {entry.runningBalance > 0 ? "Dr" : entry.runningBalance < 0 ? "Cr" : ""}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
                {/* Totals Row */}
                {statementData.ledger.length > 0 && (
                  <tr className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-300">
                    <td colSpan={5} className="py-3 px-3 text-right uppercase tracking-wider text-[11px]">
                      Statement Period Totals:
                    </td>
                    <td className="py-3 px-3 text-right text-red-700 font-black">
                      {formatPrice(statementData.totalDebits)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700 font-black">
                      {formatPrice(statementData.totalCredits)}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-blue-950 font-mono text-sm">
                      {formatPrice(Math.abs(statementData.closingBalance))}{" "}
                      <span className="text-xs font-sans">
                        {statementData.closingBalance > 0 ? "Dr" : statementData.closingBalance < 0 ? "Cr" : ""}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : reportType === "detailed" && statementData ? (
        /* ================== OPTION 2: DETAILED WITH PRODUCTS ================== */
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-700" />
              <span className="text-xs font-bold text-blue-950">
                Detailed Product Itemization ({statementData.sales.length} Invoices,{" "}
                {statementData.sales.reduce((s, x) => s + (x.pos_sale_items?.length || 0), 0)} Product lines)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExpandedSaleIds(new Set(statementData.sales.map((s) => s.id)))}
                className="text-[11px] font-bold text-blue-700 hover:underline"
              >
                Expand All
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => setExpandedSaleIds(new Set())}
                className="text-[11px] font-bold text-blue-700 hover:underline"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Invoices List */}
          {statementData.sales.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-gray-400">
              No invoice bills recorded for this period.
            </div>
          ) : (
            statementData.sales.map((sale) => {
              const isExpanded = expandedSaleIds.has(sale.id);
              const items = sale.pos_sale_items ?? [];
              const d = format(new Date(sale.created_at), "dd/MM/yyyy hh:mm a");

              return (
                <div
                  key={sale.id}
                  className="rounded-2xl border border-gray-200 bg-white shadow-xs overflow-hidden transition"
                >
                  {/* Bill Card Header */}
                  <div
                    onClick={() => toggleExpandSale(sale.id)}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gray-50/80 hover:bg-gray-100/70 cursor-pointer border-b border-gray-100 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="rounded-lg bg-blue-100 p-1.5 text-blue-800">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-blue-950">
                            {sale.bill_number}
                          </span>
                          <span className="text-[11px] font-medium text-gray-500">
                            {d}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-500">
                          {items.length} Product items &bull; Mode:{" "}
                          <span className="font-bold uppercase text-gray-800">{sale.payment_method}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 font-semibold block uppercase">Bill Net</span>
                        <span className="text-sm font-black text-gray-900">
                          {formatPrice(sale.total_amount)}
                        </span>
                      </div>
                      <span className="text-gray-400">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Line Items Table */}
                  {isExpanded && (
                    <div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-gray-200 bg-white text-[10px] font-bold uppercase tracking-wider text-gray-500">
                              <th className="py-2 px-3 text-center">#</th>
                              <th className="py-2 px-3">Product Name</th>
                              <th className="py-2 px-3 text-center">Qty &amp; Unit</th>
                              <th className="py-2 px-3 text-right">Rate (₹)</th>
                              <th className="py-2 px-3 text-center">GST %</th>
                              <th className="py-2 px-3 text-right">GST (₹)</th>
                              <th className="py-2 px-3 text-right">Line Total (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {items.map((it, idx) => (
                              <tr key={it.id || idx} className="hover:bg-blue-50/30 transition">
                                <td className="py-2 px-3 text-center font-mono text-[11px] text-gray-400">
                                  {idx + 1}
                                </td>
                                <td className="py-2 px-3 font-semibold text-gray-900">
                                  {it.product_name}
                                  {it.barcode && (
                                    <span className="text-[10px] text-gray-400 ml-1.5 font-mono">
                                      ({it.barcode})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-gray-700">
                                  {it.quantity} {it.unit || "pcs"}
                                </td>
                                <td className="py-2 px-3 text-right font-medium text-gray-700">
                                  {formatPrice(it.rate)}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                                    {it.gst_percentage}%
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right text-gray-600">
                                  {formatPrice(it.gst_amount || 0)}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-gray-900">
                                  {formatPrice(it.total_amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Bill Summary Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50/70 p-2.5 border-t border-gray-100 text-[11px] font-semibold text-gray-600">
                        <div>
                          <span>Taxable Subtotal: <b>{formatPrice(sale.subtotal)}</b></span>
                          <span className="mx-2">&bull;</span>
                          <span>
                            Total Tax: <b>{formatPrice((Number(sale.cgst) || 0) + (Number(sale.sgst) || 0) + (Number(sale.igst) || 0))}</b>
                          </span>
                          {Number(sale.discount) > 0 && (
                            <>
                              <span className="mx-2">&bull;</span>
                              <span className="text-emerald-700">
                                Discount: <b>-{formatPrice(sale.discount)}</b>
                              </span>
                            </>
                          )}
                        </div>
                        <span className="text-xs font-black text-blue-950">
                          Invoice Net: {formatPrice(sale.total_amount)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : reportType === "register" ? (
        /* ================== OPTION 3: ALL PARTIES REGISTER ================== */
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-700" />
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-900">
                All Parties Credit Register ({customers.length} Accounts)
              </h3>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search party by name or mobile..."
                value={partySearch}
                onChange={(e) => setPartySearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 pl-8 pr-3 py-1.5 text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                  <th className="py-2.5 px-3 text-center">#</th>
                  <th className="py-2.5 px-3">Party Name</th>
                  <th className="py-2.5 px-3">Mobile &amp; GSTIN</th>
                  <th className="py-2.5 px-3 text-right">Credit Limit</th>
                  <th className="py-2.5 px-3 text-right">Net Balance</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-blue-50/40 transition">
                    <td className="py-2.5 px-3 text-center font-mono text-gray-400 text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-gray-900">{c.name}</p>
                      {c.address && <p className="text-[11px] text-gray-400 truncate max-w-xs">{c.address}</p>}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="text-gray-700 font-medium">{c.mobile}</p>
                      {c.gst_number && (
                        <span className="font-mono text-[10px] text-blue-700">{c.gst_number}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-gray-700">
                      {c.credit_limit && c.credit_limit > 0 ? formatPrice(c.credit_limit) : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold font-mono">
                      <span
                        className={cn(
                          c.credit_balance > 0 ? "text-red-700" : c.credit_balance < 0 ? "text-blue-700" : "text-emerald-700"
                        )}
                      >
                        {c.credit_balance > 0
                          ? `Dr ${formatPrice(c.credit_balance)}`
                          : c.credit_balance < 0
                          ? `Cr ${formatPrice(Math.abs(c.credit_balance))}`
                          : "Settled"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={c.account_status === "blocked" ? "danger" : "default"}>
                        {c.account_status ?? "active"}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            setReportType("summary");
                          }}
                          className="text-[11px] h-7 px-2 font-semibold"
                        >
                          View Statement
                        </Button>
                        {onOpenLedger && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onOpenLedger(c)}
                            className="text-[11px] h-7 px-2"
                          >
                            Ledger
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

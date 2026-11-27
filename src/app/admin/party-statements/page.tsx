"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Users,
  Search,
  MessageCircle,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Receipt,
  Sparkles,
  Clock,
  CreditCard,
  Building2,
  Eye,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Customer, StoreSettings, CreditLedgerEntry, PosSale } from "@/types/erp";
import { creditService, customerService } from "@/services/erp";
import { useStoreSettings } from "@/hooks/use-store-settings";
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
import {
  buildCreditStatementText,
  printThermalCreditStatementHtml,
} from "@/utils/credit-statement";
import { KhataVoucherForm } from "@/components/erp/khata-party-book";

type DatePreset =
  | "all"
  | "today"
  | "this_week"
  | "this_month"
  | "last_30_days"
  | "financial_year"
  | "custom";

function PartyStatementsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { settings } = useStoreSettings();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [partySearch, setPartySearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [activeTab, setActiveTab] = useState<"ledger" | "items" | "payments" | "returns">("ledger");

  // Loaded statement data
  const [loading, setLoading] = useState(false);
  const [statementData, setStatementData] = useState<{
    customer: Customer;
    openingBalance: number;
    closingBalance: number;
    totalDebits: number;
    totalCredits: number;
    ledger: CreditLedgerEntry[];
    sales: PosSale[];
    salesReturns?: any[];
  } | null>(null);

  // Expanded items in detailed view
  const [expandedSaleIds, setExpandedSaleIds] = useState<Set<string>>(new Set());

  // Quick voucher modal
  const [voucherModal, setVoucherModal] = useState<"gave" | "got" | null>(null);

  // Load all customers on mount
  useEffect(() => {
    creditService
      .listParties()
      .then((list: Customer[]) => {
        setCustomers(list);
        const queryId = searchParams.get("customerId");
        if (queryId && list.some((c) => c.id === queryId)) {
          setSelectedCustomerId(queryId);
        } else if (list.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(list[0].id);
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load customers:", err);
      });
  }, [searchParams]);

  // Selected party
  const activeParty = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) ?? null;
  }, [customers, selectedCustomerId]);

  // Filter party dropdown by search
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
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");

    if (datePreset === "all") {
      return { from: undefined, to: undefined, label: "All Time (Complete Statement)" };
    }
    if (datePreset === "today") {
      return { from: todayStr, to: todayStr, label: `Today (${format(now, "dd MMM yyyy")})` };
    }
    if (datePreset === "this_week") {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      const fromStr = format(startOfWeek, "yyyy-MM-dd");
      return { from: fromStr, to: todayStr, label: `This Week (${format(startOfWeek, "dd MMM")} – ${format(now, "dd MMM yyyy")})` };
    }
    if (datePreset === "this_month") {
      const fromStr = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
      return {
        from: fromStr,
        to: todayStr,
        label: `This Month (${format(now, "MMMM yyyy")})`,
      };
    }
    if (datePreset === "last_30_days") {
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      return {
        from: format(past, "yyyy-MM-dd"),
        to: todayStr,
        label: `Last 30 Days (${format(past, "dd MMM")} – ${format(now, "dd MMM yyyy")})`,
      };
    }
    if (datePreset === "financial_year") {
      const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const fromStr = `${year}-04-01`;
      const toStr = `${year + 1}-03-31`;
      return {
        from: fromStr,
        to: toStr > todayStr ? todayStr : toStr,
        label: `FY ${year}-${String(year + 1).slice(-2)}`,
      };
    }
    if (datePreset === "custom") {
      return {
        from: customFrom || undefined,
        to: customTo || undefined,
        label:
          customFrom && customTo
            ? `${format(new Date(customFrom), "dd MMM yyyy")} to ${format(new Date(customTo), "dd MMM yyyy")}`
            : "Custom Range",
      };
    }
    return { from: undefined, to: undefined, label: "All Time" };
  }, [datePreset, customFrom, customTo]);

  // Load statement data whenever party or date range changes
  const loadStatement = useCallback(async () => {
    if (!selectedCustomerId) {
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load statement");
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerId, dateRange]);

  useEffect(() => {
    loadStatement();
  }, [loadStatement]);

  const toggleSaleExpand = (saleId: string) => {
    setExpandedSaleIds((prev) => {
      const next = new Set(prev);
      if (next.has(saleId)) next.delete(saleId);
      else next.add(saleId);
      return next;
    });
  };

  // Actions
  const handlePrintSummary = () => {
    if (!statementData) return;
    printKhataSummaryReport({
      settings: settings ?? null,
      customer: statementData.customer,
      entries: statementData.ledger,
      openingBalance: statementData.openingBalance,
      closingBalance: statementData.closingBalance,
      totalDebits: statementData.totalDebits,
      totalCredits: statementData.totalCredits,
      dateRangeLabel: dateRange.label,
    });
  };

  const handlePrintDetailed = () => {
    if (!statementData) return;
    printKhataDetailedReport({
      settings: settings ?? null,
      customer: statementData.customer,
      sales: statementData.sales,
      creditEntries: statementData.ledger,
      openingBalance: statementData.openingBalance,
      closingBalance: statementData.closingBalance,
      totalDebits: statementData.totalDebits,
      totalCredits: statementData.totalCredits,
      dateRangeLabel: dateRange.label,
    });
  };

  const handlePrintThermal = () => {
    if (!statementData) return;
    printThermalCreditStatementHtml(
      statementData.customer,
      statementData.ledger,
      settings ?? null,
      statementData.openingBalance,
      dateRange.label
    );
  };

  const handleWhatsApp = () => {
    if (!statementData) return;
    const text = buildCreditStatementText(
      statementData.customer,
      statementData.ledger,
      settings ?? null,
      statementData.openingBalance,
      statementData.closingBalance
    );
    openWhatsAppShare(text, statementData.customer.mobile);
  };

  const handleExportCsv = () => {
    if (!statementData) return;
    const headers = ["Date", "Type", "Description", "Notes", "Debit", "Credit", "Running Balance"];
    const rows = statementData.ledger.map((e) => [
      format(new Date(e.date), "dd/MM/yyyy"),
      e.type,
      e.description,
      e.notes || "",
      e.debit || 0,
      e.credit || 0,
      e.runningBalance,
    ]);
    downloadCsv(
      `Statement_${statementData.customer.name.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.csv`,
      headers,
      rows
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-7 w-7 text-emerald-600" />
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Customer / Party Statements
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Generate, audit, and print formal party statements, itemized bill ledgers, and share khata via WhatsApp
          </p>
        </div>

        {statementData && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrintSummary}
              className="gap-1.5 font-bold text-blue-900 border-blue-200 bg-blue-50/50 hover:bg-blue-100"
            >
              <Printer className="h-4 w-4 text-blue-700" />
              <span>Print A4 Statement</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handlePrintDetailed}
              className="gap-1.5 font-bold text-amber-900 border-amber-200 bg-amber-50/50 hover:bg-amber-100"
            >
              <FileText className="h-4 w-4 text-amber-700" />
              <span>Itemized Detailed PDF</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handlePrintThermal}
              className="gap-1.5 font-bold text-purple-900 border-purple-200 bg-purple-50/50 hover:bg-purple-100"
            >
              <Receipt className="h-4 w-4 text-purple-700" />
              <span>Thermal (80mm)</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleWhatsApp}
              className="gap-1.5 font-bold text-emerald-800 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
            >
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              <span>WhatsApp</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleExportCsv}
              className="gap-1.5 font-medium"
              title="Download CSV"
            >
              <Download className="h-4 w-4 text-gray-600" />
              <span className="hidden sm:inline">CSV</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setVoucherModal("got")}
              className="gap-1 font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              <ArrowDownLeft className="h-4 w-4" />
              <span>+ Record Payment</span>
            </Button>
          </div>
        )}
      </div>

      {/* Party Selection & Date Range Bar */}
      <div className="grid gap-4 lg:grid-cols-12 bg-white p-4 rounded-xl border shadow-xs">
        {/* Party Selector */}
        <div className="lg:col-span-5 space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
            Select Customer / Party
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search party by name or phone..."
                value={partySearch}
                onChange={(e) => setPartySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <select
              value={selectedCustomerId}
              onChange={(e) => {
                setSelectedCustomerId(e.target.value);
                router.replace(`/admin/party-statements?customerId=${e.target.value}`);
              }}
              className="max-w-[200px] border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {filteredCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.mobile ? `(${c.mobile})` : ""}
                </option>
              ))}
            </select>
          </div>

          {activeParty && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-gray-600">
              <span className="font-semibold text-gray-900">{activeParty.name}</span>
              {activeParty.mobile && <span>· Ph: {activeParty.mobile}</span>}
              {activeParty.gst_number && <span>· GST: {activeParty.gst_number}</span>}
              {activeParty.address && <span>· {activeParty.address}</span>}
            </div>
          )}
        </div>

        {/* Date Range Selector */}
        <div className="lg:col-span-7 space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
            Statement Period
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ["all", "All Time"],
                ["today", "Today"],
                ["this_week", "This Week"],
                ["this_month", "This Month"],
                ["last_30_days", "30 Days"],
                ["financial_year", "Financial Year"],
                ["custom", "Custom"],
              ] as const
            ).map(([preset, label]) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={datePreset === preset ? "primary" : "outline"}
                onClick={() => setDatePreset(preset)}
                className="text-xs h-8 px-2.5"
              >
                {label}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={loadStatement}
              className="text-xs h-8 px-2 ml-auto"
              title="Reload statement"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>

          {datePreset === "custom" && (
            <div className="flex items-center gap-2 pt-2">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 text-xs max-w-[150px]"
              />
              <span className="text-xs text-gray-500">to</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 text-xs max-w-[150px]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && !statementData && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}

      {/* Statement Content */}
      {statementData && (
        <div className="space-y-6">
          {/* Snapshot Metric Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Opening Balance */}
            <div className="rounded-xl border bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Opening Balance
              </span>
              <p className="mt-1 text-2xl font-black text-gray-900">
                {formatPrice(statementData.openingBalance)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                Prior to {dateRange.label}
              </p>
            </div>

            {/* Total Debits (Given) */}
            <div className="rounded-xl border bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total Given (Debits)
                </span>
                <span className="rounded-full bg-red-100 p-1 text-red-700">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-1 text-2xl font-black text-red-600">
                +{formatPrice(statementData.totalDebits)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                Sales bills & udhaar taken
              </p>
            </div>

            {/* Total Credits (Received) */}
            <div className="rounded-xl border bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total Received (Credits)
                </span>
                <span className="rounded-full bg-emerald-100 p-1 text-emerald-700">
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-1 text-2xl font-black text-emerald-600">
                −{formatPrice(statementData.totalCredits)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                Cash, UPI & collections
              </p>
            </div>

            {/* Net Closing Balance */}
            <div
              className={cn(
                "rounded-xl border p-4 shadow-xs",
                statementData.closingBalance > 0
                  ? "bg-red-50/70 border-red-200"
                  : statementData.closingBalance < 0
                  ? "bg-blue-50/70 border-blue-200"
                  : "bg-emerald-50/70 border-emerald-200"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Net Closing Balance
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                    statementData.closingBalance > 0
                      ? "bg-red-200 text-red-900"
                      : statementData.closingBalance < 0
                      ? "bg-blue-200 text-blue-900"
                      : "bg-emerald-200 text-emerald-900"
                  )}
                >
                  {statementData.closingBalance > 0
                    ? "You'll Get"
                    : statementData.closingBalance < 0
                    ? "You'll Give"
                    : "Settled"}
                </span>
              </div>
              <p
                className={cn(
                  "mt-1 text-2xl font-black tracking-tight",
                  statementData.closingBalance > 0
                    ? "text-red-700"
                    : statementData.closingBalance < 0
                    ? "text-blue-700"
                    : "text-emerald-700"
                )}
              >
                {formatPrice(Math.abs(statementData.closingBalance))}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-gray-600">
                {statementData.closingBalance > 0
                  ? "Receivable Outstanding (Dr)"
                  : statementData.closingBalance < 0
                  ? "Payable Advance Held (Cr)"
                  : "All accounts fully cleared (₹0.00)"}
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 gap-6">
            <button
              type="button"
              onClick={() => setActiveTab("ledger")}
              className={cn(
                "pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5",
                activeTab === "ledger"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              )}
            >
              <Receipt className="h-4 w-4" />
              <span>Statement Ledger ({statementData.ledger.length} entries)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("items")}
              className={cn(
                "pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5",
                activeTab === "items"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              )}
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Itemized Sales ({statementData.sales.length} bills)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("payments")}
              className={cn(
                "pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5",
                activeTab === "payments"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              )}
            >
              <CreditCard className="h-4 w-4" />
              <span>
                Payments Received (
                {statementData.ledger.filter((e) => e.type === "payment" && e.referenceType !== "sales_return").length}
                )
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("returns")}
              className={cn(
                "pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5",
                activeTab === "returns"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              )}
            >
              <RotateCcw className="h-4 w-4" />
              <span>
                Sales Returns / Credit Notes (
                {statementData.salesReturns?.length ||
                  statementData.ledger.filter((e) => e.referenceType === "sales_return" || e.description.toLowerCase().includes("sales return")).length}
                )
              </span>
            </button>
          </div>

          {/* TAB 1: Statement Ledger Table */}
          {activeTab === "ledger" && (
            <div className="bg-white rounded-xl border shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b text-[11px] font-black uppercase tracking-wider text-gray-500">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Voucher Type</th>
                      <th className="py-3 px-4">Particulars / Narration</th>
                      <th className="py-3 px-4 text-right">Debit (+) Given</th>
                      <th className="py-3 px-4 text-right">Credit (−) Received</th>
                      <th className="py-3 px-4 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {/* Opening Balance Row */}
                    <tr className="bg-amber-50/40 font-semibold text-gray-700">
                      <td className="py-2.5 px-4 text-xs">
                        {dateRange.from ? formatDate(dateRange.from) : "Start"}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold border border-gray-300 bg-gray-50 text-gray-700">
                          Opening
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-gray-600">
                        Opening Balance carried forward
                      </td>
                      <td className="py-2.5 px-4 text-right">—</td>
                      <td className="py-2.5 px-4 text-right">—</td>
                      <td className="py-2.5 px-4 text-right font-bold text-gray-900">
                        {formatPrice(statementData.openingBalance)}
                      </td>
                    </tr>

                    {/* Ledger Entries */}
                    {statementData.ledger.map((e, idx) => (
                      <tr key={e.id || idx} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-4 text-xs whitespace-nowrap text-gray-700">
                          {format(new Date(e.date), "dd/MM/yyyy hh:mm a")}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              "inline-block rounded-md px-2 py-0.5 text-[10px] font-black uppercase",
                              e.referenceType === "sales_return" || e.description.toLowerCase().includes("sales return")
                                ? "bg-purple-100 text-purple-800 border border-purple-200"
                                : e.type === "credit"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : e.type === "payment"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-gray-100 text-gray-700"
                            )}
                          >
                            {e.referenceType === "sales_return" || e.description.toLowerCase().includes("sales return")
                              ? "Sales Return (Cr)"
                              : e.type === "credit"
                              ? "Sale / Udhaar"
                              : e.type === "payment"
                              ? "Collection"
                              : "Adjustment"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-gray-900">{e.description}</p>
                          {e.notes && (
                            <p className="text-xs text-gray-500 mt-0.5">{e.notes}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-red-600 whitespace-nowrap">
                          {e.debit > 0 ? `+${formatPrice(e.debit)}` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 whitespace-nowrap">
                          {e.credit > 0 ? `−${formatPrice(e.credit)}` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-gray-900 whitespace-nowrap">
                          {formatPrice(e.runningBalance)}
                        </td>
                      </tr>
                    ))}

                    {statementData.ledger.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-500">
                          No transactions found for the selected period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50/90 border-t-2 font-bold text-gray-900">
                      <td colSpan={3} className="py-3 px-4 text-right text-xs uppercase tracking-wider">
                        Period Totals / Closing Balance:
                      </td>
                      <td className="py-3 px-4 text-right font-black text-red-700">
                        +{formatPrice(statementData.totalDebits)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-700">
                        −{formatPrice(statementData.totalCredits)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-base text-gray-900">
                        {formatPrice(Math.abs(statementData.closingBalance))}
                        <span className="block text-[10px] font-normal text-gray-500">
                          {statementData.closingBalance > 0
                            ? "(Dr / Receivable)"
                            : statementData.closingBalance < 0
                            ? "(Cr / Advance)"
                            : "(Settled)"}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Itemized Sales Breakdown */}
          {activeTab === "items" && (
            <div className="space-y-4">
              {statementData.sales.map((sale) => {
                const isExpanded = expandedSaleIds.has(sale.id);
                return (
                  <div
                    key={sale.id}
                    className="bg-white rounded-xl border shadow-xs overflow-hidden transition-all"
                  >
                    <div
                      onClick={() => toggleSaleExpand(sale.id)}
                      className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                          <ShoppingBag className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">
                              Bill #{sale.bill_number}
                            </span>
                            <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold border border-gray-300 bg-gray-50 text-gray-700">
                              {sale.pos_sale_items?.length || 0} items
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {format(new Date(sale.created_at), "dd/MM/yyyy hh:mm a")} · Mode: {sale.payment_method.toUpperCase()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-base font-black text-gray-900">
                            {formatPrice(sale.total_amount)}
                          </p>
                          {Number(sale.discount) > 0 && (
                            <p className="text-xs text-emerald-600">
                              Disc: {formatPrice(sale.discount)}
                            </p>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-gray-50/50 p-4">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="border-b font-bold text-gray-500">
                              <th className="pb-2">Product Name</th>
                              <th className="pb-2 text-center">Unit / Packaging</th>
                              <th className="pb-2 text-right">Quantity</th>
                              <th className="pb-2 text-right">Rate (₹)</th>
                              <th className="pb-2 text-right">Total (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200/50">
                            {(sale.pos_sale_items || []).map((item, idx) => (
                              <tr key={idx} className="py-2">
                                <td className="py-2 font-medium text-gray-900">
                                  {item.product_name}
                                </td>
                                <td className="py-2 text-center text-gray-600 uppercase">
                                  {(item as any).unit || "pcs"}
                                </td>
                                <td className="py-2 text-right font-semibold">
                                  {item.quantity}
                                </td>
                                <td className="py-2 text-right">
                                  {formatPrice(item.rate)}
                                </td>
                                <td className="py-2 text-right font-bold text-gray-900">
                                  {formatPrice(item.total_amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {statementData.sales.length === 0 && (
                <div className="bg-white p-12 text-center rounded-xl border text-gray-500">
                  No sales bills found for this customer in the selected date range.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Payment History */}
          {activeTab === "payments" && (
            <div className="bg-white rounded-xl border shadow-xs overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-[11px] font-black uppercase tracking-wider text-gray-500">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Amount Received</th>
                    <th className="py-3 px-4">Narration / Notes</th>
                    <th className="py-3 px-4 text-right">Balance After Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {statementData.ledger
                    .filter((e) => e.type === "payment" || e.credit > 0)
                    .map((p, idx) => (
                      <tr key={p.id || idx} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-xs font-medium text-gray-700">
                          {format(new Date(p.date), "dd/MM/yyyy hh:mm a")}
                        </td>
                        <td className="py-3 px-4 font-black text-emerald-600">
                          {formatPrice(p.credit)}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600">
                          {p.description} {p.notes ? `(${p.notes})` : ""}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-gray-900">
                          {formatPrice(p.runningBalance)}
                        </td>
                      </tr>
                    ))}

                  {statementData.ledger.filter((e) => e.type === "payment" || e.credit > 0).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-gray-500">
                        No payments recorded in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: Sales Returns / Credit Notes */}
          {activeTab === "returns" && (
            <div className="space-y-4">
              {(statementData.salesReturns || []).map((ret: any) => (
                <div
                  key={ret.id}
                  className="bg-white rounded-xl border shadow-xs overflow-hidden"
                >
                  <div className="p-4 flex flex-wrap items-center justify-between gap-4 bg-purple-50/30">
                    <div className="flex items-center gap-3">
                      <span className="rounded-lg bg-purple-100 p-2 text-purple-700">
                        <RotateCcw className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">
                            Return #{ret.return_number}
                          </span>
                          <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                            Credit Note
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {format(new Date(ret.return_date || ret.created_at), "dd/MM/yyyy")} · Reason: {ret.reason || "Customer Return"}
                          {ret.notes ? ` · Note: ${ret.notes}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-purple-700">
                        −{formatPrice(ret.total_amount)}
                      </p>
                      <p className="text-[11px] font-semibold text-emerald-600">
                        Credited to Customer
                      </p>
                    </div>
                  </div>

                  {ret.sales_return_items && ret.sales_return_items.length > 0 && (
                    <div className="border-t p-4">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b font-bold text-gray-500">
                            <th className="pb-2">Returned Product</th>
                            <th className="pb-2 text-right">Quantity</th>
                            <th className="pb-2 text-right">Rate (₹)</th>
                            <th className="pb-2 text-right">Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {ret.sales_return_items.map((item: any, idx: number) => (
                            <tr key={idx} className="py-2">
                              <td className="py-2 font-medium text-gray-900">
                                {item.product_name}
                              </td>
                              <td className="py-2 text-right font-semibold">
                                {item.quantity}
                              </td>
                              <td className="py-2 text-right">
                                {formatPrice(item.rate)}
                              </td>
                              <td className="py-2 text-right font-bold text-purple-700">
                                {formatPrice(item.total_amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}

              {(!statementData.salesReturns || statementData.salesReturns.length === 0) && (
                <div className="bg-white p-12 text-center rounded-xl border text-gray-500">
                  No sales returns found for this customer in the selected date range.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Voucher Modal */}
      {voucherModal && activeParty && (
        <KhataVoucherForm
          customer={activeParty}
          mode={voucherModal}
          onClose={() => setVoucherModal(null)}
          onSaved={() => {
            setVoucherModal(null);
            loadStatement();
          }}
        />
      )}
    </div>
  );
}

export default function PartyStatementsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      }
    >
      <PartyStatementsContent />
    </Suspense>
  );
}


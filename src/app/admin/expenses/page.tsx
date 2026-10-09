"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Printer,
  Plus,
  Search,
  Pencil,
  Trash2,
  Calendar,
  IndianRupee,
  TrendingDown,
  Building2,
  Zap,
  Users,
  Truck,
  Wrench,
  Tag,
  Download,
  RefreshCw,
  X,
  Check,
  Copy,
  AlertTriangle,
  Eye,
  ArrowUpDown,
  Filter,
  Wallet,
  Sparkles,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { expenseService } from "@/services/erp";
import type { Expense } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice, formatDate } from "@/utils/format";
import { printSystematicDocument } from "@/utils/document-print";
import { cn } from "@/utils/cn";

const SUGGESTED_TYPES = [
  "Rent",
  "Electricity",
  "Salaries",
  "Transport",
  "Repairs",
  "Tea & Snacks",
  "Shop Maintenance",
  "Packaging Materials",
  "Stationery & Printing",
  "Cleaning & Pest Control",
  "Fuel & Diesel",
  "Miscellaneous",
];

const KNOWN_TYPE_STYLES: Record<
  string,
  { bg: string; text: string; border: string; badge: string; icon: React.ElementType }
> = {
  rent: {
    bg: "bg-indigo-50/70",
    text: "text-indigo-700",
    border: "border-indigo-200",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: Building2,
  },
  electricity: {
    bg: "bg-amber-50/70",
    text: "text-amber-700",
    border: "border-amber-200",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Zap,
  },
  salaries: {
    bg: "bg-emerald-50/70",
    text: "text-emerald-700",
    border: "border-emerald-200",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: Users,
  },
  salary: {
    bg: "bg-emerald-50/70",
    text: "text-emerald-700",
    border: "border-emerald-200",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: Users,
  },
  transport: {
    bg: "bg-sky-50/70",
    text: "text-sky-700",
    border: "border-sky-200",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    icon: Truck,
  },
  repairs: {
    bg: "bg-orange-50/70",
    text: "text-orange-700",
    border: "border-orange-200",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    icon: Wrench,
  },
  maintenance: {
    bg: "bg-orange-50/70",
    text: "text-orange-700",
    border: "border-orange-200",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    icon: Wrench,
  },
  miscellaneous: {
    bg: "bg-slate-50/80",
    text: "text-slate-700",
    border: "border-slate-200",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    icon: Tag,
  },
};

export function getExpenseType(e: Expense): string {
  if (e.notes && e.notes.startsWith("[Type: ")) {
    const match = e.notes.match(/^\[Type:\s*(.*?)\]/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return e.category?.trim() || "General";
}

export function getCleanNotes(notes?: string | null): string {
  if (!notes) return "";
  return notes.replace(/^\[Type:\s*.*?\]\s*/, "").trim();
}

function getTypeStyle(typeName: string) {
  const lower = typeName.toLowerCase().trim();
  for (const [k, style] of Object.entries(KNOWN_TYPE_STYLES)) {
    if (lower.includes(k)) return style;
  }
  return {
    bg: "bg-rose-50/60",
    text: "text-rose-700",
    border: "border-rose-200",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    icon: Tag,
  };
}

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

type DateFilterPreset = "all" | "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom";
type SortOption = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("date_desc");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states for creating voucher (using TEXT box for type)
  const [showAddSection, setShowAddSection] = useState(false);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category: "",
    amount: 0,
    notes: "",
    receipt_url: "",
  });

  // State for Editing voucher (using TEXT box for type)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState({
    expense_date: "",
    category: "",
    amount: 0,
    notes: "",
    receipt_url: "",
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // State for Deleting voucher
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // State for Receipt modal
  const [receiptModalUrl, setReceiptModalUrl] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await expenseService.list();
      setExpenses(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Copy voucher ID
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(`EXP-${id.slice(0, 8).toUpperCase()}`);
    setCopiedId(id);
    toast.success("Voucher ID copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Create new voucher
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.amount <= 0) {
      toast.error("Please enter a valid amount greater than ₹0");
      return;
    }
    const typeVal = form.category.trim() || "General";
    setIsSubmittingNew(true);
    try {
      const created = await expenseService.create({
        expense_date: form.expense_date,
        category: typeVal,
        amount: Number(form.amount),
        notes: form.notes.trim() || undefined,
        receipt_url: form.receipt_url.trim() || undefined,
      });
      toast.success(`Expense voucher EXP-${created.id.slice(0, 8).toUpperCase()} recorded`);
      setForm({
        expense_date: new Date().toISOString().slice(0, 10),
        category: "",
        amount: 0,
        notes: "",
        receipt_url: "",
      });
      setShowAddSection(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record expense");
    } finally {
      setIsSubmittingNew(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (expense: Expense) => {
    const typeName = getExpenseType(expense);
    const cleanNotes = getCleanNotes(expense.notes);
    setEditingExpense(expense);
    setEditForm({
      expense_date: expense.expense_date,
      category: typeName,
      amount: Number(expense.amount),
      notes: cleanNotes,
      receipt_url: expense.receipt_url || "",
    });
  };

  // Save Edited Voucher
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    if (editForm.amount <= 0) {
      toast.error("Please enter a valid amount greater than ₹0");
      return;
    }
    const typeVal = editForm.category.trim() || "General";
    setIsSubmittingEdit(true);
    try {
      const updated = await expenseService.update(editingExpense.id, {
        expense_date: editForm.expense_date,
        category: typeVal,
        amount: Number(editForm.amount),
        notes: editForm.notes.trim() || null,
        receipt_url: editForm.receipt_url.trim() || null,
      });

      // Update state locally
      setExpenses((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      toast.success(`Voucher EXP-${updated.id.slice(0, 8).toUpperCase()} updated successfully`);
      setEditingExpense(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update voucher");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Delete Voucher
  const handleDelete = async () => {
    if (!deletingExpense) return;
    setIsDeleting(true);
    try {
      await expenseService.delete(deletingExpense.id);
      setExpenses((prev) => prev.filter((item) => item.id !== deletingExpense.id));
      toast.success(`Voucher EXP-${deletingExpense.id.slice(0, 8).toUpperCase()} deleted permanently`);
      setDeletingExpense(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete voucher");
    } finally {
      setIsDeleting(false);
    }
  };

  // Dynamic set of all unique expense types from current records + common suggestions
  const dynamicExpenseTypes = useMemo(() => {
    const set = new Set<string>();
    for (const e of expenses) {
      const t = getExpenseType(e);
      if (t) set.add(t);
    }
    return Array.from(set);
  }, [expenses]);

  // Filter & Search Logic
  const filteredExpenses = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    return expenses
      .filter((e) => {
        const itemType = getExpenseType(e);

        // Type Filter
        if (typeFilter !== "all" && itemType.toLowerCase() !== typeFilter.toLowerCase()) {
          return false;
        }

        // Date Filter Preset
        if (datePreset === "today") {
          if (e.expense_date !== todayStr) return false;
        } else if (datePreset === "yesterday") {
          const y = new Date();
          y.setDate(y.getDate() - 1);
          if (e.expense_date !== y.toISOString().slice(0, 10)) return false;
        } else if (datePreset === "this_week") {
          const d = new Date();
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(d.setDate(diff)).toISOString().slice(0, 10);
          if (e.expense_date < monday) return false;
        } else if (datePreset === "this_month") {
          const currentYearMonth = todayStr.slice(0, 7);
          if (!e.expense_date.startsWith(currentYearMonth)) return false;
        } else if (datePreset === "last_month") {
          const now = new Date();
          const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthPrefix = lastMonthDate.toISOString().slice(0, 7);
          if (!e.expense_date.startsWith(lastMonthPrefix)) return false;
        } else if (datePreset === "custom") {
          if (customFrom && e.expense_date < customFrom) return false;
          if (customTo && e.expense_date > customTo) return false;
        }

        // Search Filter (notes, type/category name, voucher id, amount)
        if (search.trim()) {
          const q = search.toLowerCase();
          const cleanNotes = getCleanNotes(e.notes).toLowerCase();
          const code = `exp-${e.id.slice(0, 8).toLowerCase()}`;
          const amountStr = String(e.amount);

          if (
            !itemType.toLowerCase().includes(q) &&
            !cleanNotes.includes(q) &&
            !code.includes(q) &&
            !amountStr.includes(q)
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === "date_desc") {
          return new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime();
        } else if (sortOption === "date_asc") {
          return new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime();
        } else if (sortOption === "amount_desc") {
          return Number(b.amount) - Number(a.amount);
        } else if (sortOption === "amount_asc") {
          return Number(a.amount) - Number(b.amount);
        }
        return 0;
      });
  }, [expenses, typeFilter, datePreset, customFrom, customTo, search, sortOption]);

  // Executive KPI Statistics
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const thisMonthPrefix = todayStr.slice(0, 7);

    let todayTotal = 0;
    let todayCount = 0;
    let monthTotal = 0;
    let monthCount = 0;

    const typeTotals: Record<string, number> = {};

    for (const e of expenses) {
      const amt = Number(e.amount) || 0;
      const t = getExpenseType(e);

      if (e.expense_date === todayStr) {
        todayTotal += amt;
        todayCount++;
      }
      if (e.expense_date.startsWith(thisMonthPrefix)) {
        monthTotal += amt;
        monthCount++;
      }
      typeTotals[t] = (typeTotals[t] || 0) + amt;
    }

    const filteredTotal = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const avgVoucher =
      filteredExpenses.length > 0 ? filteredTotal / filteredExpenses.length : 0;

    // Determine Top Type
    let topType = "General";
    let topTypeAmount = 0;
    for (const [t, amt] of Object.entries(typeTotals)) {
      if (amt > topTypeAmount) {
        topType = t;
        topTypeAmount = amt;
      }
    }

    return {
      todayTotal,
      todayCount,
      monthTotal,
      monthCount,
      filteredTotal,
      avgVoucher,
      topType,
      topTypeAmount,
      totalAllTime: expenses.reduce((s, e) => s + Number(e.amount), 0),
    };
  }, [expenses, filteredExpenses]);

  // Type counts and totals for dynamic pills
  const typePillStats = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    for (const e of expenses) {
      const t = getExpenseType(e);
      if (!map[t]) {
        map[t] = { count: 0, total: 0 };
      }
      map[t].count++;
      map[t].total += Number(e.amount);
    }
    return map;
  }, [expenses]);

  // Export to CSV
  const exportToCSV = () => {
    if (filteredExpenses.length === 0) {
      toast.error("No expenses to export");
      return;
    }
    const headers = ["Voucher ID", "Date", "Expense Type", "Amount (INR)", "Particulars / Notes", "Receipt URL"];
    const rows = filteredExpenses.map((e) => [
      `EXP-${e.id.slice(0, 8).toUpperCase()}`,
      e.expense_date,
      `"${getExpenseType(e).replace(/"/g, '""')}"`,
      Number(e.amount).toFixed(2),
      `"${getCleanNotes(e.notes).replace(/"/g, '""')}"`,
      e.receipt_url || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `odhavram_expenses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Expenses exported as CSV");
  };

  // Systematic Document Print Single Voucher
  const printExpenseVoucher = (e: Expense) => {
    const expType = getExpenseType(e);
    const cleanNotes = getCleanNotes(e.notes);

    printSystematicDocument({
      docTitle: "PAYMENT / EXPENSE VOUCHER",
      docBadge: "ORIGINAL VOUCHER",
      docNumber: `EXP-${e.id.slice(0, 8).toUpperCase()}`,
      docDate: formatDate(e.expense_date),
      partyTitle: "Expense Particulars",
      partyDetails: {
        name: expType,
        extra: cleanNotes ? `Remarks: ${cleanNotes}` : "General Store Operating Expense",
      },
      metadata: [
        { label: "Voucher ID", value: `EXP-${e.id.slice(0, 8).toUpperCase()}` },
        { label: "Expense Date", value: formatDate(e.expense_date) },
        { label: "Expense Type", value: expType },
        { label: "Payment Mode", value: "Cash / Operating Payout" },
        { label: "Total Amount", value: formatPrice(e.amount) },
      ],
      columns: [
        { header: "Sr.", width: "10%" },
        { header: "Head of Account / Purpose", width: "55%" },
        { header: "Expense Type", width: "20%" },
        { header: "Amount (₹)", align: "right", width: "15%" },
      ],
      rows: [
        {
          cells: [
            1,
            cleanNotes ? `${expType} — ${cleanNotes}` : expType,
            expType.toUpperCase(),
            formatPrice(e.amount),
          ],
        },
      ],
      summaryRows: [
        { label: "Net Voucher Amount", value: formatPrice(e.amount), isBold: true, isHighlight: true },
      ],
      notes: [
        "Payment disbursed from store petty cash / operating cash drawer.",
        "Verified by store manager and recorded in accounts ledger.",
      ],
      signatories: ["Paid By (Cashier)", "Receiver / Payee", "Approved By (Manager)"],
    });
  };

  // Systematic Document Print Full Register
  const printExpensesRegister = () => {
    if (filteredExpenses.length === 0) {
      toast.error("No expenses found to print.");
      return;
    }
    printSystematicDocument({
      docTitle: "EXPENSE REGISTER / CASH OUTFLOW AUDIT",
      docBadge: "ACCOUNTS AUDIT COPY",
      docNumber: `EXP-REG-${new Date().toISOString().slice(0, 10)}`,
      metadata: [
        { label: "Total Expenses Recorded", value: filteredExpenses.length },
        { label: "Total Expenditure", value: formatPrice(stats.filteredTotal) },
        { label: "Type Filter", value: typeFilter.toUpperCase() },
        { label: "Generated Date", value: formatDate(new Date().toISOString()) },
      ],
      columns: [
        { header: "Date", width: "15%" },
        { header: "Voucher ID", width: "15%" },
        { header: "Expense Type", width: "20%" },
        { header: "Notes / Details", width: "35%" },
        { header: "Amount", align: "right", width: "15%" },
      ],
      rows: filteredExpenses.map((e) => ({
        cells: [
          formatDate(e.expense_date),
          `EXP-${e.id.slice(0, 8).toUpperCase()}`,
          getExpenseType(e),
          getCleanNotes(e.notes) || "—",
          formatPrice(e.amount),
        ],
      })),
      summaryRows: [
        { label: "Total Expense Vouchers", value: String(filteredExpenses.length) },
        { label: "Total Expense Outflow", value: formatPrice(stats.filteredTotal), isBold: true, isHighlight: true },
      ],
      notes: [
        "Official Odhavram General Store audit register of all verified business expenses.",
      ],
      signatories: ["Prepared By", "Store Accountant / Proprietor"],
    });
  };

  return (
    <div className="space-y-6">
      {/* Shared Datalist for Expense Types */}
      <datalist id="suggested-expense-types">
        {SUGGESTED_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
        {dynamicExpenseTypes.map((t) => (
          <option key={`dyn-${t}`} value={t} />
        ))}
      </datalist>

      {/* Top Banner & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-md shadow-rose-500/20">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  Expense Management
                </h1>
                <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                  Cash Outflows
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500">
                Record store expenditures, create audited payment vouchers, edit records, and track daily cash outflows.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={load}
            loading={loading}
            className="gap-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
            title="Refresh expenses"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {filteredExpenses.length > 0 && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="gap-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5 text-blue-600" />
                <span>Export CSV</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={printExpensesRegister}
                className="gap-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 border-emerald-200"
              >
                <Printer className="h-3.5 w-3.5 text-emerald-600" />
                <span>Print Register</span>
              </Button>
            </>
          )}

          <Button
            type="button"
            size="sm"
            onClick={() => setShowAddSection((v) => !v)}
            className="gap-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
          >
            {showAddSection ? (
              <>
                <X className="h-3.5 w-3.5" />
                <span>Close Form</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                <span>Record New Expense</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* KPI Statistic Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today's Expenses */}
        <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/70 via-white to-white p-4 shadow-2xs hover:shadow-sm transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
              Today&apos;s Outflow
            </span>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">
              Today
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-gray-900">
              {formatPrice(stats.todayTotal)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {stats.todayCount} voucher{stats.todayCount === 1 ? "" : "s"} today
          </p>
        </div>

        {/* This Month's Expenses */}
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-white p-4 shadow-2xs hover:shadow-sm transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
              This Month
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">
              MTD
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-gray-900">
              {formatPrice(stats.monthTotal)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {stats.monthCount} voucher{stats.monthCount === 1 ? "" : "s"} this month
          </p>
        </div>

        {/* Filtered Outflow */}
        <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/70 via-white to-white p-4 shadow-2xs hover:shadow-sm transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
              Selected Total
            </span>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-black text-purple-700">
              {filteredExpenses.length} Records
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-purple-950">
              {formatPrice(stats.filteredTotal)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Avg: {formatPrice(stats.avgVoucher)} / voucher
          </p>
        </div>

        {/* Top Expense Type */}
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/70 via-white to-white p-4 shadow-2xs hover:shadow-sm transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Top Expense Type
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
              Primary
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-gray-900 capitalize truncate">
              {stats.topType}
            </span>
          </div>
          <p className="mt-1 text-xs text-amber-800">
            {formatPrice(stats.topTypeAmount)} total spent
          </p>
        </div>
      </div>

      {/* Record New Expense Form Card */}
      {showAddSection && (
        <div className="rounded-2xl border-2 border-rose-200 bg-gradient-to-b from-rose-50/30 via-white to-white p-4 sm:p-6 shadow-md animate-in slide-in-from-top-2 duration-200">
          <div className="mb-4 flex items-center justify-between border-b border-rose-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-white">
                <Plus className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-gray-900">
                Record New Expense Voucher
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowAddSection(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Voucher Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Voucher Date
                </label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  required
                  className="rounded-xl"
                />
              </div>

              {/* Expense Type (TEXT BOX with Auto-suggest) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Expense Type / Description
                </label>
                <Input
                  type="text"
                  list="suggested-expense-types"
                  placeholder="e.g. Rent, Electricity, Tea & Snacks..."
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  required
                  className="rounded-xl font-medium"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                    ₹
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="0.00"
                    value={form.amount || ""}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    required
                    className="rounded-xl pl-7 text-base font-bold text-rose-950"
                  />
                </div>
              </div>

              {/* Receipt URL / Bill ref */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Receipt / Bill URL (Optional)
                </label>
                <Input
                  placeholder="https://... receipt image"
                  value={form.receipt_url}
                  onChange={(e) => setForm({ ...form, receipt_url: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Quick Type Chips for fast 1-click filling */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500 mr-1">
                Common Types:
              </span>
              {SUGGESTED_TYPES.slice(0, 8).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, category: t })}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-bold transition shadow-2xs",
                    form.category.toLowerCase() === t.toLowerCase()
                      ? "border-rose-500 bg-rose-50 text-rose-800"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Quick Amount Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500 mr-1">
                Quick Amount:
              </span>
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setForm({ ...form, amount: (form.amount || 0) + amt })}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 hover:border-rose-300 transition"
                >
                  +₹{amt}
                </button>
              ))}
              {form.amount > 0 && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, amount: 0 })}
                  className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-100 transition"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Particulars / Payee / Remarks */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Particulars / Payee / Remarks
              </label>
              <Input
                placeholder="e.g. Paid to Torrent Power for March bill, Cash paid to cleaner Ramesh, Vehicle diesel"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="rounded-xl"
              />
            </div>

            {/* Submit & Cancel */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddSection(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={isSubmittingNew}
                className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold px-5"
              >
                <Check className="h-4 w-4" />
                <span>Save Expense Voucher</span>
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Dynamic Type Filter Pills Strip */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Filter by Expense Type
          </span>
          <span className="text-xs text-gray-400">
            Click type pill to filter vouchers
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all shadow-2xs",
              typeFilter === "all"
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            )}
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>All Types</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px]",
                typeFilter === "all" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
              )}
            >
              {expenses.length}
            </span>
          </button>

          {Object.entries(typePillStats).map(([t, pillStat]) => {
            const style = getTypeStyle(t);
            const Icon = style.icon;
            const isActive = typeFilter.toLowerCase() === t.toLowerCase();

            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(isActive ? "all" : t)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all shadow-2xs capitalize",
                  isActive
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? "text-white" : style.text)} />
                <span>{t}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px]",
                    isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                  )}
                >
                  {formatPrice(pillStat.total)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-2xs space-y-3">
        {/* Top row: Search input, Date Presets, Sort */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Live Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Payee, type, notes, voucher ID, amount..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-9 pr-8 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Date presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all", label: "All Time" },
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "this_week", label: "This Week" },
              { id: "this_month", label: "This Month" },
              { id: "last_month", label: "Last Month" },
              { id: "custom", label: "Custom Range" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDatePreset(p.id as DateFilterPreset)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
                  datePreset === p.id
                    ? "bg-rose-600 text-white shadow-2xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Sort:</span>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 focus:border-rose-500 focus:outline-none"
            >
              <option value="date_desc">Date: Newest First</option>
              <option value="date_asc">Date: Oldest First</option>
              <option value="amount_desc">Amount: High to Low</option>
              <option value="amount_asc">Amount: Low to High</option>
            </select>
          </div>
        </div>

        {/* Custom date range row (if selected) */}
        {datePreset === "custom" && (
          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">From:</span>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-36 text-xs rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">To:</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-36 text-xs rounded-lg"
              />
            </div>
            {(customFrom || customTo) && (
              <button
                type="button"
                onClick={() => {
                  setCustomFrom("");
                  setCustomTo("");
                }}
                className="text-xs font-semibold text-red-600 hover:underline"
              >
                Clear Range
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Expenses Table (Desktop) & Cards (Mobile) */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
        {/* Desktop Table View */}
        <div className="hidden md:block max-h-[calc(100vh-320px)] min-h-[300px] overflow-y-auto overscroll-contain scrollbar-thin">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur-xs text-xs font-bold uppercase tracking-wider text-gray-600">
              <tr>
                <th className="p-3.5 text-left">Voucher ID</th>
                <th className="p-3.5 text-left">Date</th>
                <th className="p-3.5 text-left">Expense Type</th>
                <th className="p-3.5 text-left">Particulars / Remarks</th>
                <th className="p-3.5 text-right">Amount (₹)</th>
                <th className="p-3.5 text-center">Receipt</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredExpenses.map((e) => {
                const expType = getExpenseType(e);
                const cleanNotes = getCleanNotes(e.notes);
                const style = getTypeStyle(expType);
                const Icon = style.icon;
                const shortId = `EXP-${e.id.slice(0, 8).toUpperCase()}`;

                return (
                  <tr
                    key={e.id}
                    className="hover:bg-rose-50/20 transition-colors group"
                  >
                    {/* Voucher ID with Copy */}
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200/80">
                          {shortId}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyId(e.id)}
                          className="text-gray-400 hover:text-gray-700 transition"
                          title="Copy Voucher Code"
                        >
                          {copiedId === e.id ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <span>{formatDate(e.expense_date)}</span>
                      </div>
                    </td>

                    {/* Expense Type (Custom Description Badge) */}
                    <td className="p-3.5 whitespace-nowrap">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold capitalize",
                          style.badge
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        <span>{expType}</span>
                      </span>
                    </td>

                    {/* Particulars / Remarks */}
                    <td className="p-3.5 text-gray-700 max-w-xs truncate">
                      <span className="text-xs font-medium">
                        {cleanNotes || "—"}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <span className="text-sm font-black text-gray-900 tabular-nums">
                        {formatPrice(e.amount)}
                      </span>
                    </td>

                    {/* Receipt */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      {e.receipt_url ? (
                        <button
                          type="button"
                          onClick={() => setReceiptModalUrl(e.receipt_url)}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View</span>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    {/* Actions: Print, Edit, Delete */}
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Print */}
                        <button
                          type="button"
                          onClick={() => printExpenseVoucher(e)}
                          className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition"
                          title="Print Systematic Voucher"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => openEditModal(e)}
                          className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-50 border border-blue-200 transition"
                          title="Edit Voucher Details"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => setDeletingExpense(e)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 border border-red-200 transition"
                          title="Delete Voucher Permanently"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-3">
                      <Receipt className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-bold text-gray-800">
                      No expense records found
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Try resetting filters or record a new expense voucher.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="block md:hidden divide-y divide-gray-100 max-h-[calc(100vh-320px)] overflow-y-auto">
          {filteredExpenses.map((e) => {
            const expType = getExpenseType(e);
            const cleanNotes = getCleanNotes(e.notes);
            const style = getTypeStyle(expType);
            const Icon = style.icon;
            const shortId = `EXP-${e.id.slice(0, 8).toUpperCase()}`;

            return (
              <div key={e.id} className="p-4 space-y-3 hover:bg-gray-50 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                      {shortId}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(e.id)}
                      className="text-gray-400 hover:text-gray-700"
                    >
                      {copiedId === e.id ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  <span className="text-sm font-black text-rose-950">
                    {formatPrice(e.amount)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold capitalize",
                      style.badge
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{expType}</span>
                  </span>
                  <span>{formatDate(e.expense_date)}</span>
                </div>

                {cleanNotes && (
                  <p className="text-xs font-medium text-gray-700 bg-gray-50 rounded-lg p-2 border border-gray-100">
                    {cleanNotes}
                  </p>
                )}

                {/* Mobile Action Buttons */}
                <div className="flex items-center justify-between pt-1">
                  {e.receipt_url ? (
                    <button
                      type="button"
                      onClick={() => setReceiptModalUrl(e.receipt_url)}
                      className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Receipt</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => printExpenseVoucher(e)}
                      className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-xs font-bold text-emerald-800"
                    >
                      <Printer className="h-3 w-3 text-emerald-600" />
                      <span>Print</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(e)}
                      className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-xs font-bold text-blue-800"
                    >
                      <Pencil className="h-3 w-3 text-blue-600" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingExpense(e)}
                      className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/70 px-2.5 py-1 text-xs font-bold text-red-700"
                    >
                      <Trash2 className="h-3 w-3 text-red-600" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredExpenses.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <p className="text-sm font-bold text-gray-800">No expense records found</p>
              <p className="text-xs text-gray-400 mt-1">Try resetting filters.</p>
            </div>
          )}
        </div>

        {/* Footer Summary Bar */}
        {filteredExpenses.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50/90 px-4 py-3 text-xs text-gray-600 flex flex-wrap items-center justify-between gap-2">
            <span>
              Showing <strong>{filteredExpenses.length}</strong> voucher{filteredExpenses.length === 1 ? "" : "s"} · Total Filtered: <strong className="text-gray-900">{formatPrice(stats.filteredTotal)}</strong>
            </span>
            <span className="text-gray-400 text-[11px]">
              Odhavram General Store Ledger Audit
            </span>
          </div>
        )}
      </div>

      {/* EDIT VOUCHER MODAL */}
      {editingExpense && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-lg rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <Pencil className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Edit Expense Voucher
                  </h3>
                  <p className="font-mono text-xs font-bold text-gray-500">
                    EXP-{editingExpense.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Edit Form (TEXT BOX for Type) */}
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Voucher Date
                  </label>
                  <Input
                    type="date"
                    value={editForm.expense_date}
                    onChange={(e) =>
                      setEditForm({ ...editForm, expense_date: e.target.value })
                    }
                    required
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Expense Type / Description
                  </label>
                  <Input
                    type="text"
                    list="suggested-expense-types"
                    placeholder="e.g. Rent, Electricity, Salaries..."
                    value={editForm.category}
                    onChange={(e) =>
                      setEditForm({ ...editForm, category: e.target.value })
                    }
                    required
                    className="rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                    ₹
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    value={editForm.amount || ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, amount: Number(e.target.value) })
                    }
                    required
                    className="rounded-xl pl-7 text-base font-bold text-gray-900"
                  />
                </div>
              </div>

              {/* Quick Amount adjustments in Edit */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-500 mr-1">
                  Adjust:
                </span>
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() =>
                      setEditForm({
                        ...editForm,
                        amount: (editForm.amount || 0) + amt,
                      })
                    }
                    className="rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Particulars / Payee / Remarks
                </label>
                <Input
                  placeholder="e.g. Electricity bill, Staff wage, Store maintenance"
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm({ ...editForm, notes: e.target.value })
                  }
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Receipt URL (Optional)
                </label>
                <Input
                  placeholder="https://... receipt image"
                  value={editForm.receipt_url}
                  onChange={(e) =>
                    setEditForm({ ...editForm, receipt_url: e.target.value })
                  }
                  className="rounded-xl"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingExpense(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  loading={isSubmittingEdit}
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  <Check className="h-4 w-4" />
                  <span>Update Voucher</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingExpense && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Delete Expense Voucher?
                </h3>
                <p className="font-mono text-xs font-bold text-gray-500">
                  EXP-{deletingExpense.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-4">
              Are you sure you want to delete this expense record? This will permanently remove the voucher from the accounts ledger and cash reports.
            </p>

            {/* Voucher Details Box */}
            <div className="rounded-xl bg-red-50/60 border border-red-100 p-3 mb-5 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Date:</span>
                <span className="font-semibold text-gray-900">
                  {formatDate(deletingExpense.expense_date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Expense Type:</span>
                <span className="font-bold text-gray-900 capitalize">
                  {getExpenseType(deletingExpense)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount:</span>
                <span className="font-black text-red-700 text-sm">
                  {formatPrice(deletingExpense.amount)}
                </span>
              </div>
              {getCleanNotes(deletingExpense.notes) && (
                <div className="flex justify-between pt-1 border-t border-red-100/80">
                  <span className="text-gray-500">Notes:</span>
                  <span className="font-medium text-gray-800 truncate max-w-[12rem]">
                    {getCleanNotes(deletingExpense.notes)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeletingExpense(null)}
                disabled={isDeleting}
              >
                Keep Voucher
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleDelete}
                loading={isDeleting}
                className="gap-1.5 font-bold"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Permanently</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT PREVIEW MODAL */}
      {receiptModalUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setReceiptModalUrl(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl bg-white p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b p-2">
              <span className="text-xs font-bold text-gray-800">
                Expense Receipt / Bill Document
              </span>
              <button
                type="button"
                onClick={() => setReceiptModalUrl(null)}
                className="rounded p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center max-h-[80vh] overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receiptModalUrl}
                alt="Expense Receipt"
                className="max-h-[75vh] max-w-[85vw] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

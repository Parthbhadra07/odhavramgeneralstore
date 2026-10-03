"use client";

import { useEffect, useState } from "react";
import { Printer, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { expenseService } from "@/services/erp";
import type { Expense } from "@/types/erp";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/erp/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice, formatDate } from "@/utils/format";
import { printSystematicDocument } from "@/utils/document-print";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category: "miscellaneous" as const,
    amount: 0,
    notes: "",
  });

  const load = () => expenseService.list().then(setExpenses);

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    try {
      await expenseService.create(form);
      toast.success("Expense voucher recorded");
      setForm({
        expense_date: new Date().toISOString().slice(0, 10),
        category: "miscellaneous",
        amount: 0,
        notes: "",
      });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record expense");
    }
  };

  const filteredExpenses = expenses.filter((e) => {
    if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const catLabel = (EXPENSE_CATEGORY_LABELS[e.category as keyof typeof EXPENSE_CATEGORY_LABELS] || e.category).toLowerCase();
      const notes = (e.notes || "").toLowerCase();
      if (!catLabel.includes(q) && !notes.includes(q)) return false;
    }
    return true;
  });

  const total = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);

  const printExpenseVoucher = (e: Expense) => {
    printSystematicDocument({
      docTitle: "PAYMENT / EXPENSE VOUCHER",
      docBadge: "ORIGINAL VOUCHER",
      docNumber: `EXP-${e.id.slice(0, 8).toUpperCase()}`,
      docDate: formatDate(e.expense_date),
      partyTitle: "Expense Particulars",
      partyDetails: {
        name: EXPENSE_CATEGORY_LABELS[e.category as keyof typeof EXPENSE_CATEGORY_LABELS] || e.category,
        extra: e.notes ? `Remarks: ${e.notes}` : "General Store Operating Expense",
      },
      metadata: [
        { label: "Voucher ID", value: e.id.slice(0, 8).toUpperCase() },
        { label: "Expense Date", value: formatDate(e.expense_date) },
        {
          label: "Category",
          value: EXPENSE_CATEGORY_LABELS[e.category as keyof typeof EXPENSE_CATEGORY_LABELS] || e.category,
        },
        { label: "Payment Mode", value: "Cash / Direct Outflow" },
        { label: "Total Amount", value: formatPrice(e.amount) },
      ],
      columns: [
        { header: "Sr.", width: "10%" },
        { header: "Head of Account / Purpose", width: "55%" },
        { header: "Category", width: "20%" },
        { header: "Amount (₹)", align: "right", width: "15%" },
      ],
      rows: [
        {
          cells: [
            1,
            e.notes
              ? `${EXPENSE_CATEGORY_LABELS[e.category as keyof typeof EXPENSE_CATEGORY_LABELS] || e.category} — ${e.notes}`
              : EXPENSE_CATEGORY_LABELS[e.category as keyof typeof EXPENSE_CATEGORY_LABELS] || e.category,
            e.category.toUpperCase(),
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
        { label: "Total Expenditure", value: formatPrice(total) },
        { label: "Category Filter", value: categoryFilter.toUpperCase() },
        { label: "Generated Date", value: formatDate(new Date().toISOString()) },
      ],
      columns: [
        { header: "Date", width: "15%" },
        { header: "Voucher ID", width: "15%" },
        { header: "Category", width: "20%" },
        { header: "Notes / Details", width: "35%" },
        { header: "Amount", align: "right", width: "15%" },
      ],
      rows: filteredExpenses.map((e) => ({
        cells: [
          formatDate(e.expense_date),
          `EXP-${e.id.slice(0, 8).toUpperCase()}`,
          EXPENSE_CATEGORY_LABELS[e.category as keyof typeof EXPENSE_CATEGORY_LABELS] || e.category,
          e.notes || "—",
          formatPrice(e.amount),
        ],
      })),
      summaryRows: [
        { label: "Total Expense Vouchers", value: String(filteredExpenses.length) },
        { label: "Total Expense Outflow", value: formatPrice(total), isBold: true, isHighlight: true },
      ],
      notes: [
        "Official Odhavram General Store audit register of all verified business expenses.",
      ],
      signatories: ["Prepared By", "Store Accountant / Proprietor"],
    });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Expense Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Total recorded: <strong className="text-gray-900">{formatPrice(total)}</strong> ({filteredExpenses.length} vouchers)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filteredExpenses.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={printExpensesRegister}
              className="gap-1.5 font-bold"
            >
              <Printer className="h-4 w-4 text-emerald-600" />
              <span>Print Expense Register</span>
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="mb-6 grid gap-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <Input
          type="date"
          value={form.expense_date}
          onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
        />
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={form.category}
          onChange={(e) =>
            setForm({ ...form, category: e.target.value as typeof form.category })
          }
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {EXPENSE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <Input
          type="number"
          placeholder="Amount (₹)"
          value={form.amount || ""}
          onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
          required
        />
        <Input
          placeholder="Notes / Payee / Remarks"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <Button type="submit" className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Expense
        </Button>
      </form>

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes or category..."
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="all">All Categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {EXPENSE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="max-h-[calc(100vh-270px)] sm:max-h-[calc(100vh-250px)] min-h-[300px] overflow-y-auto overscroll-contain scrollbar-thin">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur-xs shadow-xs text-xs font-semibold uppercase tracking-wider text-gray-700">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-left">Notes / Remarks</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((e) => (
                <tr key={e.id} className="border-t hover:bg-gray-50/80 transition-colors">
                  <td className="p-3 whitespace-nowrap">{formatDate(e.expense_date)}</td>
                  <td className="p-3 capitalize font-medium text-gray-800">
                    {EXPENSE_CATEGORY_LABELS[e.category as keyof typeof EXPENSE_CATEGORY_LABELS] || e.category}
                  </td>
                  <td className="p-3 text-right font-semibold text-gray-900">{formatPrice(e.amount)}</td>
                  <td className="p-3 text-gray-600">{e.notes ?? "—"}</td>
                  <td className="p-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => printExpenseVoucher(e)}
                      className="gap-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Print Voucher</span>
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No expense records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredExpenses.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-2.5 text-xs text-gray-600 flex items-center justify-between">
            <span>
              Showing {filteredExpenses.length} expense voucher{filteredExpenses.length === 1 ? "" : "s"} · Total: <strong>{formatPrice(total)}</strong>
            </span>
            <span className="hidden sm:inline text-gray-400">Scroll table vertically to view older expenses</span>
          </div>
        )}
      </div>
    </div>
  );
}

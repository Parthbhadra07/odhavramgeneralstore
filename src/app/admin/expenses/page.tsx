"use client";

import { useEffect, useState } from "react";
import { expenseService } from "@/services/erp";
import type { Expense } from "@/types/erp";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/erp/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice, formatDate } from "@/utils/format";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
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
    await expenseService.create(form);
    setForm({
      expense_date: new Date().toISOString().slice(0, 10),
      category: "miscellaneous",
      amount: 0,
      notes: "",
    });
    load();
  };

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Expense Management</h1>
      <p className="mb-6 text-gray-600">Total recorded: {formatPrice(total)}</p>

      <form onSubmit={handleSave} className="mb-6 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
        <Input
          type="date"
          value={form.expense_date}
          onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
        />
        <select
          className="rounded-lg border px-3 py-2"
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
          placeholder="Amount"
          value={form.amount || ""}
          onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
          required
        />
        <Input
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <Button type="submit">Add Expense</Button>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-3">{formatDate(e.expense_date)}</td>
                <td className="p-3 capitalize">{e.category}</td>
                <td className="p-3 font-medium">{formatPrice(e.amount)}</td>
                <td className="p-3 text-gray-600">{e.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

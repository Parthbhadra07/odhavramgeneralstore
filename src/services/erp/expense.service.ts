import { requireClient } from "@/lib/supabase/client";
import type { Expense } from "@/types/erp";
import type { ExpenseCategory } from "@/lib/erp/constants";

export const expenseService = {
  async list(filters?: { from?: string; to?: string; category?: string }) {
    const supabase = requireClient();
    let q = supabase.from("expenses").select("*").order("expense_date", { ascending: false });
    if (filters?.from) q = q.gte("expense_date", filters.from);
    if (filters?.to) q = q.lte("expense_date", filters.to);
    if (filters?.category && filters.category !== "all") {
      q = q.eq("category", filters.category);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Expense[];
  },

  async create(expense: {
    expense_date: string;
    category: string;
    amount: number;
    notes?: string;
    receipt_url?: string;
  }): Promise<Expense> {
    const supabase = requireClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const normalizedCategory = expense.category.trim() || "General";

    try {
      const { data, error } = await supabase
        .from("expenses")
        .insert({
          ...expense,
          category: normalizedCategory,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Expense;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Fallback if PostgreSQL enum constraint has not yet been migrated to TEXT
      if (errMsg.includes("expense_category") || errMsg.includes("22P02")) {
        const fallbackNotes = `[Type: ${normalizedCategory}] ${expense.notes || ""}`.trim();
        const { data, error } = await supabase
          .from("expenses")
          .insert({
            ...expense,
            category: "miscellaneous",
            notes: fallbackNotes,
            created_by: user?.id ?? null,
          })
          .select()
          .single();
        if (error) throw error;
        return data as Expense;
      }
      throw err;
    }
  },

  async update(
    id: string,
    expense: {
      expense_date?: string;
      category?: string;
      amount?: number;
      notes?: string | null;
      receipt_url?: string | null;
    }
  ): Promise<Expense> {
    const supabase = requireClient();
    const payload = { ...expense };
    if (payload.category) {
      payload.category = payload.category.trim() || "General";
    }

    try {
      const { data, error } = await supabase
        .from("expenses")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Expense;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if ((errMsg.includes("expense_category") || errMsg.includes("22P02")) && payload.category) {
        const fallbackNotes = `[Type: ${payload.category}] ${payload.notes || ""}`.trim();
        const { data, error } = await supabase
          .from("expenses")
          .update({
            ...payload,
            category: "miscellaneous",
            notes: fallbackNotes,
          })
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as Expense;
      }
      throw err;
    }
  },

  async delete(id: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;
  },

  async uploadReceipt(file: File, expenseId: string): Promise<string> {
    const supabase = requireClient();
    const path = `expenses/${expenseId}/${file.name}`;
    const { error } = await supabase.storage
      .from("erp-documents")
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("erp-documents").getPublicUrl(path);
    return data.publicUrl;
  },
};

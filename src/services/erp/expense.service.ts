import { requireClient } from "@/lib/supabase/client";
import type { Expense } from "@/types/erp";
import type { ExpenseCategory } from "@/lib/erp/constants";

export const expenseService = {
  async list(filters?: { from?: string; to?: string; category?: ExpenseCategory }) {
    const supabase = requireClient();
    let q = supabase.from("expenses").select("*").order("expense_date", { ascending: false });
    if (filters?.from) q = q.gte("expense_date", filters.from);
    if (filters?.to) q = q.lte("expense_date", filters.to);
    if (filters?.category) q = q.eq("category", filters.category);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Expense[];
  },

  async create(expense: {
    expense_date: string;
    category: ExpenseCategory;
    amount: number;
    notes?: string;
    receipt_url?: string;
  }): Promise<Expense> {
    const supabase = requireClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("expenses")
      .insert({ ...expense, created_by: user?.id ?? null })
      .select()
      .single();
    if (error) throw error;
    return data as Expense;
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

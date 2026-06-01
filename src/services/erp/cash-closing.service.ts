import { createClient } from "@/lib/supabase/client";
import type { CashClosing } from "@/types/erp";
import { posService } from "./pos.service";
import { expenseService } from "./expense.service";
import { orderService } from "@/services/order.service";

export const cashClosingService = {
  async generateForDate(date: string, openingCash = 0): Promise<CashClosing> {
    const supabase = createClient();
    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd = `${date}T23:59:59.999Z`;

    const posStats = await posService.getTodayStats();
    const expenses = await expenseService.list({
      from: date,
      to: date,
    });
    const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

    const orderStats = await orderService.getDashboardStats();
    const closingCash =
      openingCash + posStats.cash - expenseTotal;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("cash_closing")
      .upsert(
        {
          closing_date: date,
          opening_cash: openingCash,
          cash_sales: posStats.cash,
          upi_sales: posStats.upi,
          card_sales: posStats.card,
          credit_sales: 0,
          online_cash_sales: orderStats.todaySales,
          expenses: expenseTotal,
          closing_cash: closingCash,
          closed_by: user?.id ?? null,
        },
        { onConflict: "closing_date" }
      )
      .select()
      .single();
    if (error) throw error;
    return data as CashClosing;
  },

  async list(): Promise<CashClosing[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("cash_closing")
      .select("*")
      .order("closing_date", { ascending: false })
      .limit(30);
    if (error) throw error;
    return (data ?? []) as CashClosing[];
  },
};

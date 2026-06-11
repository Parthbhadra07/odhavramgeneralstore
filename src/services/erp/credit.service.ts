import { createClient } from "@/lib/supabase/client";
import type { CustomerCredit } from "@/types/erp";

export const creditService = {
  async addCredit(
    customerId: string,
    amount: number,
    referenceType: string,
    referenceId: string,
    notes?: string
  ) {
    if (amount <= 0) throw new Error("Credit amount must be positive");

    const supabase = createClient();
    await supabase.from("customer_credit").insert({
      customer_id: customerId,
      amount,
      transaction_type: "credit",
      reference_type: referenceType,
      reference_id: referenceId,
      notes: notes ?? null,
    });

    const { data } = await supabase
      .from("customers")
      .select("credit_balance")
      .eq("id", customerId)
      .single();

    await supabase
      .from("customers")
      .update({
        credit_balance: Number(data?.credit_balance ?? 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);
  },

  async recordPayment(
    customerId: string,
    amount: number,
    paymentMethod?: string,
    notes?: string
  ) {
    if (amount <= 0) throw new Error("Payment amount must be positive");

    const supabase = createClient();
    const { data } = await supabase
      .from("customers")
      .select("credit_balance")
      .eq("id", customerId)
      .single();

    const balance = Number(data?.credit_balance ?? 0);
    if (amount > balance) {
      throw new Error(`Payment exceeds outstanding credit (${balance})`);
    }

    const paymentNote = [paymentMethod, notes].filter(Boolean).join(" — ") || null;

    await supabase.from("customer_credit").insert({
      customer_id: customerId,
      amount,
      transaction_type: "payment",
      reference_type: "payment",
      reference_id: null,
      notes: paymentNote,
    });

    await supabase
      .from("customers")
      .update({
        credit_balance: Math.max(0, balance - amount),
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);
  },

  async adjust(customerId: string, signedAmount: number, notes?: string) {
    if (signedAmount === 0) throw new Error("Adjustment amount cannot be zero");

    const supabase = createClient();
    const { data } = await supabase
      .from("customers")
      .select("credit_balance")
      .eq("id", customerId)
      .single();

    const balance = Number(data?.credit_balance ?? 0);
    const nextBalance = Math.max(0, balance + signedAmount);

    await supabase.from("customer_credit").insert({
      customer_id: customerId,
      amount: signedAmount,
      transaction_type: "adjust",
      reference_type: "adjust",
      reference_id: null,
      notes: notes ?? null,
    });

    await supabase
      .from("customers")
      .update({
        credit_balance: nextBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);
  },

  async reverseCredit(
    customerId: string,
    amount: number,
    referenceType: string,
    referenceId: string,
    notes?: string
  ) {
    if (amount <= 0) return;

    const supabase = createClient();
    const { data } = await supabase
      .from("customers")
      .select("credit_balance")
      .eq("id", customerId)
      .single();

    await supabase.from("customer_credit").insert({
      customer_id: customerId,
      amount,
      transaction_type: "adjust",
      reference_type: referenceType,
      reference_id: referenceId,
      notes: notes ?? "Credit reversed",
    });

    await supabase
      .from("customers")
      .update({
        credit_balance: Math.max(0, Number(data?.credit_balance ?? 0) - amount),
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);
  },

  async getHistory(customerId: string): Promise<CustomerCredit[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("customer_credit")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as CustomerCredit[];
  },

  async getLedger(customerId: string) {
    const history = await this.getHistory(customerId);

    return history.map((entry) => {
      const amount = Number(entry.amount);
      const debit =
        entry.transaction_type === "credit" ||
        (entry.transaction_type === "adjust" && amount > 0)
          ? Math.abs(amount)
          : 0;
      const credit =
        entry.transaction_type === "payment" ||
        (entry.transaction_type === "adjust" && amount < 0)
          ? Math.abs(amount)
          : 0;

      return {
        date: entry.created_at,
        type: entry.transaction_type,
        reference: entry.reference_type ?? "—",
        notes: entry.notes,
        debit,
        credit,
      };
    });
  },
};

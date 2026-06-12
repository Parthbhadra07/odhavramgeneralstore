import { createClient } from "@/lib/supabase/client";
import type {
  CreditDashboardStats,
  CreditLedgerEntry,
  Customer,
  CustomerCredit,
} from "@/types/erp";
import { format } from "date-fns";

const CREDIT_TX_LABELS: Record<string, string> = {
  credit: "Credit Sale",
  payment: "Payment Received",
  adjust: "Adjustment",
};

function ledgerDescription(entry: CustomerCredit): string {
  if (entry.description) return entry.description;
  if (entry.transaction_type === "payment") return "Payment Received";
  if (entry.transaction_type === "credit") {
    if (entry.reference_type === "pos_sale") return "Credit Sale (POS)";
    return "Credit Sale";
  }
  if (entry.notes) return entry.notes;
  return CREDIT_TX_LABELS[entry.transaction_type] ?? entry.transaction_type;
}

export const creditService = {
  async addCredit(
    customerId: string,
    amount: number,
    referenceType: string,
    referenceId: string,
    notes?: string,
    dueDate?: string
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
      description: notes ?? "Credit Sale",
      due_date: dueDate ?? null,
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

  async createManualCreditSale(params: {
    customerId: string;
    amount: number;
    dueDate?: string;
    notes?: string;
  }) {
    const supabase = createClient();
    const refId = crypto.randomUUID();
    await this.addCredit(
      params.customerId,
      params.amount,
      "manual_credit",
      refId,
      params.notes ?? "Manual credit entry",
      params.dueDate
    );
    return refId;
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
      throw new Error(`Payment exceeds outstanding credit (₹${balance.toFixed(2)})`);
    }

    const paymentNote = [paymentMethod, notes].filter(Boolean).join(" — ") || null;

    await supabase.from("customer_credit").insert({
      customer_id: customerId,
      amount,
      transaction_type: "payment",
      reference_type: "payment",
      reference_id: null,
      notes: paymentNote,
      description: paymentMethod ? `Payment via ${paymentMethod}` : "Payment Received",
      payment_method: paymentMethod ?? null,
    });

    await supabase
      .from("customers")
      .update({
        credit_balance: Math.max(0, balance - amount),
        last_payment_date: new Date().toISOString(),
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
      description: notes ?? (signedAmount > 0 ? "Discount Adjustment" : "Return Adjustment"),
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
      description: notes ?? "Return Adjustment",
    });

    await supabase
      .from("customers")
      .update({
        credit_balance: Math.max(0, Number(data?.credit_balance ?? 0) - amount),
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);
  },

  async updateCustomerProfile(
    customerId: string,
    updates: Partial<Pick<Customer, "credit_limit" | "account_status" | "notes">>
  ) {
    const supabase = createClient();
    const { error } = await supabase
      .from("customers")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", customerId);
    if (error) throw error;
  },

  async getHistory(customerId: string): Promise<CustomerCredit[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("customer_credit")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CustomerCredit[];
  },

  async getLedger(customerId: string): Promise<CreditLedgerEntry[]> {
    const history = await this.getHistory(customerId);
    let runningBalance = 0;

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

      runningBalance = Math.round((runningBalance + debit - credit) * 100) / 100;

      return {
        id: entry.id,
        date: entry.created_at,
        description: ledgerDescription(entry),
        type: entry.transaction_type,
        debit,
        credit,
        runningBalance,
        notes: entry.notes,
        dueDate: entry.due_date ?? null,
        referenceType: entry.reference_type,
        referenceId: entry.reference_id,
      };
    });
  },

  async getLedgerWithOpening(customerId: string) {
    const entries = await this.getLedger(customerId);
    const customer = await this.getCustomer(customerId);
    return {
      customer,
      entries: [...entries].reverse(),
      openingBalance: 0,
      closingBalance: customer?.credit_balance ?? 0,
    };
  },

  async getCustomer(customerId: string): Promise<Customer | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .maybeSingle();
    if (error) throw error;
    return data as Customer | null;
  },

  async getDashboardStats(): Promise<CreditDashboardStats> {
    const supabase = createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [{ data: customers }, { data: credits }] = await Promise.all([
      supabase.from("customers").select("id, credit_balance"),
      supabase.from("customer_credit").select("*"),
    ]);

    const rows = credits ?? [];
    const totalCreditGiven = rows
      .filter((r) => r.transaction_type === "credit")
      .reduce((s, r) => s + Number(r.amount), 0);
    const totalCreditCollected = rows
      .filter((r) => r.transaction_type === "payment")
      .reduce((s, r) => s + Number(r.amount), 0);
    const outstandingBalance = (customers ?? []).reduce(
      (s, c) => s + Number(c.credit_balance),
      0
    );
    const activeCreditCustomers = (customers ?? []).filter(
      (c) => Number(c.credit_balance) > 0
    ).length;

    const todayStr = format(todayStart, "yyyy-MM-dd");
    const todaysCollection = rows
      .filter(
        (r) =>
          r.transaction_type === "payment" &&
          r.created_at >= todayStart.toISOString()
      )
      .reduce((s, r) => s + Number(r.amount), 0);

    const overdueAmount = rows
      .filter(
        (r) =>
          r.transaction_type === "credit" &&
          r.due_date &&
          r.due_date < todayStr
      )
      .reduce((s, r) => s + Number(r.amount), 0);

    return {
      totalCreditGiven: Math.round(totalCreditGiven * 100) / 100,
      totalCreditCollected: Math.round(totalCreditCollected * 100) / 100,
      outstandingBalance: Math.round(outstandingBalance * 100) / 100,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
      activeCreditCustomers,
      todaysCollection: Math.round(todaysCollection * 100) / 100,
    };
  },

  async getReminders() {
    const supabase = createClient();
    const today = format(new Date(), "yyyy-MM-dd");
    const tomorrow = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");

    const { data: credits } = await supabase
      .from("customer_credit")
      .select("*, customers(id, name, mobile, credit_balance)")
      .eq("transaction_type", "credit")
      .not("due_date", "is", null);

    const rows = (credits ?? []) as (CustomerCredit & {
      customers?: Customer;
    })[];

    const dueToday = rows.filter((r) => r.due_date === today);
    const dueTomorrow = rows.filter((r) => r.due_date === tomorrow);
    const overdue = rows.filter((r) => r.due_date && r.due_date < today);

    return { dueToday, dueTomorrow, overdue };
  },

  async getAnalytics() {
    const supabase = createClient();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [{ data: credits }, { data: customers }] = await Promise.all([
      supabase
        .from("customer_credit")
        .select("*")
        .gte("created_at", sixMonthsAgo.toISOString()),
      supabase.from("customers").select("id, name, credit_balance"),
    ]);

    const rows = credits ?? [];
    const monthMap = new Map<string, { sales: number; collections: number }>();
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const key = format(d, "MMM yy");
      monthMap.set(key, { sales: 0, collections: 0 });
    }

    for (const r of rows) {
      const key = format(new Date(r.created_at), "MMM yy");
      const bucket = monthMap.get(key);
      if (!bucket) continue;
      if (r.transaction_type === "credit") bucket.sales += Number(r.amount);
      if (r.transaction_type === "payment") bucket.collections += Number(r.amount);
    }

    const monthlyCreditSales = Array.from(monthMap.entries()).map(([label, v]) => ({
      label,
      value: Math.round(v.sales),
    }));
    const collectionTrend = Array.from(monthMap.entries()).map(([label, v]) => ({
      label,
      value: Math.round(v.collections),
    }));

    const totalGiven = rows
      .filter((r) => r.transaction_type === "credit")
      .reduce((s, r) => s + Number(r.amount), 0);
    const totalCollected = rows
      .filter((r) => r.transaction_type === "payment")
      .reduce((s, r) => s + Number(r.amount), 0);
    const recoveryRate =
      totalGiven > 0 ? Math.round((totalCollected / totalGiven) * 100) : 100;

    const topDebtors = (customers ?? [])
      .filter((c) => Number(c.credit_balance) > 0)
      .sort((a, b) => Number(b.credit_balance) - Number(a.credit_balance))
      .slice(0, 5)
      .map((c) => ({
        name: c.name,
        balance: Number(c.credit_balance),
      }));

    const outstandingTrend = monthlyCreditSales.map((m, i) => ({
      label: m.label,
      value: Math.max(
        0,
        monthlyCreditSales
          .slice(0, i + 1)
          .reduce((s, x) => s + x.value, 0) -
          collectionTrend
            .slice(0, i + 1)
            .reduce((s, x) => s + x.value, 0)
      ),
    }));

    return {
      monthlyCreditSales,
      collectionTrend,
      recoveryRate,
      outstandingTrend,
      topDebtors,
    };
  },

  async listCreditCustomers(search?: string) {
    const supabase = createClient();
    let q = supabase
      .from("customers")
      .select("*")
      .gt("credit_balance", 0)
      .order("credit_balance", { ascending: false });
    if (search) {
      q = q.or(`name.ilike.%${search}%,mobile.ilike.%${search}%`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Customer[];
  },
};

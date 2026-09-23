import { requireClient } from "@/lib/supabase/client";
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

    const supabase = requireClient();
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

    await this.syncCustomerBalance(customerId);
  },

  async createManualCreditSale(params: {
    customerId: string;
    amount: number;
    dueDate?: string;
    notes?: string;
  }) {
    const supabase = requireClient();
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

    const supabase = requireClient();
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

    await this.syncCustomerBalance(customerId);
  },

  async adjust(customerId: string, signedAmount: number, notes?: string) {
    if (signedAmount === 0) throw new Error("Adjustment amount cannot be zero");

    const supabase = requireClient();
    await supabase.from("customer_credit").insert({
      customer_id: customerId,
      amount: signedAmount,
      transaction_type: "adjust",
      reference_type: "adjust",
      reference_id: null,
      notes: notes ?? null,
      description: notes ?? (signedAmount > 0 ? "Balance increased" : "Balance reduced"),
    });

    await this.syncCustomerBalance(customerId);
  },

  async reverseCredit(
    customerId: string,
    amount: number,
    referenceType: string,
    referenceId: string,
    notes?: string
  ) {
    if (amount <= 0) return;

    const supabase = requireClient();
    await supabase.from("customer_credit").insert({
      customer_id: customerId,
      amount,
      transaction_type: "adjust",
      reference_type: referenceType,
      reference_id: referenceId,
      notes: notes ?? "Credit reversed",
      description: notes ?? "Return Adjustment",
    });

    await this.syncCustomerBalance(customerId);
  },

  async updateCustomerProfile(
    customerId: string,
    updates: Partial<Pick<Customer, "credit_limit" | "account_status" | "notes">>
  ) {
    const supabase = requireClient();
    const { error } = await supabase
      .from("customers")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", customerId);
    if (error) throw error;
  },

  async syncCustomerBalance(customerId: string) {
    const supabase = requireClient();
    const history = await this.getHistory(customerId);
    const ledger = this.ledgerFromHistory(history);
    const balance = ledger.length ? ledger[ledger.length - 1].runningBalance : 0;
    const lastPayment = [...history]
      .reverse()
      .find((e) => e.transaction_type === "payment");

    const { error } = await supabase
      .from("customers")
      .update({
        credit_balance: Math.round(balance * 100) / 100,
        last_payment_date: lastPayment?.created_at ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);
    if (error) throw error;
    return balance;
  },

  async recordVoucher(params: {
    customerId: string;
    type: "credit" | "payment" | "adjust";
    amount: number;
    date?: string;
    notes?: string;
    description?: string;
    paymentMethod?: string;
    dueDate?: string;
  }) {
    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      throw new Error("Enter a valid amount");
    }
    const supabase = requireClient();
    const signed =
      params.type === "adjust" ? amount : Math.abs(amount);
    const row: Record<string, unknown> = {
      customer_id: params.customerId,
      amount: params.type === "payment" ? Math.abs(amount) : signed,
      transaction_type: params.type,
      reference_type: params.type === "credit" ? "manual_credit" : params.type,
      reference_id: null,
      notes: params.notes ?? null,
      description:
        params.description ??
        (params.type === "credit"
          ? "You gave (udhaar)"
          : params.type === "payment"
            ? "You got (collection)"
            : "Adjustment"),
      payment_method: params.paymentMethod ?? null,
      due_date: params.dueDate || null,
    };
    if (params.date) row.entry_date = params.date;

    const { error } = await supabase.from("customer_credit").insert(row);
    if (error) {
      if (params.date && String(error.message).includes("entry_date")) {
        const { entry_date: _ignored, ...withoutDate } = row;
        const retry = await supabase.from("customer_credit").insert(withoutDate);
        if (retry.error) throw retry.error;
      } else {
        throw error;
      }
    }
    await this.syncCustomerBalance(params.customerId);
  },

  async updateLedgerEntry(
    entryId: string,
    updates: {
      amount?: number;
      type?: "credit" | "payment" | "adjust";
      notes?: string | null;
      description?: string | null;
      date?: string;
      dueDate?: string | null;
      paymentMethod?: string | null;
    }
  ) {
    const supabase = requireClient();
    const { data: existing, error: loadErr } = await supabase
      .from("customer_credit")
      .select("*")
      .eq("id", entryId)
      .single();
    if (loadErr || !existing) throw new Error("Entry not found");

    const patch: Record<string, unknown> = {};
    if (updates.amount != null) patch.amount = updates.amount;
    if (updates.type) patch.transaction_type = updates.type;
    if (updates.notes !== undefined) patch.notes = updates.notes;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.dueDate !== undefined) patch.due_date = updates.dueDate;
    if (updates.paymentMethod !== undefined) patch.payment_method = updates.paymentMethod;
    if (updates.date) {
      patch.entry_date = updates.date;
      patch.created_at = `${updates.date}T12:00:00.000Z`;
    }

    const { error } = await supabase
      .from("customer_credit")
      .update(patch)
      .eq("id", entryId);
    if (error) throw error;
    await this.syncCustomerBalance(existing.customer_id as string);
  },

  async deleteLedgerEntry(entryId: string) {
    const supabase = requireClient();
    const { data: existing, error: loadErr } = await supabase
      .from("customer_credit")
      .select("customer_id")
      .eq("id", entryId)
      .single();
    if (loadErr || !existing) throw new Error("Entry not found");

    const { error } = await supabase.from("customer_credit").delete().eq("id", entryId);
    if (error) throw error;
    await this.syncCustomerBalance(existing.customer_id as string);
  },

  ledgerFromHistory(history: CustomerCredit[]): CreditLedgerEntry[] {
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
      const date = entry.entry_date ?? entry.created_at;

      return {
        id: entry.id,
        date,
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

  async getHistory(customerId: string): Promise<CustomerCredit[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("customer_credit")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as CustomerCredit[];
    return rows.sort((a, b) => {
      const da = a.entry_date ?? a.created_at.slice(0, 10);
      const db = b.entry_date ?? b.created_at.slice(0, 10);
      if (da !== db) return da.localeCompare(db);
      return a.created_at.localeCompare(b.created_at);
    });
  },

  async getLedger(customerId: string): Promise<CreditLedgerEntry[]> {
    const history = await this.getHistory(customerId);
    return this.ledgerFromHistory(history);
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
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .maybeSingle();
    if (error) throw error;
    return data as Customer | null;
  },

  async getDashboardStats(): Promise<CreditDashboardStats> {
    const supabase = requireClient();
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
      (s, c) => s + Math.max(0, Number(c.credit_balance)),
      0
    );
    const activeCreditCustomers = (customers ?? []).filter(
      (c) => Number(c.credit_balance) > 0
    ).length;

    const todayStr = format(todayStart, "yyyy-MM-dd");
    const todaysCreditRows = rows.filter(
      (r) => r.created_at >= todayStart.toISOString()
    );

    const todaysCreditGiven = todaysCreditRows
      .filter((r) => r.transaction_type === "credit")
      .reduce((s, r) => s + Number(r.amount), 0);

    const todaysCollection = todaysCreditRows
      .filter((r) => r.transaction_type === "payment")
      .reduce((s, r) => s + Number(r.amount), 0);

    const todaysCashCollection = todaysCreditRows
      .filter(
        (r) =>
          r.transaction_type === "payment" &&
          (r.payment_method === "cash" ||
            !r.payment_method ||
            r.payment_method === "")
      )
      .reduce((s, r) => s + Number(r.amount), 0);

    const todaysUpiCollection = todaysCreditRows
      .filter(
        (r) =>
          r.transaction_type === "payment" && r.payment_method === "upi"
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
      todaysCreditGiven: Math.round(todaysCreditGiven * 100) / 100,
      todaysCashCollection: Math.round(todaysCashCollection * 100) / 100,
      todaysUpiCollection: Math.round(todaysUpiCollection * 100) / 100,
    };
  },

  async getReminders() {
    const supabase = requireClient();
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
    const supabase = requireClient();
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
    return this.listParties(search, "due");
  },

  async listParties(
    search?: string,
    filter: "all" | "due" | "settled" | "blocked" | "advance" = "all"
  ) {
    const supabase = requireClient();
    let q = supabase.from("customers").select("*").order("name");
    if (search) {
      q = q.or(`name.ilike.%${search}%,mobile.ilike.%${search}%`);
    }
    if (filter === "due") q = q.gt("credit_balance", 0);
    if (filter === "advance") q = q.lt("credit_balance", 0);
    if (filter === "settled") q = q.eq("credit_balance", 0);
    if (filter === "blocked") q = q.eq("account_status", "blocked");
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Customer[];
  },
};

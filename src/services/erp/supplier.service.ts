import { requireClient } from "@/lib/supabase/client";
import type { PurchaseBill, Supplier, SupplierPayment, SupplierWithStats } from "@/types/erp";

export const supplierService = {
  async list(): Promise<Supplier[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("name");
    if (error) throw error;
    return (data ?? []) as Supplier[];
  },

  async listWithStats(): Promise<SupplierWithStats[]> {
    const suppliers = await this.list();
    if (suppliers.length === 0) return [];

    const supabase = requireClient();
    const ids = suppliers.map((s) => s.id);
    const { data: bills } = await supabase
      .from("purchase_bills")
      .select("supplier_id, total_amount, invoice_date")
      .in("supplier_id", ids);

    return suppliers.map((s) => {
      const supplierBills = (bills ?? []).filter((b) => b.supplier_id === s.id);
      const sorted = supplierBills.sort(
        (a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
      );
      return {
        ...s,
        total_purchases: supplierBills.reduce((sum, b) => sum + Number(b.total_amount), 0),
        last_purchase_date: sorted[0]?.invoice_date ?? null,
        purchase_count: supplierBills.length,
      };
    });
  },

  async upsert(supplier: Partial<Supplier> & { name: string }): Promise<Supplier> {
    const supabase = requireClient();
    if (supplier.id) {
      const { data, error } = await supabase
        .from("suppliers")
        .update({ ...supplier, updated_at: new Date().toISOString() })
        .eq("id", supplier.id)
        .select()
        .single();
      if (error) throw error;
      return data as Supplier;
    }
    const { data, error } = await supabase
      .from("suppliers")
      .insert(supplier)
      .select()
      .single();
    if (error) throw error;
    return data as Supplier;
  },

  async delete(id: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) throw error;
  },

  async recordPayment(params: {
    supplierId: string;
    amount: number;
    paymentMethod: string;
    referenceNumber?: string;
    notes?: string;
    paymentDate?: string;
    purchaseBillId?: string;
  }): Promise<SupplierPayment> {
    const supabase = requireClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const insertPayload: Record<string, unknown> = {
      supplier_id: params.supplierId,
      amount: params.amount,
      payment_method: params.paymentMethod,
      reference_number: params.referenceNumber ?? null,
      notes: params.notes ?? null,
      payment_date: params.paymentDate ?? new Date().toISOString().slice(0, 10),
      created_by: user?.id ?? null,
    };
    if (params.purchaseBillId) {
      insertPayload.purchase_bill_id = params.purchaseBillId;
    }

    let insertRes = await supabase.from("supplier_payments").insert(insertPayload).select().single();
    if (insertRes.error && insertRes.error.message.includes("purchase_bill_id")) {
      delete insertPayload.purchase_bill_id;
      insertRes = await supabase.from("supplier_payments").insert(insertPayload).select().single();
    }
    if (insertRes.error) throw insertRes.error;

    const supplier = await supabase
      .from("suppliers")
      .select("outstanding_amount")
      .eq("id", params.supplierId)
      .single();
    const outstanding = Math.max(
      0,
      Number(supplier.data?.outstanding_amount ?? 0) - params.amount
    );
    await supabase
      .from("suppliers")
      .update({ outstanding_amount: outstanding, updated_at: new Date().toISOString() })
      .eq("id", params.supplierId);

    return insertRes.data as SupplierPayment;
  },

  async deletePayment(paymentId: string): Promise<void> {
    const supabase = requireClient();
    const { data: payment, error: pErr } = await supabase
      .from("supplier_payments")
      .select("*")
      .eq("id", paymentId)
      .single();
    if (pErr || !payment) throw new Error("Payment record not found");

    const isAutoCashPur = payment.reference_number?.startsWith("CASH-PUR-");
    if (!isAutoCashPur) {
      const { data: supplier } = await supabase
        .from("suppliers")
        .select("outstanding_amount")
        .eq("id", payment.supplier_id)
        .single();

      if (supplier) {
        const restored = Number(supplier.outstanding_amount ?? 0) + Number(payment.amount);
        await supabase
          .from("suppliers")
          .update({ outstanding_amount: restored, updated_at: new Date().toISOString() })
          .eq("id", payment.supplier_id);
      }
    }

    const { error } = await supabase.from("supplier_payments").delete().eq("id", paymentId);
    if (error) throw error;
  },

  async getSupplierBillsWithBalances(supplierId: string) {
    const supabase = requireClient();
    const [billsRes, paymentsRes] = await Promise.all([
      supabase
        .from("purchase_bills")
        .select("id, bill_number, invoice_date, total_amount, payment_type, notes")
        .eq("supplier_id", supplierId)
        .order("invoice_date", { ascending: false }),
      supabase
        .from("supplier_payments")
        .select("id, amount, reference_number, purchase_bill_id")
        .eq("supplier_id", supplierId),
    ]);

    const bills = billsRes.data ?? [];
    const payments = paymentsRes.data ?? [];

    return bills.map((bill) => {
      const isCash = bill.payment_type === "cash";
      if (isCash) {
        return {
          ...bill,
          paidAmount: Number(bill.total_amount),
          pendingAmount: 0,
          isFullySettled: true,
        };
      }

      const billNumber = bill.bill_number.trim().toLowerCase();
      let paid = 0;
      for (const p of payments) {
        if (p.purchase_bill_id === bill.id) {
          paid += Number(p.amount);
        } else if (p.reference_number && p.reference_number.toLowerCase().includes(billNumber)) {
          paid += Number(p.amount);
        }
      }

      const pending = Math.max(0, Math.round((Number(bill.total_amount) - paid) * 100) / 100);
      return {
        ...bill,
        paidAmount: Math.round(paid * 100) / 100,
        pendingAmount: pending,
        isFullySettled: pending <= 0.01,
      };
    }).sort((a, b) => {
      if (a.isFullySettled !== b.isFullySettled) {
        return a.isFullySettled ? 1 : -1;
      }
      return new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime();
    });
  },

  async getPayments(supplierId: string): Promise<SupplierPayment[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("supplier_payments")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("payment_date", { ascending: false });
    if (error) throw error;
    return (data ?? []) as SupplierPayment[];
  },

  async getPurchaseHistory(supplierId: string): Promise<PurchaseBill[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("purchase_bills")
      .select("*, purchase_items(*, products(name))")
      .eq("supplier_id", supplierId)
      .order("invoice_date", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PurchaseBill[];
  },

  async getLedger(supplierId: string) {
    const [purchases, payments] = await Promise.all([
      this.getPurchaseHistory(supplierId),
      this.getPayments(supplierId),
    ]);

    type LedgerEntry = {
      date: string;
      type: "purchase" | "payment";
      reference: string;
      debit: number;
      credit: number;
      paymentId?: string;
      paymentMethod?: string;
      notes?: string | null;
    };

    const entries: LedgerEntry[] = [
      ...purchases.map((p) => ({
        date: p.invoice_date,
        type: "purchase" as const,
        reference: `${p.bill_number}${p.payment_type === "cash" ? " (Cash Paid)" : ""}`,
        debit: Number(p.total_amount),
        credit: 0,
      })),
      ...payments.map((p) => ({
        date: p.payment_date,
        type: "payment" as const,
        reference: p.reference_number ?? p.payment_method,
        debit: 0,
        credit: Number(p.amount),
        paymentId: p.id,
        paymentMethod: p.payment_method,
        notes: p.notes,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return entries;
  },
};

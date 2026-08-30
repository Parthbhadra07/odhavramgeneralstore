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
  }): Promise<SupplierPayment> {
    const supabase = requireClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("supplier_payments")
      .insert({
        supplier_id: params.supplierId,
        amount: params.amount,
        payment_method: params.paymentMethod,
        reference_number: params.referenceNumber ?? null,
        notes: params.notes ?? null,
        payment_date: params.paymentDate ?? new Date().toISOString().slice(0, 10),
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;

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

    return data as SupplierPayment;
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
    };

    const entries: LedgerEntry[] = [
      ...purchases.map((p) => ({
        date: p.invoice_date,
        type: "purchase" as const,
        reference: p.bill_number,
        debit: Number(p.total_amount),
        credit: 0,
      })),
      ...payments.map((p) => ({
        date: p.payment_date,
        type: "payment" as const,
        reference: p.reference_number ?? p.payment_method,
        debit: 0,
        credit: Number(p.amount),
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return entries;
  },
};

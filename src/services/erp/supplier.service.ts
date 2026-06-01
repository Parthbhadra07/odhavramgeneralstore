import { createClient } from "@/lib/supabase/client";
import type { Supplier, SupplierPayment } from "@/types/erp";

export const supplierService = {
  async list(): Promise<Supplier[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("name");
    if (error) throw error;
    return (data ?? []) as Supplier[];
  },

  async upsert(supplier: Partial<Supplier> & { name: string }): Promise<Supplier> {
    const supabase = createClient();
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
    const supabase = createClient();
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
    const supabase = createClient();
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
    const supabase = createClient();
    const { data, error } = await supabase
      .from("supplier_payments")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("payment_date", { ascending: false });
    if (error) throw error;
    return (data ?? []) as SupplierPayment[];
  },
};

import { createClient } from "@/lib/supabase/client";
import type { Refund, RefundMethod, RefundStatus } from "@/types/erp";

export const refundService = {
  async list(filters?: { status?: RefundStatus }): Promise<Refund[]> {
    const supabase = createClient();
    let q = supabase
      .from("refunds")
      .select("*, sales_returns(return_number)")
      .order("created_at", { ascending: false });
    if (filters?.status) q = q.eq("status", filters.status);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Refund[];
  },

  async getById(id: string): Promise<Refund | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("refunds")
      .select("*, sales_returns(return_number)")
      .eq("id", id)
      .single();
    if (error) return null;
    return data as Refund;
  },

  async updateStatus(
    id: string,
    status: RefundStatus,
    notes?: string
  ): Promise<Refund> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (notes) updates.notes = notes;
    if (status === "approved") updates.approved_by = user?.id ?? null;
    if (status === "paid") updates.paid_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("refunds")
      .update(updates)
      .eq("id", id)
      .select("*, sales_returns(return_number)")
      .single();
    if (error) throw error;
    return data as Refund;
  },

  async create(params: {
    salesReturnId?: string;
    orderId?: string;
    posSaleId?: string;
    customerId?: string;
    customerName?: string;
    amount: number;
    refundMethod: RefundMethod;
    notes?: string;
  }): Promise<Refund> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("refunds")
      .insert({
        sales_return_id: params.salesReturnId ?? null,
        order_id: params.orderId ?? null,
        pos_sale_id: params.posSaleId ?? null,
        customer_id: params.customerId ?? null,
        customer_name: params.customerName ?? null,
        amount: params.amount,
        refund_method: params.refundMethod,
        status: "pending",
        notes: params.notes ?? null,
        created_by: user?.id ?? null,
      })
      .select("*, sales_returns(return_number)")
      .single();
    if (error) throw error;
    return data as Refund;
  },
};

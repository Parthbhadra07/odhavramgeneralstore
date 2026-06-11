import { createClient } from "@/lib/supabase/client";
import type {
  SalesReturn,
  SalesReturnItem,
  SalesReturnReason,
  SalesReturnType,
} from "@/types/erp";

function clientReturnNumber(): string {
  const year = new Date().getFullYear();
  return `SR-${year}-${Date.now().toString().slice(-6)}`;
}

export const salesReturnService = {
  async generateNumber(): Promise<string> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("generate_return_number", {
      p_prefix: "SR",
    });
    if (error) return clientReturnNumber();
    return data as string;
  },

  async list(): Promise<SalesReturn[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sales_returns")
      .select("*, customers(*), sales_return_items(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as SalesReturn[];
  },

  async getById(id: string): Promise<SalesReturn | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sales_returns")
      .select("*, customers(*), sales_return_items(*)")
      .eq("id", id)
      .single();
    if (error) return null;
    return data as SalesReturn;
  },

  async create(params: {
    customerId?: string;
    customerName?: string;
    customerMobile?: string;
    orderId?: string;
    posSaleId?: string;
    returnDate: string;
    reason: SalesReturnReason;
    returnType: SalesReturnType;
    reasonNotes?: string;
    notes?: string;
    items: {
      productId: string;
      productName: string;
      lotId?: string;
      barcode?: string;
      quantity: number;
      rate: number;
    }[];
    createRefund?: boolean;
    refundMethod?: "cash" | "upi" | "bank_transfer" | "store_credit";
  }): Promise<SalesReturn> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const returnNumber = await this.generateNumber();
    const totalAmount = params.items.reduce(
      (s, i) => s + i.rate * i.quantity,
      0
    );

    const { data: ret, error: retErr } = await supabase
      .from("sales_returns")
      .insert({
        return_number: returnNumber,
        customer_id: params.customerId ?? null,
        customer_name: params.customerName ?? null,
        customer_mobile: params.customerMobile ?? null,
        order_id: params.orderId ?? null,
        pos_sale_id: params.posSaleId ?? null,
        return_date: params.returnDate,
        reason: params.reason,
        return_type: params.returnType,
        reason_notes: params.reasonNotes ?? null,
        total_amount: totalAmount,
        notes: params.notes ?? null,
        created_by: user?.id ?? null,
      })
      .select("*")
      .single();
    if (retErr) throw retErr;

    const returnId = (ret as SalesReturn).id;
    const itemRows: Omit<SalesReturnItem, "id">[] = params.items.map((i) => ({
      sales_return_id: returnId,
      product_id: i.productId,
      lot_id: i.lotId ?? null,
      product_name: i.productName,
      barcode: i.barcode ?? null,
      quantity: i.quantity,
      rate: i.rate,
      total_amount: i.rate * i.quantity,
    }));

    const { error: itemsErr } = await supabase
      .from("sales_return_items")
      .insert(itemRows);
    if (itemsErr) throw itemsErr;

    if (params.returnType === "refund" || params.createRefund) {
      await supabase.from("refunds").insert({
        sales_return_id: returnId,
        order_id: params.orderId ?? null,
        pos_sale_id: params.posSaleId ?? null,
        customer_id: params.customerId ?? null,
        customer_name: params.customerName ?? null,
        amount: totalAmount,
        refund_method: params.refundMethod ?? "cash",
        status: "pending",
        created_by: user?.id ?? null,
      });
    }

    if (params.posSaleId) {
      await supabase
        .from("pos_sales")
        .update({ sale_status: "returned" })
        .eq("id", params.posSaleId);
    }

    return this.getById(returnId) as Promise<SalesReturn>;
  },

  async getByCustomer(customerId: string): Promise<SalesReturn[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sales_returns")
      .select("*, sales_return_items(*)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as SalesReturn[];
  },
};

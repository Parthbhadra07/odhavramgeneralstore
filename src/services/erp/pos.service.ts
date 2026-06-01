import { createClient } from "@/lib/supabase/client";
import { LOYALTY_POINTS_PER_100 } from "@/lib/erp/constants";
import type { PosCartLine, PosSale, PosSaleStatus } from "@/types/erp";
import type { PosPaymentMethod } from "@/lib/erp/constants";
import { lineItemGst } from "@/utils/gst";
import { loyaltyService } from "./loyalty.service";

function clientBillNumber(): string {
  const year = new Date().getFullYear();
  return `POS-${year}-${Date.now().toString().slice(-6)}`;
}

function computeCartTotals(lines: PosCartLine[], discount = 0, loyaltyDiscount = 0) {
  let subtotal = 0;
  let cgst = 0;
  let sgst = 0;
  const items = lines.map((line) => {
    const gst = lineItemGst(line.rate, line.quantity, line.gstPercentage);
    subtotal += line.rate * line.quantity;
    cgst += gst.cgst;
    sgst += gst.sgst;
    return {
      product_id: line.productId,
      product_name: line.name,
      barcode: line.barcode,
      quantity: line.quantity,
      rate: line.rate,
      gst_percentage: line.gstPercentage,
      gst_amount: gst.totalGst,
      total_amount: gst.totalWithGst,
    };
  });
  const total =
    Math.round((subtotal + cgst + sgst - discount - loyaltyDiscount) * 100) / 100;
  return { subtotal, cgst, sgst, igst: 0, total, items };
}

export const posService = {
  async generateBillNumber(): Promise<string> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("generate_pos_bill_number");
    if (error) return clientBillNumber();
    return data as string;
  },

  async createSale(params: {
    lines: PosCartLine[];
    paymentMethod: PosPaymentMethod;
    customerId?: string;
    customerName?: string;
    customerMobile?: string;
    discount?: number;
    loyaltyPointsRedeemed?: number;
    saleStatus?: PosSaleStatus;
    notes?: string;
  }): Promise<PosSale> {
    const supabase = createClient();
    const loyaltyDiscount = params.loyaltyPointsRedeemed ?? 0;
    const { subtotal, cgst, sgst, igst, total, items } = computeCartTotals(
      params.lines,
      params.discount ?? 0,
      loyaltyDiscount
    );

    const billNumber = await this.generateBillNumber();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: sale, error: saleErr } = await supabase
      .from("pos_sales")
      .insert({
        bill_number: billNumber,
        customer_id: params.customerId ?? null,
        customer_name: params.customerName ?? null,
        customer_mobile: params.customerMobile ?? null,
        subtotal,
        cgst,
        sgst,
        igst,
        discount: params.discount ?? 0,
        loyalty_points_redeemed: params.loyaltyPointsRedeemed ?? 0,
        loyalty_discount: loyaltyDiscount,
        total_amount: total,
        payment_method: params.paymentMethod,
        sale_status: params.saleStatus ?? "completed",
        payment_status: "paid",
        cashier_id: user?.id ?? null,
        notes: params.notes ?? null,
      })
      .select("*")
      .single();
    if (saleErr) throw saleErr;

    const saleId = (sale as PosSale).id;
    const { error: itemsErr } = await supabase.from("pos_sale_items").insert(
      items.map((i) => ({ ...i, pos_sale_id: saleId }))
    );
    if (itemsErr) throw itemsErr;

    if (params.customerId && params.saleStatus !== "held") {
      const points = Math.floor(total / 100) * LOYALTY_POINTS_PER_100;
      if (points > 0) {
        await loyaltyService.earnPoints(params.customerId, points, "pos_sale", saleId);
      }
      if (params.loyaltyPointsRedeemed) {
        await loyaltyService.redeemPoints(
          params.customerId,
          params.loyaltyPointsRedeemed,
          "pos_sale",
          saleId
        );
      }
    }

    return this.getById(saleId) as Promise<PosSale>;
  },

  async holdBill(params: {
    lines: PosCartLine[];
    customerName?: string;
    notes?: string;
  }): Promise<PosSale> {
    return this.createSale({
      ...params,
      paymentMethod: "cash",
      saleStatus: "held",
    });
  },

  async resumeBill(saleId: string): Promise<PosSale> {
    const supabase = createClient();
    const { error } = await supabase
      .from("pos_sales")
      .update({ sale_status: "completed", held_at: null })
      .eq("id", saleId);
    if (error) throw error;
    return this.getById(saleId) as Promise<PosSale>;
  },

  async cancelBill(saleId: string): Promise<void> {
    const supabase = createClient();
    const sale = await this.getById(saleId);
    if (!sale) throw new Error("Sale not found");

    for (const item of sale.pos_sale_items ?? []) {
      await supabase.rpc("apply_stock_movement", {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
        p_movement_type: "cancel",
        p_reference_type: "pos_sale",
        p_reference_id: saleId,
        p_notes: "POS bill cancelled",
      });
    }

    await supabase
      .from("pos_sales")
      .update({ sale_status: "cancelled" })
      .eq("id", saleId);
  },

  async getById(id: string): Promise<PosSale | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pos_sales")
      .select("*, pos_sale_items(*)")
      .eq("id", id)
      .single();
    if (error) return null;
    return data as PosSale;
  },

  async list(filters?: {
    status?: PosSaleStatus;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }): Promise<PosSale[]> {
    const supabase = createClient();
    let q = supabase
      .from("pos_sales")
      .select("*, pos_sale_items(*)")
      .order("created_at", { ascending: false })
      .limit(filters?.limit ?? 50);
    if (filters?.status) q = q.eq("sale_status", filters.status);
    if (filters?.dateFrom) q = q.gte("created_at", filters.dateFrom);
    if (filters?.dateTo) q = q.lte("created_at", filters.dateTo);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as PosSale[];
  },

  async getHeldBills(): Promise<PosSale[]> {
    return this.list({ status: "held" });
  },

  async getTodayStats() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const sales = await this.list({ dateFrom: start.toISOString() });
    const completed = sales.filter((s) => s.sale_status === "completed");
    return {
      count: completed.length,
      total: completed.reduce((s, x) => s + Number(x.total_amount), 0),
      cash: completed
        .filter((s) => s.payment_method === "cash")
        .reduce((s, x) => s + Number(x.total_amount), 0),
      upi: completed
        .filter((s) => s.payment_method === "upi")
        .reduce((s, x) => s + Number(x.total_amount), 0),
      card: completed
        .filter((s) => s.payment_method === "card")
        .reduce((s, x) => s + Number(x.total_amount), 0),
    };
  },
};

import { requireClient } from "@/lib/supabase/client";
import type { ErpProduct, LotStockMovement, ProductLot } from "@/types/erp";

const lotSelect = `*, products(name, sku, barcode, price, selling_price)`;

export interface BarcodeResolveResult {
  product: ErpProduct;
  lot: ProductLot | null;
}

export const lotService = {
  async getByBarcode(barcode: string): Promise<ProductLot | null> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("product_lots")
      .select(lotSelect)
      .eq("barcode", barcode.trim())
      .eq("is_active", true)
      .gt("current_stock", 0)
      .maybeSingle();
    if (error) throw error;
    return data as ProductLot | null;
  },

  async listByProduct(productId: string): Promise<ProductLot[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("product_lots")
      .select(lotSelect)
      .eq("product_id", productId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ProductLot[];
  },

  async listAll(filters?: {
    search?: string;
    lowStock?: boolean;
    nearExpiryDays?: number;
  }): Promise<ProductLot[]> {
    const supabase = requireClient();
    let q = supabase
      .from("product_lots")
      .select(lotSelect)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    const { data, error } = await q;
    if (error) throw error;

    let rows = (data ?? []) as ProductLot[];
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      rows = rows.filter(
        (l) =>
          l.barcode.toLowerCase().includes(s) ||
          l.lot_number?.toLowerCase().includes(s) ||
          l.batch_number?.toLowerCase().includes(s) ||
          l.products?.name?.toLowerCase().includes(s)
      );
    }
    if (filters?.lowStock) {
      rows = rows.filter((l) => l.current_stock <= 5);
    }
    if (filters?.nearExpiryDays) {
      const until = new Date();
      until.setDate(until.getDate() + filters.nearExpiryDays);
      const today = new Date().toISOString().slice(0, 10);
      rows = rows.filter(
        (l) =>
          l.expiry_date &&
          l.expiry_date >= today &&
          l.expiry_date <= until.toISOString().slice(0, 10)
      );
    }
    return rows;
  },

  async deductStock(
    lotId: string,
    quantity: number,
    referenceType: string,
    referenceId: string,
    notes?: string
  ): Promise<number> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc("apply_lot_stock_movement", {
      p_lot_id: lotId,
      p_quantity: -quantity,
      p_movement_type: "sale",
      p_reference_type: referenceType,
      p_reference_id: referenceId,
      p_notes: notes ?? "Sale deduction",
    });
    if (error) throw error;
    return data as number;
  },

  async getMovements(lotId?: string, limit = 100): Promise<LotStockMovement[]> {
    const supabase = requireClient();
    let q = supabase
      .from("lot_stock_movements")
      .select("*, product_lots(barcode, lot_number, batch_number), products(name, sku)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (lotId) q = q.eq("lot_id", lotId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as LotStockMovement[];
  },

  async create(params: {
    productId: string;
    barcode: string;
    lotNumber?: string;
    batchNumber?: string;
    purchasePrice?: number;
    sellingPrice?: number;
    mrp?: number;
    quantity: number;
    expiryDate?: string;
  }): Promise<ProductLot> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("product_lots")
      .insert({
        product_id: params.productId,
        barcode: params.barcode.trim(),
        lot_number: params.lotNumber ?? `LOT-${Date.now().toString().slice(-6)}`,
        batch_number: params.batchNumber ?? null,
        purchase_price: params.purchasePrice ?? 0,
        selling_price: params.sellingPrice ?? null,
        mrp: params.mrp ?? null,
        quantity: params.quantity,
        current_stock: params.quantity,
        expiry_date: params.expiryDate ?? null,
      })
      .select(lotSelect)
      .single();
    if (error) throw error;
    return data as ProductLot;
  },
};

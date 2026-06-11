import { createClient } from "@/lib/supabase/client";
import { lotService } from "./lot.service";
import type { ErpProduct, LowStockProduct, ProductLot, StockMovement } from "@/types/erp";

const productSelect = `*, categories(id, name, slug)`;

export const inventoryService = {
  async listProducts(filters?: {
    search?: string;
    categoryId?: string;
    lowStockOnly?: boolean;
  }): Promise<ErpProduct[]> {
    const supabase = createClient();
    let q = supabase
      .from("products")
      .select(productSelect)
      .eq("is_active", true)
      .order("name");

    if (filters?.categoryId) q = q.eq("category_id", filters.categoryId);
    if (filters?.search) {
      const s = `%${filters.search}%`;
      q = q.or(`name.ilike.${s},sku.ilike.${s},barcode.ilike.${s}`);
    }

    const { data, error } = await q;
    if (error) throw error;

    let rows = (data ?? []) as ErpProduct[];
    if (filters?.lowStockOnly) {
      rows = rows.filter(
        (p) => p.stock <= (p.min_stock_level ?? p.reorder_level ?? 10)
      );
    }
    return rows;
  },

  async getByBarcode(barcode: string): Promise<ErpProduct | null> {
    const resolved = await this.resolveByBarcode(barcode);
    return resolved?.product ?? null;
  },

  async resolveByBarcode(
    barcode: string
  ): Promise<{ product: ErpProduct; lot: ProductLot | null } | null> {
    const trimmed = barcode.trim();
    if (!trimmed) return null;

    const lot = await lotService.getByBarcode(trimmed);
    if (lot?.products) {
      const product = await this.getById(lot.product_id);
      if (product) return { product, lot };
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select(productSelect)
      .eq("barcode", trimmed)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { product: data as ErpProduct, lot: null };
  },

  async getById(id: string): Promise<ErpProduct | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select(productSelect)
      .eq("id", id)
      .single();
    if (error) return null;
    return data as ErpProduct;
  },

  async upsertProduct(
    product: Partial<ErpProduct> & { name: string; slug: string; price: number }
  ): Promise<ErpProduct> {
    const supabase = createClient();
    const payload = {
      ...product,
      selling_price: product.selling_price ?? product.price,
      price: product.selling_price ?? product.price,
    };
    if (product.id) {
      const { data, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", product.id)
        .select(productSelect)
        .single();
      if (error) throw error;
      return data as ErpProduct;
    }
    const { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select(productSelect)
      .single();
    if (error) throw error;
    return data as ErpProduct;
  },

  async adjustStock(
    productId: string,
    quantity: number,
    notes?: string,
    movementType: "adjustment" | "damaged" = "adjustment"
  ) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("apply_stock_movement", {
      p_product_id: productId,
      p_quantity: quantity,
      p_movement_type: movementType,
      p_reference_type: "manual",
      p_notes: notes ?? "Manual adjustment",
    });
    if (error) throw error;
    return data as number;
  },

  async getStockMovements(productId?: string, limit = 100): Promise<StockMovement[]> {
    const supabase = createClient();
    let q = supabase
      .from("stock_movements")
      .select("*, products(name, sku, barcode)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (productId) q = q.eq("product_id", productId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as StockMovement[];
  },

  async getLowStock(): Promise<LowStockProduct[]> {
    const products = await this.listProducts({ lowStockOnly: true });
    return products.map((p) => {
      const min = p.min_stock_level ?? p.reorder_level ?? 5;
      return {
        id: p.id,
        name: p.name,
        stock: p.stock,
        min_stock_level: min,
        required_quantity: Math.max(0, min - p.stock + min),
      };
    });
  },

  async getExpiringProducts(withinDays = 30): Promise<ErpProduct[]> {
    const supabase = createClient();
    const until = new Date();
    until.setDate(until.getDate() + withinDays);
    const { data, error } = await supabase
      .from("products")
      .select(productSelect)
      .not("expiry_date", "is", null)
      .lte("expiry_date", until.toISOString().slice(0, 10))
      .gte("expiry_date", new Date().toISOString().slice(0, 10))
      .order("expiry_date");
    if (error) throw error;
    return (data ?? []) as ErpProduct[];
  },

  async getInventoryValue(): Promise<number> {
    const products = await this.listProducts();
    return products.reduce(
      (sum, p) =>
        sum + p.stock * (p.purchase_price ?? p.price * 0.85),
      0
    );
  },
};

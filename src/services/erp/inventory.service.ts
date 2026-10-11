import { requireClient } from "@/lib/supabase/client";
import type { ErpProduct, LowStockProduct, ProductLot, StockMovement } from "@/types/erp";
import {
  saveProductCatalog,
  searchProductsOffline,
  findProductByBarcodeOffline,
} from "@/lib/offline/product-cache";

const productSelect = `*, categories(id, name, slug)`;

const BARCODE_CACHE_MS = 15_000;
const barcodeResolveCache = new Map<
  string,
  { at: number; result: { product: ErpProduct; lot: ProductLot | null } | null }
>();

export const inventoryService = {
  async listProducts(filters?: {
    search?: string;
    categoryId?: string;
    lowStockOnly?: boolean;
  }): Promise<ErpProduct[]> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return searchProductsOffline(filters?.search ?? "");
    }

    try {
      const supabase = requireClient();
      let q = supabase
        .from("products")
        .select(productSelect)
        .eq("is_active", true)
        .order("name");

      if (filters?.categoryId) q = q.eq("category_id", filters.categoryId);

      const rawSearch = filters?.search?.trim();
      if (rawSearch) {
        // Sanitize for PostgREST: strip quotes and backslashes to prevent delimiter/syntax errors
        const clean = rawSearch.replace(/["\\]/g, "").trim();
        if (clean) {
          // Double-quote value inside .or() to safely handle commas, brackets, and spaces in PostgREST
          const s = `"%${clean}%"`;
          q = q.or(`name.ilike.${s},sku.ilike.${s},barcode.ilike.${s}`);
        }
      }

      const { data, error } = await q;
      if (error) {
        console.warn("[inventoryService.listProducts] Primary query warning:", error.message);
        throw error;
      }

      let rows = (data ?? []) as ErpProduct[];

      // Fallback: If 0 results returned and search contains multiple words or punctuation,
      // try a tokenized search matching each word against the product name
      if (rows.length === 0 && rawSearch) {
        const tokens = rawSearch
          .replace(/["\\]/g, "")
          .replace(/[,()+\-_/\\:;*]/g, " ")
          .split(/\s+/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

        if (tokens.length > 1) {
          let tokenQ = supabase
            .from("products")
            .select(productSelect)
            .eq("is_active", true);

          if (filters?.categoryId) tokenQ = tokenQ.eq("category_id", filters.categoryId);

          for (const token of tokens) {
            tokenQ = tokenQ.ilike("name", `%${token}%`);
          }

          const { data: tokenData, error: tokenError } = await tokenQ.order("name").limit(20);
          if (!tokenError && tokenData && tokenData.length > 0) {
            rows = tokenData as ErpProduct[];
          }
        }
      }

      if (filters?.lowStockOnly) {
        rows = rows.filter(
          (p) => p.stock <= (p.min_stock_level ?? p.reorder_level ?? 10)
        );
      }
      // Cache products in background for offline use
      if (!filters?.search && !filters?.categoryId) {
        saveProductCatalog(rows);
      }
      return rows;
    } catch (e) {
      // Fall back to offline search if network fails
      try {
        const offline = await searchProductsOffline(filters?.search ?? "");
        if (offline && offline.length) return offline;
      } catch {}
      console.warn("[inventoryService.listProducts] Handled search gracefully:", e);
      return [];
    }
  },

  async getByBarcode(barcode: string): Promise<ErpProduct | null> {
    const resolved = await this.resolveByBarcode(barcode);
    return resolved?.product ?? null;
  },

  async resolveByBarcode(
    barcode: string
  ): Promise<{ product: ErpProduct; lot: ProductLot | null; unit?: "pcs" | "pkt" | "box" } | null> {
    const trimmed = barcode.trim();
    if (!trimmed) return null;

    const cached = barcodeResolveCache.get(trimmed);
    if (cached && Date.now() - cached.at < BARCODE_CACHE_MS) {
      return cached.result;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        const offlineProduct = await findProductByBarcodeOffline(trimmed);
        if (offlineProduct) return { product: offlineProduct, lot: null, unit: "pcs" };
      } catch {}
      return null;
    }

    try {
      const supabase = requireClient();
      const [lotRes, productRes] = await Promise.all([
        supabase
          .from("product_lots")
          .select("*, products(*)")
          .eq("barcode", trimmed)
          .eq("is_active", true)
          .gt("current_stock", 0)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("products")
          .select(productSelect)
          .or(`barcode.eq.${trimmed},sku.eq.${trimmed}`)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle(),
      ]);

      if (lotRes.error) console.warn("[resolveByBarcode] Lot query warning:", lotRes.error.message);
      if (productRes.error) console.warn("[resolveByBarcode] Product query warning:", productRes.error.message);

      let result: { product: ErpProduct; lot: ProductLot | null; unit?: "pcs" | "pkt" | "box" } | null = null;
      const lot = (lotRes.data as (ProductLot & { products?: ErpProduct | null }) | null) ?? null;
      if (lot) {
        const nested = lot.products;
        const product =
          nested && "id" in nested ? (nested as ErpProduct) : await this.getById(lot.product_id);
        if (product) result = { product, lot, unit: "pcs" };
      }
      if (!result && productRes.data) {
        const p = productRes.data as ErpProduct;
        result = { product: p, lot: null, unit: "pcs" };
      }

      barcodeResolveCache.set(trimmed, { at: Date.now(), result });
      return result;
    } catch (e) {
      // Fall back to offline barcode lookup
      try {
        const offlineProduct = await findProductByBarcodeOffline(trimmed);
        if (offlineProduct) return { product: offlineProduct, lot: null, unit: "pcs" };
      } catch {}
      console.warn("[inventoryService.resolveByBarcode] Lookup failed gracefully:", e);
      return null;
    }
  },

  async getById(id: string): Promise<ErpProduct | null> {
    const supabase = requireClient();
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
    const supabase = requireClient();
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
    movementType: "adjustment" | "damaged" | "expired" = "adjustment"
  ) {
    const supabase = requireClient();
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

  async getStockLedger(limit = 500): Promise<
    import("@/types/erp").StockLedgerRow[]
  > {
    const movements = await this.getStockMovements(undefined, limit);
    return movements.map((m) => ({
      date: m.created_at,
      productName: m.products?.name ?? "—",
      transactionType: m.movement_type,
      referenceNumber: m.reference_id,
      qtyIn: m.quantity > 0 ? m.quantity : 0,
      qtyOut: m.quantity < 0 ? Math.abs(m.quantity) : 0,
      balance: m.stock_after,
    }));
  },

  async getStockMovements(productId?: string, limit = 100): Promise<StockMovement[]> {
    const supabase = requireClient();
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
    const supabase = requireClient();
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

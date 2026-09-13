import { requireClient } from "@/lib/supabase/client";
import {
  loadProductCatalog,
  saveProductCatalog,
  removeProductFromCatalog,
} from "@/lib/offline/product-cache";
import type { Product, ProductFilters } from "@/types/database";

function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /fetch|network|failed/i.test(msg);
}

function toProductRow(
  product: Partial<Product> & {
    name: string;
    slug: string;
    price: number;
    stock: number;
  }
) {
  const selling = product.selling_price ?? product.price;
  return {
    name: product.name,
    slug: product.slug,
    description: product.description?.trim() || null,
    price: selling,
    selling_price: selling,
    stock: product.stock,
    image_url: product.image_url?.trim() || null,
    category_id: product.category_id || null,
    featured: product.featured ?? false,
    sku: product.sku?.trim() || null,
    barcode: product.barcode?.trim() || null,
    brand: product.brand?.trim() || null,
    unit: product.unit?.trim() || "pcs",
    purchase_price: product.purchase_price ?? null,
    mrp: product.mrp ?? null,
    gst_percentage: product.gst_percentage ?? 0,
    reorder_level: product.reorder_level ?? 10,
    min_stock_level: product.min_stock_level ?? 5,
    max_stock_level: product.max_stock_level ?? null,
    expiry_date: product.expiry_date || null,
    batch_number: product.batch_number?.trim() || null,
  };
}

export const productService = {
  async getAll(filters: ProductFilters = {}): Promise<Product[]> {
    const supabase = requireClient();
    let query = supabase
      .from("products")
      .select("*, categories(id, name, slug, image)");

    if (!filters.includeInactive) {
      query = query.neq("is_active", false);
    }

    if (filters.category) {
      query = query.eq("category_id", filters.category);
    }
    if (filters.featured) {
      query = query.eq("featured", true);
    }
    if (filters.minPrice !== undefined) {
      query = query.gte("price", filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      query = query.lte("price", filters.maxPrice);
    }
    if (filters.search) {
      query = query.ilike("name", `%${filters.search}%`);
    }

    switch (filters.sort) {
      case "price-asc":
        query = query.order("price", { ascending: true });
        break;
      case "price-desc":
        query = query.order("price", { ascending: false });
        break;
      case "name-asc":
        query = query.order("name", { ascending: true });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    try {
      const { data, error } = await query;
      if (error) throw error;
      const products = (data ?? []) as Product[];
      saveProductCatalog(products);
      return products;
    } catch (err) {
      if (isOfflineError(err)) {
        const cached = await loadProductCatalog();
        if (cached?.length) {
          return applyProductFilters(cached as Product[], filters);
        }
      }
      throw err;
    }
  },

  async getBySlug(slug: string): Promise<Product | null> {
    try {
      const supabase = requireClient();
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(id, name, slug, image)")
        .eq("slug", slug)
        .single();
      if (error) return null;
      return data as Product;
    } catch {
      const cached = await loadProductCatalog();
      return (cached as Product[])?.find((p) => p.slug === slug) ?? null;
    }
  },

  async getById(id: string): Promise<Product | null> {
    try {
      const supabase = requireClient();
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();
      if (error) return null;
      return data as Product;
    } catch {
      const cached = await loadProductCatalog();
      return (cached as Product[])?.find((p) => p.id === id) ?? null;
    }
  },

  async create(
    product: Omit<Product, "id" | "created_at" | "categories">
  ) {
    const supabase = requireClient();
    const row = toProductRow(product);

    const { data, error } = await supabase
      .from("products")
      .insert(row)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("A product with this slug already exists. Use a different slug.");
      }
      if (error.code === "42501" || error.message.includes("policy")) {
        throw new Error(
          "Permission denied. Make sure your account has admin role in Supabase."
        );
      }
      throw new Error(error.message);
    }
    return data as Product;
  },

  async update(id: string, product: Partial<Product>) {
    const supabase = requireClient();
    const row: Record<string, unknown> = {};

    if (product.name !== undefined) row.name = product.name;
    if (product.slug !== undefined) row.slug = product.slug;
    if (product.description !== undefined) row.description = product.description?.trim() || null;
    if (product.price !== undefined) row.price = product.price;
    if (product.stock !== undefined) row.stock = product.stock;
    if (product.image_url !== undefined) row.image_url = product.image_url?.trim() || null;
    if (product.category_id !== undefined) row.category_id = product.category_id || null;
    if (product.featured !== undefined) row.featured = product.featured;

    const { data, error } = await supabase
      .from("products")
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("A product with this slug already exists.");
      }
      throw new Error(error.message);
    }
    return data as Product;
  },

  async remove(
    id: string,
    options?: { force?: boolean }
  ): Promise<{ success: boolean; action: string; message: string }> {
    const supabase = requireClient();

    // 1. Try dedicated database RPC delete_product
    try {
      const { data, error } = await supabase.rpc("delete_product", {
        p_product_id: id,
        p_force: options?.force ?? false,
      });
      if (!error && data) {
        removeProductFromCatalog(id);
        const res = data as { success?: boolean; action?: string; message?: string };
        return {
          success: res.success ?? true,
          action: res.action ?? "deleted",
          message: res.message ?? "Product deleted successfully",
        };
      }
    } catch {
      // Fallback to client-side cleanup below
    }

    // 2. Client-side fallback
    const { count: posCount } = await supabase
      .from("pos_sale_items")
      .select("*", { count: "exact", head: true })
      .eq("product_id", id);
    const { count: orderCount } = await supabase
      .from("order_items")
      .select("*", { count: "exact", head: true })
      .eq("product_id", id);

    if (((posCount ?? 0) > 0 || (orderCount ?? 0) > 0) && !options?.force) {
      await supabase.from("products").update({ is_active: false }).eq("id", id);
      removeProductFromCatalog(id);
      return {
        success: true,
        action: "deactivated",
        message: "Product has sales history and was archived to preserve records.",
      };
    }

    // Clean up accessible dependent records
    await supabase.from("cart_items").delete().eq("product_id", id);
    await supabase.from("wishlist").delete().eq("product_id", id);
    await supabase.from("barcode_labels").delete().eq("product_id", id);
    await supabase.from("product_lots").delete().eq("product_id", id);
    await supabase.from("product_variants").delete().eq("product_id", id);
    await supabase.from("lot_stock_movements").delete().eq("product_id", id);
    await supabase.from("stock_movements").delete().eq("product_id", id);

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      // If foreign key constraint still blocks it, soft-deactivate
      const { error: updateError } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", id);
      if (!updateError) {
        removeProductFromCatalog(id);
        return {
          success: true,
          action: "deactivated",
          message: "Product has linked records and was archived.",
        };
      }
      throw new Error(error.message || "Failed to delete product");
    }

    removeProductFromCatalog(id);
    return {
      success: true,
      action: "deleted",
      message: "Product deleted successfully",
    };
  },
};

function applyProductFilters(
  products: Product[],
  filters: ProductFilters
): Product[] {
  let list = [...products];
  if (filters.category) {
    list = list.filter((p) => p.category_id === filters.category);
  }
  if (filters.featured) {
    list = list.filter((p) => p.featured);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q));
  }
  if (filters.minPrice !== undefined) {
    list = list.filter((p) => p.price >= filters.minPrice!);
  }
  if (filters.maxPrice !== undefined) {
    list = list.filter((p) => p.price <= filters.maxPrice!);
  }
  switch (filters.sort) {
    case "price-asc":
      list.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      list.sort((a, b) => b.price - a.price);
      break;
    case "name-asc":
      list.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      break;
  }
  return list;
}

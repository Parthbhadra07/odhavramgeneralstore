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

function isColumnMissingError(
  error: { code?: string; message?: string; details?: string } | null | undefined
): boolean {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  const details = String(error.details || "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST200" ||
    msg.includes("column") ||
    msg.includes("schema cache") ||
    msg.includes("box_selling_price") ||
    msg.includes("packet_selling_price") ||
    msg.includes("auto_refill") ||
    msg.includes("pieces_per_packet") ||
    msg.includes("packets_per_box") ||
    details.includes("column") ||
    details.includes("schema cache") ||
    details.includes("auto_refill")
  );
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
    sku: null,
    barcode: product.barcode?.trim() || null,
    brand: product.brand?.trim() || null,
    unit: product.unit?.trim() || "pcs",
    pieces_per_packet: product.pieces_per_packet ?? 12,
    packets_per_box: product.packets_per_box ?? 12,
    packet_selling_price: product.packet_selling_price ?? null,
    box_selling_price: product.box_selling_price ?? null,
    purchase_price: product.purchase_price ?? null,
    mrp: product.mrp ?? null,
    gst_percentage: product.gst_percentage ?? 0,
    reorder_level: product.reorder_level ?? 10,
    min_stock_level: product.min_stock_level ?? 5,
    max_stock_level: product.max_stock_level ?? null,
    expiry_date: product.expiry_date || null,
    batch_number: product.batch_number?.trim() || null,
    auto_refill_enabled: product.auto_refill_enabled ?? false,
    auto_refill_quantity: product.auto_refill_quantity ? Number(product.auto_refill_quantity) : 0,
    auto_refill_time: product.auto_refill_time?.trim() || "06:00",
    last_auto_refilled_date: product.last_auto_refilled_date || null,
    auto_refill_slot2_enabled: product.auto_refill_slot2_enabled ?? false,
    auto_refill_slot2_quantity: product.auto_refill_slot2_quantity ? Number(product.auto_refill_slot2_quantity) : 0,
    auto_refill_slot2_time: product.auto_refill_slot2_time?.trim() || "16:00",
    last_auto_refilled_slot2_date: product.last_auto_refilled_slot2_date || null,
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
    let row: Record<string, unknown> = toProductRow(product);

    let data: any = null;
    let error: any = null;

    // Retry loop for unique slug resolution
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await supabase
        .from("products")
        .insert(row)
        .select()
        .single();
      data = res.data;
      error = res.error;

      if (error && isColumnMissingError(error)) {
        // Column does not exist yet (migration 023/025 not run). Strip packaging & auto-refill fields and retry
        delete row.pieces_per_packet;
        delete row.packets_per_box;
        delete row.packet_selling_price;
        delete row.box_selling_price;
        delete row.box_price;
        delete row.packet_price;
        delete row.auto_refill_enabled;
        delete row.auto_refill_quantity;
        delete row.auto_refill_time;
        delete row.last_auto_refilled_date;
        delete row.auto_refill_slot2_enabled;
        delete row.auto_refill_slot2_quantity;
        delete row.auto_refill_slot2_time;
        delete row.last_auto_refilled_slot2_date;
        const retry = await supabase.from("products").insert(row).select().single();
        data = retry.data;
        error = retry.error;
      }

      // If duplicate slug (code 23505), automatically append unique number and retry!
      if (
        error &&
        error.code === "23505" &&
        (error.message?.includes("slug") ||
          error.details?.includes("slug") ||
          error.message?.includes("products_slug_key"))
      ) {
        const base = String(row.slug || "product").replace(/-\d+$/, "");
        row = {
          ...row,
          slug: `${base}-${attempt + 2}`,
        };
        continue;
      }

      break;
    }

    if (error) {
      if (
        error.code === "23505" &&
        (error.message?.includes("sku") || error.details?.includes("sku"))
      ) {
        const retry = await supabase.from("products").insert({ ...row, sku: null }).select().single();
        if (!retry.error && retry.data) {
          return retry.data as Product;
        }
      }

      if (
        error.code === "23505" &&
        (error.message?.includes("slug") ||
          error.details?.includes("slug") ||
          error.message?.includes("products_slug_key"))
      ) {
        const uniqueSlug = `${String(row.slug || "product").replace(/-\d+$/, "")}-${Date.now().toString(36).slice(-4)}`;
        const lastTry = await supabase.from("products").insert({ ...row, slug: uniqueSlug, sku: null }).select().single();
        if (!lastTry.error && lastTry.data) {
          return lastTry.data as Product;
        }
      }

      if (error.code === "23505") {
        if (error.message?.includes("barcode") || error.details?.includes("barcode")) {
          throw new Error("A product with this barcode already exists.");
        }
        throw new Error("A product with this name or barcode already exists. Please check your Active or Archived products.");
      }
      if (error.code === "42501" || error.message?.includes("policy")) {
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
    if (product.price !== undefined) {
      row.price = product.price;
      row.selling_price = product.selling_price ?? product.price;
    }
    if (product.selling_price !== undefined) row.selling_price = product.selling_price;
    if (product.stock !== undefined) row.stock = product.stock;
    if (product.image_url !== undefined) row.image_url = product.image_url?.trim() || null;
    if (product.category_id !== undefined) row.category_id = product.category_id || null;
    if (product.featured !== undefined) row.featured = product.featured;
    if (product.is_bestseller !== undefined) row.is_bestseller = product.is_bestseller;
    if (product.is_new_arrival !== undefined) row.is_new_arrival = product.is_new_arrival;
    if (product.sku !== undefined) row.sku = null;
    if (product.barcode !== undefined) row.barcode = product.barcode?.trim() || null;
    if (product.brand !== undefined) row.brand = product.brand?.trim() || null;
    if (product.unit !== undefined) row.unit = product.unit?.trim() || "pcs";
    if (product.pieces_per_packet !== undefined) row.pieces_per_packet = product.pieces_per_packet;
    if (product.packets_per_box !== undefined) row.packets_per_box = product.packets_per_box;
    if (product.packet_selling_price !== undefined) row.packet_selling_price = product.packet_selling_price;
    if (product.box_selling_price !== undefined) row.box_selling_price = product.box_selling_price;
    if (product.purchase_price !== undefined) row.purchase_price = product.purchase_price;
    if (product.mrp !== undefined) row.mrp = product.mrp;
    if (product.gst_percentage !== undefined) row.gst_percentage = product.gst_percentage;
    if (product.reorder_level !== undefined) row.reorder_level = product.reorder_level;
    if (product.min_stock_level !== undefined) row.min_stock_level = product.min_stock_level;
    if (product.auto_refill_enabled !== undefined) row.auto_refill_enabled = product.auto_refill_enabled;
    if (product.auto_refill_quantity !== undefined) row.auto_refill_quantity = product.auto_refill_quantity;
    if (product.auto_refill_time !== undefined) row.auto_refill_time = product.auto_refill_time;
    if (product.last_auto_refilled_date !== undefined) row.last_auto_refilled_date = product.last_auto_refilled_date;
    if (product.auto_refill_slot2_enabled !== undefined) row.auto_refill_slot2_enabled = product.auto_refill_slot2_enabled;
    if (product.auto_refill_slot2_quantity !== undefined) row.auto_refill_slot2_quantity = product.auto_refill_slot2_quantity;
    if (product.auto_refill_slot2_time !== undefined) row.auto_refill_slot2_time = product.auto_refill_slot2_time;
    if (product.last_auto_refilled_slot2_date !== undefined) row.last_auto_refilled_slot2_date = product.last_auto_refilled_slot2_date;

    let { data, error } = await supabase
      .from("products")
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error && isColumnMissingError(error)) {
      // Column does not exist yet (migration 023/025 not run). Strip packaging & auto-refill fields and retry
      const cleanRow: Record<string, unknown> = { ...row };
      delete cleanRow.pieces_per_packet;
      delete cleanRow.packets_per_box;
      delete cleanRow.packet_selling_price;
      delete cleanRow.box_selling_price;
      delete cleanRow.box_price;
      delete cleanRow.packet_price;
      delete cleanRow.auto_refill_enabled;
      delete cleanRow.auto_refill_quantity;
      delete cleanRow.auto_refill_time;
      delete cleanRow.last_auto_refilled_date;
      delete cleanRow.auto_refill_slot2_enabled;
      delete cleanRow.auto_refill_slot2_quantity;
      delete cleanRow.auto_refill_slot2_time;
      delete cleanRow.last_auto_refilled_slot2_date;
      const retry = await supabase.from("products").update(cleanRow).eq("id", id).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (
      error &&
      error.code === "23505" &&
      (error.message?.includes("sku") || error.details?.includes("sku"))
    ) {
      const retry = await supabase.from("products").update({ ...row, sku: null }).eq("id", id).select().single();
      if (!retry.error && retry.data) {
        return retry.data as Product;
      }
    }

    if (
      error &&
      error.code === "23505" &&
      (error.message?.includes("slug") ||
        error.details?.includes("slug") ||
        error.message?.includes("products_slug_key"))
    ) {
      const base = String(row.slug || "product").replace(/-\d+$/, "");
      const uniqueSlug = `${base}-${Date.now().toString(36).slice(-4)}`;
      const retry = await supabase.from("products").update({ ...row, slug: uniqueSlug, sku: null }).eq("id", id).select().single();
      if (!retry.error && retry.data) {
        return retry.data as Product;
      }
    }

    if (error) {
      if (error.code === "23505") {
        if (error.message?.includes("barcode") || error.details?.includes("barcode")) {
          throw new Error("A product with this barcode already exists.");
        }
        throw new Error("A product with this name or barcode already exists.");
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

    // If force deleting, clean up sales and purchase references
    if (options?.force) {
      try { await supabase.from("pos_sale_items").delete().eq("product_id", id); } catch {}
      try { await supabase.from("order_items").delete().eq("product_id", id); } catch {}
      try { await supabase.from("sales_return_items").delete().eq("product_id", id); } catch {}
      try { await supabase.from("purchase_return_items").delete().eq("product_id", id); } catch {}
      try { await supabase.from("purchase_items").delete().eq("product_id", id); } catch {}
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
      // If foreign key constraint still blocks it and not force, soft-deactivate
      if (!options?.force) {
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

  async restore(id: string): Promise<{ success: boolean; message: string }> {
    const supabase = requireClient();
    const { error } = await supabase.from("products").update({ is_active: true }).eq("id", id);
    if (error) throw new Error(error.message || "Failed to restore product");
    return {
      success: true,
      message: "Product restored to active catalog.",
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

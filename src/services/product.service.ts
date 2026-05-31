import { createClient } from "@/lib/supabase/client";
import type { Product, ProductFilters } from "@/types/database";

function toProductRow(
  product: Partial<Product> & {
    name: string;
    slug: string;
    price: number;
    stock: number;
  }
) {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description?.trim() || null,
    price: product.price,
    stock: product.stock,
    image_url: product.image_url?.trim() || null,
    category_id: product.category_id || null,
    featured: product.featured ?? false,
  };
}

export const productService = {
  async getAll(filters: ProductFilters = {}): Promise<Product[]> {
    const supabase = createClient();
    let query = supabase
      .from("products")
      .select("*, categories(id, name, slug, image)");

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

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Product[];
  },

  async getBySlug(slug: string): Promise<Product | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*, categories(id, name, slug, image)")
      .eq("slug", slug)
      .single();
    if (error) return null;
    return data as Product;
  },

  async getById(id: string): Promise<Product | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    return data as Product;
  },

  async create(
    product: Omit<Product, "id" | "created_at" | "categories">
  ) {
    const supabase = createClient();
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
    const supabase = createClient();
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

  async remove(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
  },
};

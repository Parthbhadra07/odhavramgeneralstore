import { createClient } from "@/lib/supabase/client";
import type { ProductVariant, ProductImage } from "@/types/erp";

export const variantService = {
  async listByProduct(productId: string): Promise<ProductVariant[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order");
    if (error) throw error;
    return (data ?? []) as ProductVariant[];
  },

  async upsert(variant: Partial<ProductVariant> & { product_id: string; name: string; selling_price: number }): Promise<ProductVariant> {
    const supabase = createClient();
    const payload = {
      ...variant,
      updated_at: new Date().toISOString(),
    };
    if (variant.id) {
      const { data, error } = await supabase
        .from("product_variants")
        .update(payload)
        .eq("id", variant.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as ProductVariant;
    }
    const { data, error } = await supabase
      .from("product_variants")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return data as ProductVariant;
  },

  async remove(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("product_variants").delete().eq("id", id);
    if (error) throw error;
  },

  async setPrimary(productId: string, variantId: string): Promise<void> {
    const supabase = createClient();
    await supabase.from("product_variants").update({ is_primary: false }).eq("product_id", productId);
    await supabase.from("product_variants").update({ is_primary: true }).eq("id", variantId);
  },

  async listImages(productId: string): Promise<ProductImage[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("product_images")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order");
    if (error) throw error;
    return (data ?? []) as ProductImage[];
  },

  async addImage(productId: string, url: string, isPrimary = false): Promise<ProductImage> {
    const supabase = createClient();
    if (isPrimary) {
      await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
    }
    const { data, error } = await supabase
      .from("product_images")
      .insert({ product_id: productId, url, is_primary: isPrimary })
      .select("*")
      .single();
    if (error) throw error;
    return data as ProductImage;
  },

  async setPrimaryImage(productId: string, imageId: string): Promise<void> {
    const supabase = createClient();
    await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
    await supabase.from("product_images").update({ is_primary: true }).eq("id", imageId);
    const { data } = await supabase.from("product_images").select("url").eq("id", imageId).single();
    if (data?.url) {
      await supabase.from("products").update({ image_url: data.url }).eq("id", productId);
    }
  },

  async removeImage(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("product_images").delete().eq("id", id);
    if (error) throw error;
  },
};

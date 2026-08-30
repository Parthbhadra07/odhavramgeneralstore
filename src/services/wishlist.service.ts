import { requireClient } from "@/lib/supabase/client";
import type { WishlistItem } from "@/types/database";

export const wishlistService = {
  async getItems(userId: string): Promise<WishlistItem[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("wishlist")
      .select("*, products(*)")
      .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []) as WishlistItem[];
  },

  async add(userId: string, productId: string) {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("wishlist")
      .insert({ user_id: userId, product_id: productId })
      .select("*, products(*)")
      .single();
    if (error) throw error;
    return data as WishlistItem;
  },

  async remove(userId: string, productId: string) {
    const supabase = requireClient();
    const { error } = await supabase
      .from("wishlist")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);
    if (error) throw error;
  },

  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const supabase = requireClient();
    const { data } = await supabase
      .from("wishlist")
      .select("id")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .maybeSingle();
    return !!data;
  },
};

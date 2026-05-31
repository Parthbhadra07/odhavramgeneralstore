import { createClient } from "@/lib/supabase/client";
import type { CartItem } from "@/types/database";

export const cartService = {
  async getItems(userId: string): Promise<CartItem[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("cart_items")
      .select("*, products(*)")
      .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []) as CartItem[];
  },

  async addItem(userId: string, productId: string, quantity: number) {
    const supabase = createClient();
    const { data: existing } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("cart_items")
        .update({ quantity: existing.quantity + quantity })
        .eq("id", existing.id)
        .select("*, products(*)")
        .single();
      if (error) throw error;
      return data as CartItem;
    }

    const { data, error } = await supabase
      .from("cart_items")
      .insert({ user_id: userId, product_id: productId, quantity })
      .select("*, products(*)")
      .single();
    if (error) throw error;
    return data as CartItem;
  },

  async updateQuantity(itemId: string, quantity: number) {
    const supabase = createClient();
    if (quantity <= 0) {
      return this.removeItem(itemId);
    }
    const { data, error } = await supabase
      .from("cart_items")
      .update({ quantity })
      .eq("id", itemId)
      .select("*, products(*)")
      .single();
    if (error) throw error;
    return data as CartItem;
  },

  async removeItem(itemId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
    if (error) throw error;
  },

  async clearCart(userId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", userId);
    if (error) throw error;
  },
};

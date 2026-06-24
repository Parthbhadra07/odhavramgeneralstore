import { requireClient } from "@/lib/supabase/client";
import type { Address } from "@/types/database";
import type { AddressInput } from "@/lib/validators";

export const addressService = {
  async getByUser(userId: string): Promise<Address[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Address[];
  },

  async create(userId: string, input: AddressInput) {
    const supabase = requireClient();

    if (input.is_default) {
      await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", userId);
    }

    const { data, error } = await supabase
      .from("addresses")
      .insert({ ...input, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return data as Address;
  },

  async update(id: string, userId: string, input: Partial<AddressInput>) {
    const supabase = requireClient();

    if (input.is_default) {
      await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", userId);
    }

    const { data, error } = await supabase
      .from("addresses")
      .update(input)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw error;
    return data as Address;
  },

  async remove(id: string, userId: string) {
    const supabase = requireClient();
    const { error } = await supabase
      .from("addresses")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
  },
};

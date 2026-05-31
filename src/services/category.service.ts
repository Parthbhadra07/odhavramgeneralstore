import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/types/database";

export const categoryService = {
  async getAll(): Promise<Category[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    if (error) throw error;
    return (data ?? []) as Category[];
  },

  async getBySlug(slug: string): Promise<Category | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("slug", slug)
      .single();
    if (error) return null;
    return data as Category;
  },

  async create(category: Omit<Category, "id">) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("categories")
      .insert(category)
      .select()
      .single();
    if (error) throw error;
    return data as Category;
  },

  async update(id: string, category: Partial<Category>) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("categories")
      .update(category)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Category;
  },

  async remove(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw error;
  },
};

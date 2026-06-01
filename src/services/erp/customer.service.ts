import { createClient } from "@/lib/supabase/client";
import type { Customer } from "@/types/erp";

export const customerService = {
  async list(search?: string): Promise<Customer[]> {
    const supabase = createClient();
    let q = supabase.from("customers").select("*").order("name");
    if (search) {
      q = q.or(`name.ilike.%${search}%,mobile.ilike.%${search}%`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Customer[];
  },

  async getByMobile(mobile: string): Promise<Customer | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("mobile", mobile.trim())
      .maybeSingle();
    if (error) throw error;
    return data as Customer | null;
  },

  async upsert(customer: Partial<Customer> & { name: string; mobile: string }): Promise<Customer> {
    const supabase = createClient();
    const existing = await this.getByMobile(customer.mobile);
    if (existing) {
      const { data, error } = await supabase
        .from("customers")
        .update({ ...customer, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data as Customer;
    }
    const { data, error } = await supabase
      .from("customers")
      .insert(customer)
      .select()
      .single();
    if (error) throw error;
    return data as Customer;
  },

  async getPurchaseHistory(customerId: string) {
    const supabase = createClient();
    const { data: pos } = await supabase
      .from("pos_sales")
      .select("*, pos_sale_items(*)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    return { posSales: pos ?? [] };
  },
};

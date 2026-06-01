import { createClient } from "@/lib/supabase/client";
import type { Customer } from "@/types/erp";
import { isValidMobile, normalizeMobile } from "@/utils/phone";

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
    const normalized = normalizeMobile(mobile);
    if (normalized.length < 10) return null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("mobile", normalized)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as Customer;

    const { data: rows, error: searchErr } = await supabase
      .from("customers")
      .select("*")
      .or(`mobile.eq.${normalized},mobile.ilike.%${normalized.slice(-10)}`);
    if (searchErr) throw searchErr;
    const match = (rows ?? []).find(
      (c) => normalizeMobile(c.mobile as string) === normalized
    );
    return (match ?? null) as Customer | null;
  },

  /** Match saved customer by mobile and/or name (POS counter). */
  async findForPos(opts: {
    mobile?: string;
    name?: string;
  }): Promise<Customer | null> {
    if (opts.mobile?.trim()) {
      const byMobile = await this.getByMobile(opts.mobile);
      if (byMobile) return byMobile;
    }
    const name = opts.name?.trim();
    if (!name || name.length < 2) return null;

    const list = await this.list(name);
    const lower = name.toLowerCase();
    const exact = list.find((c) => c.name.toLowerCase() === lower);
    if (exact) return exact;
    if (list.length === 1) return list[0];
    return null;
  },

  /** Link POS sale to customers row; create if new mobile. */
  async resolveForPos(opts: {
    customerId?: string;
    mobile?: string;
    name?: string;
  }): Promise<Customer | null> {
    if (opts.customerId) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", opts.customerId)
        .maybeSingle();
      if (error) throw error;
      return data as Customer | null;
    }

    const mobileRaw = opts.mobile?.trim();
    if (!mobileRaw) return null;

    const mobile = normalizeMobile(mobileRaw);
    if (!isValidMobile(mobileRaw)) return null;

    const name = opts.name?.trim() || "Customer";
    const existing = await this.getByMobile(mobile);
    if (existing) {
      if (opts.name?.trim() && existing.name !== opts.name.trim()) {
        return this.upsert({
          ...existing,
          mobile,
          name: opts.name.trim(),
        });
      }
      return existing;
    }

    return this.upsert({ mobile, name });
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

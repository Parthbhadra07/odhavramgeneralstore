import { requireClient } from "@/lib/supabase/client";
import type { Customer, CustomerWithStats } from "@/types/erp";
import { isValidMobile, normalizeMobile } from "@/utils/phone";

export const customerService = {
  async list(search?: string): Promise<Customer[]> {
    const supabase = requireClient();
    let q = supabase.from("customers").select("*").order("name");
    if (search) {
      q = q.or(`name.ilike.%${search}%,mobile.ilike.%${search}%`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Customer[];
  },

  async listWithStats(search?: string): Promise<CustomerWithStats[]> {
    const customers = await this.list(search);
    if (customers.length === 0) return [];

    const supabase = requireClient();
    const ids = customers.map((c) => c.id);
    const mobiles = customers.map((c) => normalizeMobile(c.mobile));

    const [{ data: posSales }, { data: orders }] = await Promise.all([
      supabase
        .from("pos_sales")
        .select("customer_id, total_amount, created_at")
        .in("customer_id", ids)
        .eq("sale_status", "completed"),
      supabase
        .from("orders")
        .select("customer_phone, total_amount, created_at, order_status")
        .or(mobiles.map((m) => `customer_phone.ilike.%${m.slice(-10)}`).join(",")),
    ]);

    return customers.map((c) => {
      const mobileNorm = normalizeMobile(c.mobile);
      const posForCustomer = (posSales ?? []).filter((s) => s.customer_id === c.id);
      const ordersForCustomer = (orders ?? []).filter(
        (o) =>
          o.customer_phone &&
          normalizeMobile(o.customer_phone).slice(-10) === mobileNorm.slice(-10) &&
          o.order_status !== "cancelled"
      );

      const allDates = [
        ...posForCustomer.map((s) => s.created_at),
        ...ordersForCustomer.map((o) => o.created_at),
      ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      const totalOrders = posForCustomer.length + ordersForCustomer.length;
      const totalAmount =
        posForCustomer.reduce((sum, s) => sum + Number(s.total_amount), 0) +
        ordersForCustomer.reduce((sum, o) => sum + Number(o.total_amount), 0);

      return {
        ...c,
        total_orders: totalOrders,
        total_purchase_amount: Math.round(totalAmount * 100) / 100,
        last_order_date: allDates[0] ?? null,
      };
    });
  },

  async getByMobile(mobile: string): Promise<Customer | null> {
    const normalized = normalizeMobile(mobile);
    if (normalized.length < 10) return null;

    const supabase = requireClient();
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

  async resolveForPos(opts: {
    customerId?: string;
    mobile?: string;
    name?: string;
  }): Promise<Customer | null> {
    if (opts.customerId) {
      const supabase = requireClient();
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

  /** Auto-create CRM record from registered user */
  async syncFromUser(user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  }): Promise<Customer | null> {
    const mobile = user.phone?.trim();
    if (!mobile || !isValidMobile(mobile)) return null;

    return this.upsert({
      user_id: user.id,
      name: user.name?.trim() || "Customer",
      mobile: normalizeMobile(mobile),
      email: user.email?.trim() || null,
      address: user.address ?? null,
    });
  },

  /** Auto-create CRM record when placing online order */
  async ensureFromOrder(params: {
    userId?: string | null;
    name: string;
    mobile: string;
    email?: string | null;
    address?: string | null;
  }): Promise<Customer | null> {
    if (!params.mobile?.trim() || !isValidMobile(params.mobile)) return null;

    const existing = await this.getByMobile(params.mobile);
    if (existing) {
      return this.upsert({
        ...existing,
        name: params.name.trim() || existing.name,
        email: params.email ?? existing.email,
        address: params.address ?? existing.address,
        user_id: params.userId ?? existing.user_id,
      });
    }

    return this.upsert({
      user_id: params.userId ?? null,
      name: params.name.trim() || "Customer",
      mobile: normalizeMobile(params.mobile),
      email: params.email ?? null,
      address: params.address ?? null,
    });
  },

  async updateById(
    id: string,
    updates: Partial<
      Pick<
        Customer,
        | "name"
        | "mobile"
        | "email"
        | "address"
        | "gst_number"
        | "credit_limit"
        | "account_status"
        | "notes"
      >
    >
  ): Promise<Customer> {
    const supabase = requireClient();
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name != null) payload.name = updates.name.trim();
    if (updates.mobile != null) payload.mobile = normalizeMobile(updates.mobile);
    if (updates.email !== undefined) payload.email = updates.email?.trim() || null;
    if (updates.address !== undefined) payload.address = updates.address?.trim() || null;
    if (updates.gst_number !== undefined) {
      payload.gst_number = updates.gst_number?.trim() || null;
    }
    if (updates.credit_limit !== undefined) payload.credit_limit = updates.credit_limit;
    if (updates.account_status !== undefined) payload.account_status = updates.account_status;
    if (updates.notes !== undefined) payload.notes = updates.notes?.trim() || null;

    const { data, error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new Error("Another party already uses this mobile number.");
      }
      throw error;
    }
    return data as Customer;
  },

  async createParty(params: {
    name: string;
    mobile: string;
    email?: string | null;
    address?: string | null;
    gst_number?: string | null;
    credit_limit?: number;
    notes?: string | null;
  }): Promise<Customer> {
    return this.upsert({
      name: params.name,
      mobile: params.mobile,
      email: params.email ?? null,
      address: params.address ?? null,
      gst_number: params.gst_number ?? null,
      credit_limit: params.credit_limit ?? 0,
      notes: params.notes ?? null,
    });
  },

  async upsert(
    customer: Partial<Customer> & { name: string; mobile: string }
  ): Promise<Customer> {
    const supabase = requireClient();
    const mobile = normalizeMobile(customer.mobile);
    const existing = await this.getByMobile(mobile);
    const payload = { ...customer, mobile, updated_at: new Date().toISOString() };

    if (existing) {
      const { data, error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data as Customer;
    }
    const { data, error } = await supabase
      .from("customers")
      .insert({ ...payload, mobile })
      .select()
      .single();
    if (error) throw error;
    return data as Customer;
  },

  async getPurchaseHistory(customerId: string) {
    const supabase = requireClient();
    const { data: pos } = await supabase
      .from("pos_sales")
      .select("*, pos_sale_items(*)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    return { posSales: pos ?? [] };
  },
};

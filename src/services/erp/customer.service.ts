import { requireClient } from "@/lib/supabase/client";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Customer, CustomerWithStats, PosSale } from "@/types/erp";
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

  /** Auto-sync any registered online customers who do not yet have a customers record */
  async syncAllOnlineUsers(): Promise<void> {
    try {
      const supabase = requireClient();
      const { data: users } = await supabase
        .from("users")
        .select("id, name, email, phone, role")
        .eq("role", "customer");

      if (!users || users.length === 0) return;

      for (const u of users) {
        if (!u.phone || !isValidMobile(u.phone)) continue;
        const norm = normalizeMobile(u.phone);
        const { data: existing } = await supabase
          .from("customers")
          .select("id, user_id")
          .or(`mobile.eq.${norm},mobile.ilike.%${norm.slice(-10)}`)
          .maybeSingle();

        if (!existing) {
          await supabase.from("customers").insert({
            user_id: u.id,
            name: u.name?.trim() || "Customer",
            mobile: norm,
            email: u.email?.trim() || null,
            loyalty_points: 0,
            credit_balance: 0,
            updated_at: new Date().toISOString(),
          });
        } else if (!existing.user_id) {
          await supabase
            .from("customers")
            .update({ user_id: u.id, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        }
      }
    } catch (err) {
      console.warn("[CustomerService] syncAllOnlineUsers warning:", err);
    }
  },

  async listWithStats(search?: string): Promise<CustomerWithStats[]> {
    // Sync online accounts in background on first load
    void this.syncAllOnlineUsers();

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
    const last10 = normalized.slice(-10);

    const supabase = requireClient();

    // 1. Search in customers table
    const { data: customerRow } = await supabase
      .from("customers")
      .select("*")
      .or(`mobile.eq.${normalized},mobile.ilike.%${last10}`)
      .maybeSingle();

    let customer = (customerRow as Customer) ?? null;

    // 2. Also check public.users table to see if an online account exists
    let onlineUser: { id: string; name?: string | null; email?: string | null; phone?: string | null } | null = null;
    try {
      const { data: userRow } = await supabase
        .from("users")
        .select("id, name, email, phone")
        .or(`phone.eq.${normalized},phone.ilike.%${last10}`)
        .maybeSingle();
      if (userRow) {
        onlineUser = userRow;
      }
    } catch {}

    // 3. If an online user exists, ensure customers row is linked as the SAME account!
    if (onlineUser) {
      if (customer) {
        if (!customer.user_id) {
          try {
            const { data: updated } = await supabase
              .from("customers")
              .update({
                user_id: onlineUser.id,
                email: customer.email || onlineUser.email || null,
                name: customer.name === "Customer" && onlineUser.name ? onlineUser.name : customer.name,
                updated_at: new Date().toISOString(),
              })
              .eq("id", customer.id)
              .select()
              .single();
            if (updated) customer = updated as Customer;
          } catch {}
        }
      } else {
        // No customer record existed yet for this online user: auto-create unified CRM entry
        try {
          const { data: created } = await supabase
            .from("customers")
            .insert({
              user_id: onlineUser.id,
              name: onlineUser.name?.trim() || "Customer",
              mobile: normalized,
              email: onlineUser.email?.trim() || null,
              loyalty_points: 0,
              credit_balance: 0,
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();
          if (created) customer = created as Customer;
        } catch {}
      }
    }

    return customer;
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

    // If not found in customers by name, check online users table
    const supabase = requireClient();
    try {
      const { data: userMatch } = await supabase
        .from("users")
        .select("id, name, email, phone")
        .or(`name.ilike.%${name}%,email.ilike.%${name}%`)
        .limit(1)
        .maybeSingle();
      if (userMatch?.phone) {
        return this.getByMobile(userMatch.phone);
      }
    } catch {}

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

    // getByMobile automatically links user_id if online account exists!
    const existing = await this.getByMobile(mobile);
    if (existing) {
      if (opts.name?.trim() && existing.name !== opts.name.trim() && existing.name === "Customer") {
        return this.upsert({
          ...existing,
          mobile,
          name: opts.name.trim(),
        });
      }
      return existing;
    }

    // Double check users table before creating unlinked customer
    const supabase = requireClient();
    let userId: string | null = null;
    let email: string | null = null;
    try {
      const { data: u } = await supabase
        .from("users")
        .select("id, name, email, phone")
        .or(`phone.eq.${mobile},phone.ilike.%${mobile.slice(-10)}`)
        .maybeSingle();
      if (u) {
        userId = u.id;
        email = u.email ?? null;
      }
    } catch {}

    const name = opts.name?.trim() || "Customer";
    return this.upsert({ mobile, name, user_id: userId, email });
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

  /** Create an online store login account for a walk-in customer and link them */
  async createOnlineAccountForCustomer(
    customerId: string,
    email: string,
    password?: string
  ): Promise<Customer> {
    const supabase = requireClient();
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();
    if (custErr || !customer) {
      throw new Error("Customer not found");
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("A valid email address is required to create an online account");
    }

    const cleanPassword = password?.trim() || "Store" + customer.mobile.slice(-4) + "!";
    if (cleanPassword.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    // Create user in Supabase Auth using a non-persisting client so the admin is not logged out
    const { url, anonKey } = getSupabaseEnv();
    const tempClient = createSupabaseJsClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data: authData, error: authError } = await tempClient.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: {
        data: {
          name: customer.name,
          phone: customer.mobile,
        },
      },
    });

    if (authError) {
      throw new Error(authError.message);
    }

    const newUserId = authData.user?.id;
    if (!newUserId) {
      throw new Error("Could not initialize online user account");
    }

    // Ensure public.users profile exists with customer role
    await supabase.from("users").upsert({
      id: newUserId,
      email: cleanEmail,
      name: customer.name,
      phone: customer.mobile,
      role: "customer",
    }, { onConflict: "id" });

    // Link customer.user_id = newUserId and save email
    const { data: updatedCustomer, error: updateErr } = await supabase
      .from("customers")
      .update({
        user_id: newUserId,
        email: cleanEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId)
      .select()
      .single();

    if (updateErr) throw updateErr;
    return updatedCustomer as Customer;
  },

  /** Get all in-store POS receipts for a logged-in user */
  async getPosSalesForUser(userId: string): Promise<PosSale[]> {
    const supabase = requireClient();
    let { data: customer } = await supabase
      .from("customers")
      .select("id, mobile")
      .eq("user_id", userId)
      .maybeSingle();

    // If not linked by user_id yet, check user's registered phone
    if (!customer) {
      const { data: u } = await supabase
        .from("users")
        .select("phone")
        .eq("id", userId)
        .maybeSingle();

      if (u?.phone) {
        const cleanMobile = normalizeMobile(u.phone);
        const { data: matchedCust } = await supabase
          .from("customers")
          .select("id, mobile")
          .or(`mobile.eq.${cleanMobile},mobile.ilike.%${cleanMobile.slice(-10)}`)
          .maybeSingle();

        if (matchedCust) {
          customer = matchedCust;
          // Auto-link to customer record
          await supabase
            .from("customers")
            .update({ user_id: userId, updated_at: new Date().toISOString() })
            .eq("id", matchedCust.id);
        }
      }
    }

    if (!customer?.id) return [];

    const query = supabase
      .from("pos_sales")
      .select("*, pos_sale_items(*)")
      .eq("sale_status", "completed")
      .order("created_at", { ascending: false });

    const { data: sales, error } = customer.mobile
      ? await query.or(`customer_id.eq.${customer.id},customer_mobile.eq.${customer.mobile}`)
      : await query.eq("customer_id", customer.id);

    if (error) {
      console.warn("[CustomerService] getPosSalesForUser error:", error);
      return [];
    }
    return (sales ?? []) as PosSale[];
  },
};

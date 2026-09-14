import { requireClient } from "@/lib/supabase/client";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { customerService } from "@/services/erp/customer.service";
import { normalizeMobile } from "@/utils/phone";
import type { User, UserRole } from "@/types/database";

function roleUpdateError(message: string, code?: string) {
  if (
    message.includes("policy") ||
    message.includes("row-level") ||
    message.includes("permission") ||
    code === "42501" ||
    code === "PGRST202"
  ) {
    return new Error(
      "Could not update role. Open Supabase → SQL Editor and run supabase/migrations/021_admin_user_crud.sql, then try again."
    );
  }
  return new Error(message);
}

export const adminService = {
  async getDashboardStats() {
    const supabase = requireClient();

    const [products, orders, users, paidOrders] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase
        .from("orders")
        .select("total_amount")
        .eq("payment_status", "paid"),
    ]);

    const revenue =
      paidOrders.data?.reduce((sum, o) => sum + Number(o.total_amount), 0) ?? 0;

    const lowStock = await supabase
      .from("products")
      .select("id, name, stock")
      .lte("stock", 10)
      .order("stock")
      .limit(5);

    return {
      productCount: products.count ?? 0,
      orderCount: orders.count ?? 0,
      userCount: users.count ?? 0,
      revenue,
      lowStock: lowStock.data ?? [],
    };
  },

  async getUsers(): Promise<User[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as User[];
  },

  async updateUserRole(userId: string, role: UserRole) {
    const supabase = requireClient();
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "admin_set_user_role",
      { target_id: userId, new_role: role }
    );

    if (!rpcError && rpcData) {
      return (Array.isArray(rpcData) ? rpcData[0] : rpcData) as User;
    }

    const { data, error } = await supabase
      .from("users")
      .update({ role })
      .eq("id", userId)
      .select()
      .single();

    if (!error && data) return data as User;

    throw roleUpdateError(
      rpcError?.message || error?.message || "Could not update role.",
      rpcError?.code || error?.code
    );
  },

  /** Super admin: Create a new user account with role & password */
  async createUser(params: {
    name: string;
    email: string;
    phone?: string;
    role: UserRole;
    password?: string;
  }): Promise<User> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.name.trim();
    const cleanPhone = params.phone?.trim() ? normalizeMobile(params.phone) : null;
    const password = params.password?.trim() || "Store123456!";

    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("Valid email is required");
    }
    if (!cleanName) {
      throw new Error("Name is required");
    }
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

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
      password,
      options: {
        data: {
          name: cleanName,
          phone: cleanPhone,
        },
      },
    });

    if (authError) {
      throw new Error(authError.message);
    }

    const newUserId = authData.user?.id;
    if (!newUserId) {
      throw new Error("Could not initialize user account");
    }

    const supabase = requireClient();

    // Upsert profile in public.users
    const { data: profile, error: profileErr } = await supabase
      .from("users")
      .upsert(
        {
          id: newUserId,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          role: params.role,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (profileErr) {
      console.warn("User profile upsert warning:", profileErr.message);
    }

    // Apply role if non-customer
    if (params.role !== "customer") {
      try {
        await this.updateUserRole(newUserId, params.role);
      } catch (err) {
        console.warn("Could not apply role via RPC, direct upsert applied:", err);
      }
    } else if (cleanPhone) {
      try {
        await customerService.syncFromUser({
          id: newUserId,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
        });
      } catch {}
    }

    return (profile ?? {
      id: newUserId,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      role: params.role,
      created_at: new Date().toISOString(),
    }) as User;
  },

  /** Super admin: Update user details (name, phone, email, role) */
  async updateUserDetails(
    userId: string,
    updates: {
      name: string;
      phone?: string | null;
      email?: string;
      role?: UserRole;
    }
  ): Promise<User> {
    const supabase = requireClient();
    const cleanName = updates.name.trim();
    const cleanPhone = updates.phone?.trim() ? normalizeMobile(updates.phone) : null;
    const cleanEmail = updates.email?.trim() ? updates.email.trim().toLowerCase() : null;

    // Try RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "admin_update_user_details",
      {
        target_id: userId,
        p_name: cleanName,
        p_phone: cleanPhone,
        p_email: cleanEmail,
        p_role: updates.role ?? null,
      }
    );

    if (!rpcError && rpcData) {
      return (Array.isArray(rpcData) ? rpcData[0] : rpcData) as User;
    }

    // Fallback direct update
    const updatePayload: Record<string, unknown> = {
      name: cleanName,
      phone: cleanPhone,
    };
    if (cleanEmail) updatePayload.email = cleanEmail;
    if (updates.role) updatePayload.role = updates.role;

    const { data, error } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;

    // Sync customer table if linked
    if (cleanPhone) {
      await supabase
        .from("customers")
        .update({
          name: cleanName,
          mobile: cleanPhone,
          email: cleanEmail,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }

    return data as User;
  },

  /** Super admin: Delete a user account */
  async deleteUser(userId: string): Promise<void> {
    const supabase = requireClient();

    // Try RPC delete
    const { error: rpcErr } = await supabase.rpc("admin_delete_user", {
      target_id: userId,
    });

    if (!rpcErr) return;

    // Fallback direct delete
    await supabase.from("customers").update({ user_id: null }).eq("user_id", userId);

    const { error: deleteErr } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (deleteErr) {
      throw new Error(
        rpcErr?.message || deleteErr.message || "Failed to delete user account."
      );
    }
  },
};

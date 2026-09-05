import { requireClient } from "@/lib/supabase/client";
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
      "Could not update role. Open Supabase → SQL Editor and run supabase/migrations/016_admin_role_updates.sql, then try again."
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
};

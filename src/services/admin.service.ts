import { createClient } from "@/lib/supabase/client";
import type { User, UserRole } from "@/types/database";

export const adminService = {
  async getDashboardStats() {
    const supabase = createClient();

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
    const supabase = createClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as User[];
  },

  async updateUserRole(userId: string, role: UserRole) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("users")
      .update({ role })
      .eq("id", userId)
      .select()
      .single();
    if (error) throw error;
    return data as User;
  },
};

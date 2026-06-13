import { requireClient } from "@/lib/supabase/client";
import { posService } from "./pos.service";
import { orderService } from "@/services/order.service";
import { inventoryService } from "./inventory.service";
import { erpReportsService } from "./reports.service";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dayKey(d));
  }
  return days;
}

export const analyticsService = {
  async getDashboardMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const monthEnd = new Date().toISOString();

    const [
      orderStats,
      posToday,
      posMonth,
      inventoryValue,
      todayPl,
      monthPl,
      posSalesToday,
    ] = await Promise.all([
      orderService.getDashboardStats(),
      posService.getTodayStats(),
      posService.list({ dateFrom: monthStart }),
      inventoryService.getInventoryValue(),
      erpReportsService.dailyProfit(dayKey(today)),
      erpReportsService.profitLoss(monthStart, monthEnd),
      posService.list({ dateFrom: todayIso }),
    ]);

    const cashCollection = posSalesToday
      .filter((s) => s.sale_status === "completed" && s.payment_method === "cash")
      .reduce((sum, s) => sum + Number(s.total_amount), 0);
    const upiCollection = posSalesToday
      .filter((s) => s.sale_status === "completed" && s.payment_method === "upi")
      .reduce((sum, s) => sum + Number(s.total_amount), 0);

    return {
      todayOnlineSales: orderStats.todaySales,
      todayPosSales: posToday.total,
      totalOrders: orderStats.totalOrders,
      pendingOrders: orderStats.pendingOrders,
      deliveredOrders: orderStats.deliveredOrders,
      cashCollection,
      upiCollection,
      inventoryValue,
      todayProfit: todayPl.netProfit,
      monthlyProfit: monthPl.netProfit,
      monthlyRevenue: orderStats.monthlySales + posMonth
        .filter((s) => s.sale_status === "completed")
        .reduce((sum, s) => sum + Number(s.total_amount), 0),
    };
  },

  async salesTrend(days: number) {
    const supabase = requireClient();
    const from = new Date();
    from.setDate(from.getDate() - days + 1);
    from.setHours(0, 0, 0, 0);

    const [posRes, ordersRes] = await Promise.all([
      supabase
        .from("pos_sales")
        .select("total_amount, created_at, sale_status")
        .gte("created_at", from.toISOString())
        .eq("sale_status", "completed"),
      supabase
        .from("orders")
        .select("total_amount, created_at, order_status")
        .gte("created_at", from.toISOString())
        .neq("order_status", "cancelled"),
    ]);

    const dayLabels = lastNDays(days);
    const map = new Map(dayLabels.map((d) => [d, 0]));

    for (const row of posRes.data ?? []) {
      const k = dayKey(new Date(row.created_at));
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + Number(row.total_amount));
    }
    for (const row of ordersRes.data ?? []) {
      const k = dayKey(new Date(row.created_at));
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + Number(row.total_amount));
    }

    return dayLabels.map((label) => ({ label: label.slice(5), value: map.get(label) ?? 0 }));
  },

  async monthlyRevenueTrend(months = 6) {
    const supabase = requireClient();
    const from = new Date();
    from.setMonth(from.getMonth() - months + 1);
    from.setDate(1);

    const [posRes, ordersRes] = await Promise.all([
      supabase
        .from("pos_sales")
        .select("total_amount, created_at, sale_status")
        .gte("created_at", from.toISOString())
        .eq("sale_status", "completed"),
      supabase
        .from("orders")
        .select("total_amount, created_at, order_status")
        .gte("created_at", from.toISOString())
        .neq("order_status", "cancelled"),
    ]);

    const map = new Map<string, number>();
    for (let i = 0; i < months; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (months - 1 - i));
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(k, 0);
    }

    for (const row of posRes.data ?? []) {
      const d = new Date(row.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + Number(row.total_amount));
    }
    for (const row of ordersRes.data ?? []) {
      const d = new Date(row.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + Number(row.total_amount));
    }

    return [...map.entries()].map(([label, value]) => ({
      label: label.slice(5),
      value,
    }));
  },

  async monthlyProfitTrend(months = 6) {
    const results = [];
    for (let i = months - 1; i >= 0; i--) {
      const start = new Date();
      start.setMonth(start.getMonth() - i);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
      const pl = await erpReportsService.profitLoss(start.toISOString(), end.toISOString());
      results.push({
        label: `${String(start.getMonth() + 1).padStart(2, "0")}/${String(start.getFullYear()).slice(2)}`,
        value: pl.netProfit,
      });
    }
    return results;
  },

  async topProducts(limit = 8) {
    return erpReportsService.topProducts(limit);
  },

  async categorySales() {
    const supabase = requireClient();
    const { data } = await supabase
      .from("pos_sale_items")
      .select("quantity, rate, products(category_id, categories(name))")
      .limit(1000);

    const map = new Map<string, number>();
    for (const row of data ?? []) {
      const cat = (row.products as { categories?: { name?: string } | null } | null)?.categories?.name ?? "Uncategorized";
      map.set(cat, (map.get(cat) ?? 0) + row.quantity * Number(row.rate));
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  },
};

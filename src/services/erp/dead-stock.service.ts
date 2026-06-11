import { createClient } from "@/lib/supabase/client";
import { inventoryService } from "./inventory.service";

export interface DeadStockItem {
  productId: string;
  productName: string;
  currentStock: number;
  lastSaleDate: string | null;
  stockValue: number;
  daysSinceSale: number | null;
}

export const deadStockService = {
  async list(daysThreshold: 30 | 60 | 90): Promise<DeadStockItem[]> {
    const supabase = createClient();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysThreshold);

    const [products, posItems, orderItems] = await Promise.all([
      inventoryService.listProducts(),
      supabase
        .from("pos_sale_items")
        .select("product_id, pos_sales(created_at, sale_status)")
        .limit(5000),
      supabase
        .from("order_items")
        .select("product_id, orders(created_at, order_status)")
        .limit(5000),
    ]);

    const lastSale = new Map<string, string>();

    for (const row of posItems.data ?? []) {
      const sale = row.pos_sales as { created_at?: string; sale_status?: string } | null;
      if (sale?.sale_status !== "completed" || !sale.created_at) continue;
      const prev = lastSale.get(row.product_id);
      if (!prev || sale.created_at > prev) lastSale.set(row.product_id, sale.created_at);
    }
    for (const row of orderItems.data ?? []) {
      const order = row.orders as { created_at?: string; order_status?: string } | null;
      if (order?.order_status === "cancelled" || !order?.created_at) continue;
      const prev = lastSale.get(row.product_id);
      if (!prev || order.created_at > prev) lastSale.set(row.product_id, order.created_at);
    }

    const now = Date.now();
    const results: DeadStockItem[] = [];

    for (const p of products) {
      if (p.stock <= 0) continue;
      const last = lastSale.get(p.id) ?? null;
      const daysSince = last
        ? Math.floor((now - new Date(last).getTime()) / 86400000)
        : null;
      const isDead =
        !last || new Date(last) < cutoff;
      if (!isDead) continue;

      results.push({
        productId: p.id,
        productName: p.name,
        currentStock: p.stock,
        lastSaleDate: last,
        stockValue: p.stock * (p.purchase_price ?? p.price * 0.85),
        daysSinceSale: daysSince,
      });
    }

    return results.sort((a, b) => b.stockValue - a.stockValue);
  },
};

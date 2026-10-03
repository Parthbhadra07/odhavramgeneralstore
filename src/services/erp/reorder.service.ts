import { inventoryService } from "./inventory.service";
import { requireClient } from "@/lib/supabase/client";

export interface ReorderSuggestion {
  productId: string;
  productName: string;
  currentStock: number;
  avgDailySales: number;
  reorderLevel: number;
  suggestedPurchase: number;
  daysOfStockLeft: number | null;
  supplierId?: string | null;
  supplierName?: string | null;
}

export interface SalesForecast {
  nextWeekSales: number;
  nextMonthSales: number;
  basedOnDays: number;
}

export const reorderService = {
  async getSuggestions(supplierId?: string): Promise<ReorderSuggestion[]> {
    const products = await inventoryService.listProducts();
    const supabase = requireClient();
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [posItemsRes, suppliersRes] = await Promise.all([
      supabase
        .from("pos_sale_items")
        .select("product_id, quantity, pos_sales!inner(created_at, sale_status)")
        .gte("pos_sales.created_at", since.toISOString())
        .eq("pos_sales.sale_status", "completed"),
      supabase.from("suppliers").select("id, name").order("name"),
    ]);

    const posItems = posItemsRes.data ?? [];
    const suppliers = suppliersRes.data ?? [];
    const supplierMap = new Map<string, string>();
    for (const s of suppliers) {
      supplierMap.set(s.id, s.name);
    }

    // Historical fallback for products without preferred_supplier_id
    const unassignedProductIds = products.filter((p) => !p.preferred_supplier_id).map((p) => p.id);
    const fallbackSupplierByProduct = new Map<string, string>();
    if (unassignedProductIds.length > 0) {
      try {
        const { data: recentPurchases } = await supabase
          .from("purchase_items")
          .select("product_id, purchase_bills!inner(supplier_id)")
          .in("product_id", unassignedProductIds);

        for (const rp of recentPurchases ?? []) {
          const sid = (rp.purchase_bills as unknown as { supplier_id: string })?.supplier_id;
          if (sid && !fallbackSupplierByProduct.has(rp.product_id)) {
            fallbackSupplierByProduct.set(rp.product_id, sid);
          }
        }
      } catch {}
    }

    const sold = new Map<string, number>();
    for (const row of posItems) {
      sold.set(row.product_id, (sold.get(row.product_id) ?? 0) + row.quantity);
    }

    const suggestions: ReorderSuggestion[] = [];
    for (const p of products) {
      const effectiveSupplierId = p.preferred_supplier_id || fallbackSupplierByProduct.get(p.id) || null;
      const supplierName = effectiveSupplierId ? (supplierMap.get(effectiveSupplierId) ?? null) : null;

      // Filter by supplier if requested
      if (supplierId && supplierId !== "all") {
        if (supplierId === "unassigned") {
          if (effectiveSupplierId) continue;
        } else if (effectiveSupplierId !== supplierId) {
          continue;
        }
      }

      const totalSold = sold.get(p.id) ?? 0;
      const avgDaily = totalSold / 30;
      const reorderLevel = p.reorder_level ?? p.min_stock_level ?? 10;
      const daysLeft = avgDaily > 0 ? Math.floor(p.stock / avgDaily) : null;
      const needsReorder = p.stock <= reorderLevel || (daysLeft !== null && daysLeft <= 7);

      if (!needsReorder && avgDaily <= 0) continue;

      const targetDays = 14;
      const suggested = Math.max(
        0,
        Math.ceil(avgDaily * targetDays) - p.stock + reorderLevel
      );

      if (suggested <= 0 && p.stock > reorderLevel) continue;

      suggestions.push({
        productId: p.id,
        productName: p.name,
        currentStock: p.stock,
        avgDailySales: Math.round(avgDaily * 10) / 10,
        reorderLevel,
        suggestedPurchase: Math.max(suggested, reorderLevel),
        daysOfStockLeft: daysLeft,
        supplierId: effectiveSupplierId,
        supplierName,
      });
    }

    return suggestions.sort((a, b) => (a.daysOfStockLeft ?? 999) - (b.daysOfStockLeft ?? 999));
  },

  async forecast(): Promise<SalesForecast> {
    const supabase = requireClient();
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [posRes, ordersRes] = await Promise.all([
      supabase
        .from("pos_sales")
        .select("total_amount, sale_status, created_at")
        .gte("created_at", since.toISOString())
        .eq("sale_status", "completed"),
      supabase
        .from("orders")
        .select("total_amount, order_status, created_at")
        .gte("created_at", since.toISOString())
        .neq("order_status", "cancelled"),
    ]);

    const total =
      (posRes.data ?? []).reduce((s, r) => s + Number(r.total_amount), 0) +
      (ordersRes.data ?? []).reduce((s, r) => s + Number(r.total_amount), 0);
    const dailyAvg = total / 30;

    return {
      nextWeekSales: Math.round(dailyAvg * 7),
      nextMonthSales: Math.round(dailyAvg * 30),
      basedOnDays: 30,
    };
  },
};

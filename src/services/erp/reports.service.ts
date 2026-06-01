import { createClient } from "@/lib/supabase/client";
import { inventoryService } from "./inventory.service";
import { posService } from "./pos.service";
import { expenseService } from "./expense.service";
import { orderService } from "@/services/order.service";

export const erpReportsService = {
  async salesSummary(period: "day" | "week" | "month" | "year" = "month") {
    const now = new Date();
    const from = new Date(now);
    if (period === "day") from.setHours(0, 0, 0, 0);
    else if (period === "week") from.setDate(from.getDate() - 7);
    else if (period === "month") from.setMonth(from.getMonth() - 1);
    else from.setFullYear(from.getFullYear() - 1);

    const [posSales, orders] = await Promise.all([
      posService.list({ dateFrom: from.toISOString() }),
      orderService.getSalesReport(),
    ]);

    const posTotal = posSales
      .filter((s) => s.sale_status === "completed")
      .reduce((sum, s) => sum + Number(s.total_amount), 0);

    const onlineTotal = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);

    return {
      posSales: posTotal,
      onlineSales: onlineTotal,
      total: posTotal + onlineTotal,
      orderCount: orders.length,
      posCount: posSales.filter((s) => s.sale_status === "completed").length,
    };
  },

  async profitLoss(from: string, to: string) {
    const [sales, expenses, inventoryValue] = await Promise.all([
      this.salesSummary("month"),
      expenseService.list({ from, to }),
      inventoryService.getInventoryValue(),
    ]);
    const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
    return {
      revenue: sales.total,
      expenses: expenseTotal,
      profit: sales.total - expenseTotal,
      inventoryValue,
    };
  },

  async gstSalesReport(from: string, to: string) {
    const supabase = createClient();
    const { data: pos } = await supabase
      .from("pos_sales")
      .select("subtotal, cgst, sgst, igst, total_amount, created_at")
      .gte("created_at", from)
      .lte("created_at", to)
      .eq("sale_status", "completed");

    const rows = pos ?? [];
    return {
      taxableAmount: rows.reduce((s, r) => s + Number(r.subtotal), 0),
      cgst: rows.reduce((s, r) => s + Number(r.cgst), 0),
      sgst: rows.reduce((s, r) => s + Number(r.sgst), 0),
      igst: rows.reduce((s, r) => s + Number(r.igst), 0),
      total: rows.reduce((s, r) => s + Number(r.total_amount), 0),
    };
  },

  async gstPurchaseReport(from: string, to: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("purchase_bills")
      .select("subtotal, cgst, sgst, igst, total_amount")
      .gte("invoice_date", from.slice(0, 10))
      .lte("invoice_date", to.slice(0, 10));
    const rows = data ?? [];
    return {
      taxableAmount: rows.reduce((s, r) => s + Number(r.subtotal), 0),
      cgst: rows.reduce((s, r) => s + Number(r.cgst), 0),
      sgst: rows.reduce((s, r) => s + Number(r.sgst), 0),
      igst: rows.reduce((s, r) => s + Number(r.igst), 0),
      total: rows.reduce((s, r) => s + Number(r.total_amount), 0),
    };
  },

  async stockSummary() {
    const products = await inventoryService.listProducts();
    return {
      totalProducts: products.length,
      totalUnits: products.reduce((s, p) => s + p.stock, 0),
      inventoryValue: await inventoryService.getInventoryValue(),
      lowStockCount: (await inventoryService.getLowStock()).length,
    };
  },

  async topProducts(limit = 10) {
    const supabase = createClient();
    const { data } = await supabase
      .from("pos_sale_items")
      .select("product_id, product_name, quantity")
      .limit(500);
    const map = new Map<string, { name: string; qty: number }>();
    for (const row of data ?? []) {
      const cur = map.get(row.product_id) ?? { name: row.product_name, qty: 0 };
      cur.qty += row.quantity;
      map.set(row.product_id, cur);
    }
    return [...map.entries()]
      .map(([id, v]) => ({ productId: id, name: v.name, quantity: v.qty }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  },

  exportCsv(rows: Record<string, unknown>[], filename: string) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};

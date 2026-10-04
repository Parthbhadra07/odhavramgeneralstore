import { requireClient } from "@/lib/supabase/client";
import { inventoryService } from "./inventory.service";
import { posService } from "./pos.service";
import { expenseService } from "./expense.service";
import { orderService } from "@/services/order.service";
import type { ProfitReport } from "@/types/erp";

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

    const onlineTotal = orders
      .filter((o) => new Date(o.created_at) >= from)
      .reduce((sum, o) => sum + Number(o.total_amount), 0);

    return {
      posSales: posTotal,
      onlineSales: onlineTotal,
      total: posTotal + onlineTotal,
      orderCount: orders.length,
      posCount: posSales.filter((s) => s.sale_status === "completed").length,
    };
  },

  async salesInRange(from: string, to: string) {
    const supabase = requireClient();
    const [posRes, ordersRes] = await Promise.all([
      supabase
        .from("pos_sales")
        .select("total_amount, discount, loyalty_discount, sale_status")
        .gte("created_at", from)
        .lte("created_at", to)
        .eq("sale_status", "completed"),
      supabase
        .from("orders")
        .select("total_amount, delivery_charge, order_items(price, quantity)")
        .gte("created_at", from)
        .lte("created_at", to)
        .neq("order_status", "cancelled"),
    ]);

    const posRows = posRes.data ?? [];
    const orderRows = ordersRes.data ?? [];

    const posRevenue = posRows.reduce((s, r) => s + Number(r.total_amount), 0);
    const onlineGrossTotal = orderRows.reduce((s, r) => s + Number(r.total_amount), 0);
    const discounts = posRows.reduce(
      (s, r) => s + Number(r.discount) + Number(r.loyalty_discount ?? 0),
      0
    );

    let deliveryCharges = 0;
    for (const r of orderRows) {
      const tot = Number(r.total_amount || 0);
      let del = r.delivery_charge != null && !Number.isNaN(Number(r.delivery_charge))
        ? Number(r.delivery_charge)
        : null;
      if (del == null && Array.isArray((r as any).order_items) && (r as any).order_items.length > 0) {
        const sub = (r as any).order_items.reduce(
          (s: number, i: any) => s + Number(i.price || 0) * Number(i.quantity || 1),
          0
        );
        del = Math.max(0, tot - sub);
      }
      deliveryCharges += (del ?? 0);
    }

    // Pure merchandise sales (Gross Merchandise Value without delivery charges)
    const onlineProductRevenue = Math.max(0, onlineGrossTotal - deliveryCharges);

    // Delivery fuel & transit expense (vehicle fuel & delivery run overhead ~65% of delivery fee)
    const deliveryFuelExpense = Math.round(deliveryCharges * 0.65 * 100) / 100;
    const netDeliveryProfit = Math.round((deliveryCharges - deliveryFuelExpense) * 100) / 100;

    return {
      revenue: posRevenue + onlineProductRevenue,
      posRevenue,
      onlineRevenue: onlineGrossTotal,
      onlineProductRevenue,
      discounts,
      deliveryCharges,
      deliveryFuelExpense,
      netDeliveryProfit,
    };
  },

  async profitLoss(from: string, to: string): Promise<ProfitReport> {
    const supabase = requireClient();
    const [
      sales,
      expenses,
      inventoryValue,
      purchaseReturnRes,
      salesReturnRes,
      posItemsRes,
      purchaseBillsRes,
    ] = await Promise.all([
      this.salesInRange(from, to),
      expenseService.list({ from, to }),
      inventoryService.getInventoryValue(),
      supabase
        .from("purchase_returns")
        .select("total_amount")
        .gte("return_date", from.slice(0, 10))
        .lte("return_date", to.slice(0, 10)),
      supabase
        .from("sales_returns")
        .select("total_amount")
        .gte("return_date", from.slice(0, 10))
        .lte("return_date", to.slice(0, 10)),
      supabase
        .from("pos_sale_items")
        .select("quantity, rate, product_id, pos_sales!inner(created_at, sale_status), products(purchase_price)")
        .gte("pos_sales.created_at", from)
        .lte("pos_sales.created_at", to)
        .eq("pos_sales.sale_status", "completed"),
      supabase
        .from("purchase_bills")
        .select("total_amount")
        .gte("invoice_date", from.slice(0, 10))
        .lte("invoice_date", to.slice(0, 10)),
    ]);

    const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const purchaseReturns = (purchaseReturnRes.data ?? []).reduce(
      (s, r) => s + Number(r.total_amount),
      0
    );
    const salesReturns = (salesReturnRes.data ?? []).reduce(
      (s, r) => s + Number(r.total_amount),
      0
    );
    const totalPurchases = (purchaseBillsRes.data ?? []).reduce(
      (s, r) => s + Number(r.total_amount),
      0
    );

    // Group expenses by category
    const expenseCatMap: Record<string, number> = {};
    for (const exp of expenses) {
      const cat = exp.category?.trim() || "General Expenses";
      expenseCatMap[cat] = (expenseCatMap[cat] || 0) + Number(exp.amount);
    }
    const expensesBreakdown = Object.entries(expenseCatMap).map(([category, amount]) => ({
      category,
      amount,
    }));

    // Cost of Goods Sold from line items
    let cogs = 0;
    for (const item of posItemsRes.data ?? []) {
      const pp =
        (item.products as { purchase_price?: number } | null)?.purchase_price ?? 0;
      cogs += item.quantity * Number(pp);
    }

    // Standard Double-Entry Accounting Equations
    // 1. Trading Account (Goods Sold):
    const grossRevenue = sales.revenue; // posRevenue + onlineProductRevenue (does not double-count delivery fee)
    const netSales = Math.max(0, grossRevenue - salesReturns);
    const netPurchases = Math.max(0, totalPurchases - purchaseReturns);
    const grossProfit = Math.round((netSales - cogs) * 100) / 100;
    const grossProfitMargin = netSales > 0 ? Math.round(((netSales - cogs) / netSales) * 1000) / 10 : 0;

    // 2. Profit & Loss Account (Operating Incomes and Expenses):
    // Operating Incomes: Delivery fees collected + Purchase return credits
    const totalOtherIncome = sales.deliveryCharges + purchaseReturns;

    // Operating Expenses: Cash expenses + Customer discounts + Delivery Fuel & Transit Expense
    const totalOperatingExpenses = expenseTotal + sales.discounts + sales.deliveryFuelExpense;

    // Net Profit: Gross Profit + Other Operating Income - Operating Expenses
    const netProfit = Math.round((grossProfit + totalOtherIncome - totalOperatingExpenses) * 100) / 100;
    const netProfitMargin = netSales > 0 ? Math.round((netProfit / netSales) * 1000) / 10 : 0;

    return {
      revenue: grossRevenue,
      posRevenue: sales.posRevenue,
      onlineRevenue: sales.onlineRevenue,
      onlineProductSales: sales.onlineProductRevenue,
      cogs: Math.round(cogs * 100) / 100,
      grossProfit,
      grossProfitMargin,
      purchaseReturns,
      salesReturns,
      netSales,
      purchases: totalPurchases,
      netPurchases,
      expenses: expenseTotal,
      expensesBreakdown,
      discounts: sales.discounts,
      deliveryCharges: sales.deliveryCharges,
      deliveryFuelExpense: sales.deliveryFuelExpense,
      netDeliveryProfit: sales.netDeliveryProfit,
      netProfit,
      netProfitMargin,
      inventoryValue,
      closingStock: inventoryValue,
    };
  },

  async dailyProfit(date: string) {
    const from = `${date}T00:00:00.000Z`;
    const to = `${date}T23:59:59.999Z`;
    return this.profitLoss(from, to);
  },

  async purchaseReturnReport(from: string, to: string) {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("purchase_returns")
      .select("*, suppliers(name), purchase_return_items(*)")
      .gte("return_date", from.slice(0, 10))
      .lte("return_date", to.slice(0, 10))
      .order("return_date", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    return {
      count: rows.length,
      totalValue: rows.reduce((s, r) => s + Number(r.total_amount), 0),
      returns: rows,
    };
  },

  async salesReturnReport(from: string, to: string) {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("sales_returns")
      .select("*, customers(name), sales_return_items(*)")
      .gte("return_date", from.slice(0, 10))
      .lte("return_date", to.slice(0, 10))
      .order("return_date", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    return {
      count: rows.length,
      totalValue: rows.reduce((s, r) => s + Number(r.total_amount), 0),
      returns: rows,
    };
  },

  async gstSalesReport(from: string, to: string) {
    const supabase = requireClient();
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
    const supabase = requireClient();
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
    const supabase = requireClient();
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

import { requireClient } from "@/lib/supabase/client";
import { LOYALTY_POINTS_PER_100 } from "@/lib/erp/constants";
import type {
  PosCartLine,
  PosSale,
  PosSaleFilters,
  PosSalesHistoryStats,
  PosSaleStatus,
} from "@/types/erp";
import type { PosPaymentMethod } from "@/lib/erp/constants";
import { lineItemInclusiveGst } from "@/utils/gst";
import { loyaltyService } from "./loyalty.service";
import { creditService } from "./credit.service";
import { customerService } from "./customer.service";
import { lotService } from "./lot.service";
import { settingsService } from "./settings.service";
import { syncManager } from "@/lib/offline/sync-manager";
import { idbDeleteOfflineSale, idbClearAllOfflineSales } from "@/lib/offline/indexed-db";
import { getActiveFinancialYearCode } from "@/utils/financial-year";

function clientBillNumber(fyCode?: string): string {
  const code = fyCode || getActiveFinancialYearCode();
  return `POS/${code}/${Date.now().toString().slice(-6)}`;
}

function computeCartTotals(lines: PosCartLine[], discount = 0, loyaltyDiscount = 0) {
  let subtotal = 0;
  let cgst = 0;
  let sgst = 0;
  let totalItemDiscounts = 0;

  const items = lines.map((line) => {
    const baseRate = Number(line.rate);
    const discPercent = Number(line.discountPercent || 0);
    const unitDiscount =
      line.discountAmount !== undefined
        ? Number(line.discountAmount)
        : Math.round(baseRate * (discPercent / 100) * 100) / 100;

    const effectiveRate = Math.max(0, Math.round((baseRate - unitDiscount) * 100) / 100);
    const grossLineTotal = Math.round(baseRate * line.quantity * 100) / 100;
    const netLineTotal = Math.round(effectiveRate * line.quantity * 100) / 100;
    const lineDiscount = Math.max(0, Math.round((grossLineTotal - netLineTotal) * 100) / 100);

    subtotal += grossLineTotal;
    totalItemDiscounts += lineDiscount;

    const gst = lineItemInclusiveGst(effectiveRate, line.quantity, line.gstPercentage);
    cgst += gst.cgst;
    sgst += gst.sgst;

    const itemName =
      discPercent > 0 ? `${line.name} (${discPercent}% off)` : line.name;

    return {
      product_id: line.productId,
      product_name: itemName,
      barcode: line.barcode,
      lot_id: line.lotId ?? null,
      unit: line.unit ?? "pcs",
      pack_multiplier: line.packMultiplier ?? 1,
      quantity: line.quantity,
      rate: baseRate,
      gst_percentage: line.gstPercentage,
      gst_amount: gst.totalGst,
      total_amount: netLineTotal,
    };
  });

  const totalDiscount = Math.round((totalItemDiscounts + (discount || 0)) * 100) / 100;
  const total = Math.max(
    0,
    Math.round((subtotal - totalDiscount - loyaltyDiscount) * 100) / 100
  );

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    cgst,
    sgst,
    igst: 0,
    discount: totalDiscount,
    itemDiscounts: totalItemDiscounts,
    total,
    items,
  };
}

export const posService = {
  async generateBillNumber(fyCode?: string): Promise<string> {
    const supabase = requireClient();
    const code = fyCode || getActiveFinancialYearCode();
    try {
      const { data, error } = await supabase.rpc("generate_pos_bill_number", {
        p_fy_code: code,
      });
      if (error) {
        const { data: fallbackData, error: fbError } = await supabase.rpc("generate_pos_bill_number");
        if (fbError) return clientBillNumber(code);
        return fallbackData as string;
      }
      return data as string;
    } catch {
      return clientBillNumber(code);
    }
  },

  async createSale(params: {
    lines: PosCartLine[];
    paymentMethod: PosPaymentMethod;
    customerId?: string;
    customerName?: string;
    customerMobile?: string;
    discount?: number;
    loyaltyPointsRedeemed?: number;
    saleStatus?: PosSaleStatus;
    notes?: string;
    splitPayments?: { method: PosPaymentMethod; amount: number }[];
    isSyncUpload?: boolean;
  }): Promise<PosSale> {
    // 1. If currently offline and not an internal sync attempt, queue directly in IndexedDB
    if (typeof navigator !== "undefined" && !navigator.onLine && !params.isSyncUpload) {
      return syncManager.queueOfflineSale(params);
    }

    try {
      const supabase = requireClient();
      const settings = await settingsService.get().catch(() => null);
      const loyaltyEnabled = settings?.enable_loyalty_points !== false;
      const pointValue = Number(settings?.loyalty_point_value ?? 1.0);
      const pointsRedeemed = loyaltyEnabled ? (params.loyaltyPointsRedeemed ?? 0) : 0;
      const loyaltyDiscount = Math.round(pointsRedeemed * pointValue * 100) / 100;

      const customer = await customerService
        .resolveForPos({
          customerId: params.customerId,
          mobile: params.customerMobile,
          name: params.customerName,
        })
        .catch((e) => {
          console.warn("[POS] Customer resolution error:", e);
          return null;
        });
      const customerId = customer?.id ?? params.customerId;

      if (customer && pointsRedeemed > 0) {
        const available = customer.loyalty_points ?? 0;
        if (pointsRedeemed > available) {
          throw new Error(
            `Only ${available} loyalty points available (₹${(available * pointValue).toFixed(2)} discount)`
          );
        }
      }

      if (params.paymentMethod === "credit" && params.saleStatus !== "held") {
        if (!customerId) {
          throw new Error("Customer mobile is required for credit sales");
        }
      }

      const isCreditSale =
        params.paymentMethod === "credit" && params.saleStatus !== "held";

      const {
        subtotal,
        cgst,
        sgst,
        igst,
        total,
        discount: totalDiscount,
        items,
      } = computeCartTotals(
        params.lines,
        params.discount ?? 0,
        loyaltyDiscount
      );

      const billNumber = await this.generateBillNumber();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: sale, error: saleErr } = await supabase
        .from("pos_sales")
        .insert({
          bill_number: billNumber,
          customer_id: customerId ?? null,
          customer_name: customer?.name ?? params.customerName ?? null,
          customer_mobile: customer?.mobile ?? params.customerMobile ?? null,
          subtotal,
          cgst,
          sgst,
          igst,
          discount: totalDiscount,
          loyalty_points_redeemed: pointsRedeemed,
          loyalty_discount: loyaltyDiscount,
          total_amount: total,
          payment_method: params.paymentMethod,
          sale_status: params.saleStatus ?? "completed",
          payment_status: isCreditSale ? "pending" : "paid",
          cashier_id: user?.id ?? null,
          notes: params.notes ?? null,
        })
        .select("*")
        .single();
      if (saleErr) throw saleErr;

      const saleId = (sale as PosSale).id;
      const { error: itemsErr } = await supabase.from("pos_sale_items").insert(
        items.map((i) => ({ ...i, pos_sale_id: saleId }))
      );
      if (itemsErr) throw itemsErr;

      if (params.splitPayments?.length && params.saleStatus !== "held") {
        await supabase.from("pos_payment_splits").insert(
          params.splitPayments.map((sp) => ({
            pos_sale_id: saleId,
            payment_method: sp.method,
            amount: sp.amount,
          }))
        );
      }

      if (params.saleStatus !== "held") {
        for (const line of params.lines) {
          if (line.lotId) {
            const effQty = line.quantity * (line.packMultiplier || 1);
            await lotService.deductStock(
              line.lotId,
              effQty,
              "pos_sale",
              saleId,
              `POS ${billNumber}`
            );
          }
        }
      }

      if (customerId && params.saleStatus !== "held" && loyaltyEnabled) {
        const earnRate = Number(settings?.loyalty_points_per_100 ?? 1.0);
        const points = Math.floor(total / 100) * earnRate;
        if (points > 0) {
          await loyaltyService.earnPoints(customerId, points, "pos_sale", saleId);
        }
        if (pointsRedeemed > 0) {
          await loyaltyService.redeemPoints(
            customerId,
            pointsRedeemed,
            "pos_sale",
            saleId
          );
        }
        if (isCreditSale) {
          await creditService.addCredit(
            customerId,
            total,
            "pos_sale",
            saleId,
            `POS bill ${billNumber}`
          );
        }
      }

      const created = (await this.getById(saleId)) as PosSale;
      if (created) {
        try {
          await supabase.from("notifications").insert({
            type: "pos_sale",
            title: `Bill ${created.bill_number} generated`,
            message: `POS Bill #${created.bill_number} generated for ${created.customer_name || "Walk-in"}. Total: ₹${Number(created.total_amount).toFixed(2)} (${created.payment_method.toUpperCase()})`,
            reference_type: "pos_sale",
            reference_id: created.id,
            is_read: false,
          });
        } catch {}
      }

      return created;
    } catch (err: unknown) {
      // If network failure occurs, seamlessly queue offline sale for background sync
      const isNetworkError =
        !params.isSyncUpload &&
        ((typeof navigator !== "undefined" && !navigator.onLine) ||
          (err instanceof Error &&
            (err.message.includes("Failed to fetch") ||
              err.message.includes("NetworkError") ||
              err.message.toLowerCase().includes("network") ||
              err.name === "AbortError")));

      if (isNetworkError) {
        console.warn("[POS] Network error during sale creation, queuing offline:", err);
        return syncManager.queueOfflineSale(params);
      }
      throw err;
    }
  },

  async holdBill(params: {
    lines: PosCartLine[];
    customerId?: string;
    customerName?: string;
    customerMobile?: string;
    notes?: string;
  }): Promise<PosSale> {
    return this.createSale({
      ...params,
      paymentMethod: "cash",
      saleStatus: "held",
    });
  },

  async resumeBill(saleId: string): Promise<PosSale> {
    const supabase = requireClient();
    const { error } = await supabase
      .from("pos_sales")
      .update({ sale_status: "completed", held_at: null })
      .eq("id", saleId);
    if (error) throw error;
    return this.getById(saleId) as Promise<PosSale>;
  },

  async cancelBill(saleId: string): Promise<void> {
    const supabase = requireClient();
    const sale = await this.getById(saleId);
    if (!sale) throw new Error("Sale not found");

    if (
      sale.payment_method === "credit" &&
      sale.customer_id &&
      sale.sale_status === "completed"
    ) {
      await creditService.reverseCredit(
        sale.customer_id,
        Number(sale.total_amount),
        "pos_sale",
        saleId,
        `Cancelled POS bill ${sale.bill_number}`
      );
    }

    for (const item of sale.pos_sale_items ?? []) {
      const effQty = item.quantity * (Number(item.pack_multiplier) || 1);
      await supabase.rpc("apply_stock_movement", {
        p_product_id: item.product_id,
        p_quantity: effQty,
        p_movement_type: "cancel",
        p_reference_type: "pos_sale",
        p_reference_id: saleId,
        p_notes: "POS bill cancelled",
      });
    }

    await supabase
      .from("pos_sales")
      .update({ sale_status: "cancelled" })
      .eq("id", saleId);
  },

  async deleteSale(
    saleId: string,
    options: { restoreStock?: boolean } = { restoreStock: true }
  ): Promise<void> {
    const supabase = requireClient();

    // 1. Try atomic database RPC first
    try {
      const { data, error } = await supabase.rpc("delete_pos_sale", {
        p_sale_id: saleId,
        p_restore_stock: options.restoreStock ?? true,
      });
      if (!error && (data as { success?: boolean })?.success) {
        try {
          await idbDeleteOfflineSale(saleId);
        } catch {}
        return;
      }
    } catch {
      // Fall through to client-side fallback
    }

    // 2. Client fallback
    const sale = await this.getById(saleId);
    if (!sale) throw new Error("Sale not found");

    // Revert stock if requested and sale was completed
    if ((options.restoreStock ?? true) && sale.sale_status === "completed") {
      for (const item of sale.pos_sale_items ?? []) {
        const effQty = item.quantity * (Number(item.pack_multiplier) || 1);
        await supabase.rpc("apply_stock_movement", {
          p_product_id: item.product_id,
          p_quantity: effQty,
          p_movement_type: "cancel",
          p_reference_type: "pos_sale",
          p_reference_id: saleId,
          p_notes: `POS bill ${sale.bill_number} deleted`,
        });

        if (item.lot_id) {
          try {
            await supabase.rpc("apply_lot_stock_movement", {
              p_lot_id: item.lot_id,
              p_quantity: effQty,
              p_movement_type: "cancel",
              p_reference_type: "pos_sale",
              p_reference_id: saleId,
              p_notes: `POS bill ${sale.bill_number} deleted`,
            });
          } catch {}
        }
      }
    }

    // Remove customer credit linked to this sale
    await supabase
      .from("customer_credit")
      .delete()
      .eq("reference_type", "pos_sale")
      .eq("reference_id", saleId);

    // Remove loyalty linked to this sale
    await supabase
      .from("customer_loyalty")
      .delete()
      .eq("reference_type", "pos_sale")
      .eq("reference_id", saleId);

    // Disconnect returns/refunds
    await supabase
      .from("sales_returns")
      .update({ pos_sale_id: null })
      .eq("pos_sale_id", saleId);
    await supabase
      .from("refunds")
      .update({ pos_sale_id: null })
      .eq("pos_sale_id", saleId);

    // Delete sale items & payment splits
    await supabase.from("pos_sale_items").delete().eq("pos_sale_id", saleId);
    await supabase.from("pos_payment_splits").delete().eq("pos_sale_id", saleId);

    // Delete POS sale
    const { error } = await supabase.from("pos_sales").delete().eq("id", saleId);
    if (error) throw error;

    try {
      await idbDeleteOfflineSale(saleId);
    } catch {}
  },

  async clearAllSalesAndStock(): Promise<void> {
    const supabase = requireClient();

    // 1. Try RPC first
    try {
      const { data, error } = await supabase.rpc("clear_all_sales_and_stock");
      if (!error && (data as { success?: boolean })?.success) {
        try {
          await idbClearAllOfflineSales();
        } catch {}
        return;
      }
    } catch {}

    // 2. Client-side fallback
    await supabase.from("sales_returns").update({ pos_sale_id: null }).not("pos_sale_id", "is", null);
    await supabase.from("refunds").update({ pos_sale_id: null }).not("pos_sale_id", "is", null);

    await supabase.from("sales_return_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("sales_returns").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("refunds").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    await supabase.from("pos_payment_splits").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("pos_sale_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("pos_sales").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    await supabase.from("customer_credit").delete().in("reference_type", ["pos_sale", "sales_return", "order"]);
    await supabase.from("customer_loyalty").delete().in("reference_type", ["pos_sale", "sales_return", "order"]);

    await supabase.from("pos_number_seq").update({ last_num: 0 }).neq("year", 0);
    await supabase.from("lot_stock_movements").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("stock_movements").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    await supabase.from("products").update({ stock: 0 }).neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("product_lots").update({ current_stock: 0 }).neq("id", "00000000-0000-0000-0000-000000000000");

    try {
      await idbClearAllOfflineSales();
    } catch {}
  },

  async getById(id: string): Promise<PosSale | null> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("pos_sales")
      .select("*, pos_sale_items(*)")
      .eq("id", id)
      .single();
    if (error) return null;
    return data as PosSale;
  },

  async list(filters?: PosSaleFilters): Promise<PosSale[]> {
    const supabase = requireClient();
    let q = supabase
      .from("pos_sales")
      .select("*, pos_sale_items(*)")
      .order("created_at", { ascending: false })
      .limit(filters?.limit ?? 100);

    if (filters?.status) q = q.eq("sale_status", filters.status);
    if (filters?.dateFrom) q = q.gte("created_at", filters.dateFrom);
    if (filters?.dateTo) q = q.lte("created_at", filters.dateTo);
    if (filters?.customerName) q = q.ilike("customer_name", `%${filters.customerName}%`);
    if (filters?.customerMobile) q = q.ilike("customer_mobile", `%${filters.customerMobile}%`);
    if (filters?.billNumber) q = q.ilike("bill_number", `%${filters.billNumber}%`);
    if (filters?.paymentMethod) q = q.eq("payment_method", filters.paymentMethod);
    if (filters?.minAmount != null) q = q.gte("total_amount", filters.minAmount);
    if (filters?.maxAmount != null) q = q.lte("total_amount", filters.maxAmount);
    if (filters?.creditOnly) q = q.eq("payment_method", "credit");
    if (filters?.cancelledOnly) q = q.eq("sale_status", "cancelled");

    const { data, error } = await q;
    if (error) throw error;

    let rows = (data ?? []) as PosSale[];

    if (filters?.search?.trim()) {
      const s = filters.search.trim().toLowerCase();
      rows = rows.filter(
        (sale) =>
          sale.bill_number.toLowerCase().includes(s) ||
          (sale.customer_name?.toLowerCase().includes(s) ?? false) ||
          (sale.customer_mobile?.includes(s) ?? false) ||
          (sale.pos_sale_items ?? []).some(
            (i) =>
              i.product_name.toLowerCase().includes(s) ||
              (i.barcode?.includes(s) ?? false)
          )
      );
    }

    return rows;
  },

  async searchBills(filters: PosSaleFilters): Promise<PosSale[]> {
    return this.list({ ...filters, limit: filters.limit ?? 200 });
  },

  async getHistoryStats(): Promise<PosSalesHistoryStats> {
    const supabase = requireClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    const { data, error } = await supabase
      .from("pos_sales")
      .select("total_amount, payment_method, sale_status, created_at")
      .eq("sale_status", "completed");
    if (error) throw error;

    const rows = data ?? [];
    const completed = rows.filter((r) => r.sale_status === "completed");
    const todaysSales = completed
      .filter((r) => new Date(r.created_at) >= todayStart)
      .reduce((s, r) => s + Number(r.total_amount), 0);
    const monthSales = completed
      .filter((r) => new Date(r.created_at) >= monthStart)
      .reduce((s, r) => s + Number(r.total_amount), 0);
    const totalBills = completed.length;
    const averageBillValue =
      totalBills > 0
        ? Math.round(
            (completed.reduce((s, r) => s + Number(r.total_amount), 0) / totalBills) * 100
          ) / 100
        : 0;
    const creditBills = completed.filter((r) => r.payment_method === "credit").length;
    const cashBills = completed.filter((r) => r.payment_method === "cash").length;

    return {
      todaysSales: Math.round(todaysSales * 100) / 100,
      monthSales: Math.round(monthSales * 100) / 100,
      totalBills,
      averageBillValue,
      creditBills,
      cashBills,
    };
  },

  async convertToCredit(saleId: string): Promise<PosSale> {
    const supabase = requireClient();
    const sale = await this.getById(saleId);
    if (!sale) throw new Error("Sale not found");
    if (sale.sale_status !== "completed") throw new Error("Only completed bills can be converted");
    if (sale.payment_method === "credit") throw new Error("Bill is already a credit sale");
    if (!sale.customer_id) throw new Error("Customer is required for credit conversion");

    await supabase
      .from("pos_sales")
      .update({
        payment_method: "credit",
        payment_status: "pending",
      })
      .eq("id", saleId);

    await creditService.addCredit(
      sale.customer_id,
      Number(sale.total_amount),
      "pos_sale",
      saleId,
      `Converted to credit — ${sale.bill_number}`
    );

    return this.getById(saleId) as Promise<PosSale>;
  },

  async getLastBills(count = 10): Promise<PosSale[]> {
    return this.list({ limit: count });
  },

  async getTodaysBills(): Promise<PosSale[]> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.list({ dateFrom: start.toISOString(), limit: 200 });
  },

  async getHeldBills(): Promise<PosSale[]> {
    return this.list({ status: "held" });
  },

  async getTodayStats() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const sales = await this.list({ dateFrom: start.toISOString() });
    const completed = sales.filter((s) => s.sale_status === "completed");
    return {
      count: completed.length,
      total: completed.reduce((s, x) => s + Number(x.total_amount), 0),
      cash: completed
        .filter((s) => s.payment_method === "cash")
        .reduce((s, x) => s + Number(x.total_amount), 0),
      upi: completed
        .filter((s) => s.payment_method === "upi")
        .reduce((s, x) => s + Number(x.total_amount), 0),
      card: completed
        .filter((s) => s.payment_method === "card")
        .reduce((s, x) => s + Number(x.total_amount), 0),
      credit: completed
        .filter((s) => s.payment_method === "credit")
        .reduce((s, x) => s + Number(x.total_amount), 0),
    };
  },
};

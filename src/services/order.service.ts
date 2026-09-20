import { requireClient } from "@/lib/supabase/client";
import {
  embedOtpInNotes,
  generateDeliveryOtp,
  getOrderDeliveryOtp,
  stripOtpFromNotes,
} from "@/utils/delivery-otp";
import type { Order, OrderItem, OrderStatus, PaymentMethod } from "@/types/database";
import { customerService } from "@/services/erp/customer.service";
import { getActiveFinancialYearCode } from "@/utils/financial-year";

const orderSelectBasic = `
  *,
  order_items(*, products(*)),
  addresses(*)
`;

const orderSelectFull = `
  *,
  order_items(*, products(*)),
  addresses(*),
  users(name, email, phone),
  tracking_history(*)
`;

function clientOrderNumber(): string {
  const fyCode = getActiveFinancialYearCode();
  const seq = Date.now().toString().slice(-6);
  return `OGS/${fyCode}/${seq}`;
}

function parseDbError(error: { message?: string; code?: string; details?: string }) {
  const msg = error.message ?? "Unknown database error";
  if (error.code === "42501" || msg.includes("policy")) {
    return "Permission denied. Please sign in again or contact support.";
  }
  if (error.code === "23503") {
    return "Invalid address or product. Refresh the page and try again.";
  }
  if (error.code === "PGRST202" || msg.includes("generate_order_number")) {
    return "Order setup incomplete. Run supabase/migrations/004_fix_orders.sql in Supabase.";
  }
  if (msg.includes("order_status") || msg.includes("invalid input value for enum")) {
    return "Database needs update: run supabase/migrations/004_fix_orders.sql in Supabase SQL Editor.";
  }
  return msg;
}

export const orderService = {
  async getByUser(userId: string): Promise<Order[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("orders")
      .select(orderSelectFull)
      .eq("user_id", userId)
      .or("tracking_notes.is.null,tracking_notes.neq.DELETED_ORDER")
      .order("created_at", { ascending: false });
    if (error) {
      const fallback = await supabase
        .from("orders")
        .select(orderSelectBasic)
        .eq("user_id", userId)
        .or("tracking_notes.is.null,tracking_notes.neq.DELETED_ORDER")
        .order("created_at", { ascending: false });
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []) as Order[];
    }
    return (data ?? []) as Order[];
  },

  async getById(orderId: string): Promise<Order | null> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("orders")
      .select(orderSelectFull)
      .eq("id", orderId)
      .single();
    if (!error) return data as Order;

    const { data: basic } = await supabase
      .from("orders")
      .select(orderSelectBasic)
      .eq("id", orderId)
      .single();
    return basic as Order | null;
  },

  async getByOrderNumber(orderNumber: string): Promise<Order | null> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("orders")
      .select(orderSelectFull)
      .eq("order_number", orderNumber.trim().toUpperCase())
      .maybeSingle();
    if (error) throw error;
    return data as Order | null;
  },

  async trackByOrderNumber(orderNumber: string) {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc("get_order_by_number", {
      p_order_number: orderNumber.trim().toUpperCase(),
    });
    if (error) throw error;
    return data as {
      order: Order;
      items: OrderItem[];
      history: { id: string; status: string; note: string | null; created_at: string }[];
    } | null;
  },

  async getAll(filters?: {
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Order[]> {
    const supabase = requireClient();
    let query = supabase.from("orders").select(orderSelectFull).order("created_at", { ascending: false });

    if (filters?.status && filters.status !== "all") {
      query = query.eq("order_status", filters.status);
    }
    query = query.or("tracking_notes.is.null,tracking_notes.neq.DELETED_ORDER");
    if (filters?.search) {
      query = query.ilike("order_number", `%${filters.search}%`);
    }
    if (filters?.dateFrom) {
      query = query.gte("created_at", filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte("created_at", `${filters.dateTo}T23:59:59`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Order[];
  },

  async generateOrderNumber(): Promise<string> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc("generate_order_number");
    if (!error && data) return data as string;
    return clientOrderNumber();
  },

  async createOrder(params: {
    userId: string;
    addressId: string;
    totalAmount: number;
    deliveryCharge?: number;
    paymentMethod: PaymentMethod;
    customerName: string;
    customerPhone: string;
    items: { productId: string; quantity: number; price: number }[];
    notes?: string;
  }): Promise<Order> {
    if (params.items.length === 0) {
      throw new Error("Your cart is empty.");
    }

    const supabase = requireClient();

    // Verify stock availability for all cart items
    for (const item of params.items) {
      const { data: product } = await supabase
        .from("products")
        .select("id, name, stock")
        .eq("id", item.productId)
        .single();
      if (!product) {
        throw new Error("One or more items in your cart are no longer available.");
      }
      if (product.stock < item.quantity) {
        throw new Error(
          `Only ${product.stock} left in stock for "${product.name}". Please reduce quantity to continue.`
        );
      }
    }

    const orderNumber = await this.generateOrderNumber();
    const deliveryOtp = generateDeliveryOtp();

    // Try new schema first (received + extra columns), then legacy (pending)
    const deliveryCharge = params.deliveryCharge ?? 0;
    const initialTrackingNotes = embedOtpInNotes(params.notes, deliveryOtp);

    const attempts: Record<string, unknown>[] = [
      {
        user_id: params.userId,
        address_id: params.addressId,
        total_amount: params.totalAmount,
        delivery_charge: deliveryCharge,
        order_number: orderNumber,
        payment_method: params.paymentMethod,
        payment_status: "pending",
        order_status: "received",
        customer_name: params.customerName,
        customer_phone: params.customerPhone || null,
        delivery_otp: deliveryOtp,
        delivery_otp_verified: false,
        is_new: true,
        tracking_notes: initialTrackingNotes,
      },
      {
        user_id: params.userId,
        address_id: params.addressId,
        total_amount: params.totalAmount,
        order_number: orderNumber,
        payment_method: params.paymentMethod,
        payment_status: "pending",
        order_status: "received",
        customer_name: params.customerName,
        customer_phone: params.customerPhone || null,
        delivery_otp: deliveryOtp,
        delivery_otp_verified: false,
        is_new: true,
        tracking_notes: initialTrackingNotes,
      },
      {
        user_id: params.userId,
        address_id: params.addressId,
        total_amount: params.totalAmount,
        order_number: orderNumber,
        payment_method: params.paymentMethod,
        payment_status: "pending",
        order_status: "pending",
        customer_name: params.customerName,
        customer_phone: params.customerPhone || null,
        tracking_notes: initialTrackingNotes,
      },
      {
        user_id: params.userId,
        address_id: params.addressId,
        total_amount: params.totalAmount,
        payment_status: "pending",
        order_status: "pending",
        tracking_notes: initialTrackingNotes,
      },
    ];

    let order: { id: string } | null = null;
    let lastError: { message?: string; code?: string } | null = null;

    for (const row of attempts) {
      const { data, error } = await supabase.from("orders").insert(row).select("id").single();
      if (!error && data) {
        order = data;
        break;
      }
      lastError = error;
      // Stop retrying on permission errors
      if (error?.code === "42501") break;
    }

    if (!order) {
      throw new Error(parseDbError(lastError ?? { message: "Could not create order" }));
    }

    const orderItems = params.items.map((item) => ({
      order_id: order!.id,
      product_id: item.productId,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw new Error(parseDbError(itemsError));
    }

    for (const item of params.items) {
      try {
        await supabase.rpc("apply_stock_movement", {
          p_product_id: item.productId,
          p_quantity: -item.quantity,
          p_movement_type: "online_order",
          p_reference_type: "order",
          p_reference_id: order.id,
          p_notes: `Online order ${orderNumber}`,
        });
      } catch {
        const { data: product } = await supabase
          .from("products")
          .select("stock")
          .eq("id", item.productId)
          .single();
        if (product) {
          await supabase
            .from("products")
            .update({ stock: Math.max(0, product.stock - item.quantity) })
            .eq("id", item.productId);
        }
      }
    }

    await supabase.from("cart_items").delete().eq("user_id", params.userId);

    try {
      await this.issueDeliveryOtp(order.id);
    } catch (err) {
      console.warn("Could not attach delivery OTP:", err);
    }

    try {
      const { data: userRow } = await supabase
        .from("users")
        .select("email")
        .eq("id", params.userId)
        .maybeSingle();
      const { data: addressRow } = await supabase
        .from("addresses")
        .select("address_line, city, state, postal_code")
        .eq("id", params.addressId)
        .maybeSingle();
      const addressStr = addressRow
        ? `${addressRow.address_line}, ${addressRow.city}, ${addressRow.state} - ${addressRow.postal_code}`
        : null;

      await customerService.ensureFromOrder({
        userId: params.userId,
        name: params.customerName,
        mobile: params.customerPhone,
        email: userRow?.email ?? null,
        address: addressStr,
      });
    } catch (err) {
      console.warn("Customer sync on order:", err);
    }

    const full = await this.getById(order.id);
    if (full) return full;

    return {
      id: order.id,
      order_number: orderNumber,
      user_id: params.userId,
      address_id: params.addressId,
      total_amount: params.totalAmount,
      payment_status: "pending",
      order_status: "pending" as OrderStatus,
      payment_method: params.paymentMethod,
      tracking_notes: null,
      delivered_at: null,
      delivery_otp: deliveryOtp,
      delivery_otp_verified: false,
      customer_name: params.customerName,
      customer_phone: params.customerPhone,
      created_at: new Date().toISOString(),
    } as Order;
  },

  async updateOrderTotals(params: {
    orderId: string;
    totalAmount: number;
    deliveryCharge?: number;
  }) {
    const supabase = requireClient();
    const orderUpdate: Record<string, unknown> = {
      total_amount: params.totalAmount,
    };
    if (params.deliveryCharge != null) {
      orderUpdate.delivery_charge = params.deliveryCharge;
    }

    let { data, error } = await supabase
      .from("orders")
      .update(orderUpdate)
      .eq("id", params.orderId)
      .select()
      .single();

    if (error?.message?.includes("delivery_charge")) {
      ({ data, error } = await supabase
        .from("orders")
        .update({ total_amount: params.totalAmount })
        .eq("id", params.orderId)
        .select()
        .single());
    }

    if (error) throw new Error(parseDbError(error));
    return data as Order;
  },

  async assignDeliveryPerson(orderId: string, deliveryPerson: string) {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("orders")
      .update({
        delivery_person: deliveryPerson.trim() || null,
        delivery_assigned_at: deliveryPerson.trim() ? new Date().toISOString() : null,
      })
      .eq("id", orderId)
      .select()
      .single();
    if (error) throw new Error(parseDbError(error));
    return data as Order;
  },

  async updateStatus(orderId: string, orderStatus: OrderStatus, note?: string) {
    const supabase = requireClient();

    // Fetch existing order to check previous status and line items
    const existing = await this.getById(orderId);
    const prevStatus = existing?.order_status;

    // If order is transitioning TO cancelled from non-cancelled, restore stock!
    if (orderStatus === "cancelled" && prevStatus && prevStatus !== "cancelled") {
      try {
        await supabase.rpc("restore_online_order_stock", { p_order_id: orderId });
      } catch (err) {
        console.warn("restore_online_order_stock RPC failed, falling back to manual restore:", err);
        for (const item of existing.order_items ?? []) {
          try {
            await supabase.rpc("apply_stock_movement", {
              p_product_id: item.product_id,
              p_quantity: item.quantity,
              p_movement_type: "cancel",
              p_reference_type: "order",
              p_reference_id: orderId,
              p_notes: `Online order ${existing.order_number || orderId} cancelled`,
            });
          } catch {
            const { data: prod } = await supabase
              .from("products")
              .select("stock")
              .eq("id", item.product_id)
              .single();
            if (prod) {
              await supabase
                .from("products")
                .update({ stock: prod.stock + item.quantity })
                .eq("id", item.product_id);
            }
          }
        }
      }
    } else if (prevStatus === "cancelled" && orderStatus !== "cancelled") {
      // Transitioning FROM cancelled back to active, re-deduct stock
      for (const item of existing?.order_items ?? []) {
        try {
          await supabase.rpc("apply_stock_movement", {
            p_product_id: item.product_id,
            p_quantity: -item.quantity,
            p_movement_type: "online_order",
            p_reference_type: "order",
            p_reference_id: orderId,
            p_notes: `Online order ${existing?.order_number || orderId} re-activated`,
          });
        } catch {
          const { data: prod } = await supabase
            .from("products")
            .select("stock")
            .eq("id", item.product_id)
            .single();
          if (prod) {
            await supabase
              .from("products")
              .update({ stock: Math.max(0, prod.stock - item.quantity) })
              .eq("id", item.product_id);
          }
        }
      }
    }

    const base: Record<string, unknown> = {
      order_status: orderStatus,
      tracking_notes: note ?? null,
    };
    if (orderStatus === "delivered") {
      base.delivered_at = new Date().toISOString();
      base.payment_status = "paid";
    }

    const attempts: Record<string, unknown>[] = [
      { ...base, is_new: false },
      base,
    ];

    let lastError: { message?: string; code?: string } | null = null;

    for (const updates of attempts) {
      const { data, error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", orderId)
        .select()
        .single();
      if (!error && data) {
        try {
          const statusLabel = orderStatus.replace(/_/g, " ").toUpperCase();
          const ord = data as Order;
          await supabase.from("notifications").insert({
            type: `order_${orderStatus}`,
            title: `Order ${ord.order_number} ${statusLabel}`,
            message: `Order #${ord.order_number} is now ${statusLabel}. Customer: ${ord.customer_name || "Customer"}. Amount: ₹${Number(ord.total_amount).toFixed(2)}`,
            reference_type: "order",
            reference_id: orderId,
            is_read: false,
          });
        } catch (notifErr) {
          console.warn("Notification logging:", notifErr);
        }
        return data as Order;
      }
      lastError = error;
      if (error?.code === "42501") break;
    }

    throw new Error(parseDbError(lastError ?? { message: "Could not update order status" }));
  },

  async deleteOrder(
    orderId: string,
    options: { restoreStock?: boolean } = { restoreStock: true }
  ): Promise<{ success: boolean; orderNumber?: string }> {
    const supabase = requireClient();

    // 1. Try atomic database RPC function first
    try {
      const { data, error } = await supabase.rpc("delete_online_order", {
        p_order_id: orderId,
        p_restore_stock: options.restoreStock ?? true,
      });
      if (!error && (data as { success?: boolean })?.success) {
        return {
          success: true,
          orderNumber: (data as { order_number?: string })?.order_number,
        };
      }
    } catch (e) {
      console.warn("delete_online_order RPC failed, trying fallback:", e);
    }

    // 2. Client-side fallback
    const existing = await this.getById(orderId);
    if (!existing) throw new Error("Order not found");

    // Restore stock if requested and order wasn't already cancelled
    if (options.restoreStock !== false && existing.order_status !== "cancelled") {
      for (const item of existing.order_items ?? []) {
        try {
          await supabase.rpc("apply_stock_movement", {
            p_product_id: item.product_id,
            p_quantity: item.quantity,
            p_movement_type: "cancel",
            p_reference_type: "order",
            p_reference_id: orderId,
            p_notes: `Online order ${existing.order_number || orderId} deleted`,
          });
        } catch {
          const { data: prod } = await supabase
            .from("products")
            .select("stock")
            .eq("id", item.product_id)
            .single();
          if (prod) {
            await supabase
              .from("products")
              .update({ stock: prod.stock + item.quantity })
              .eq("id", item.product_id);
          }
        }
      }
    }

    // Clean up dependent records where possible
    try { await supabase.from("tracking_history").delete().eq("order_id", orderId); } catch {}
    try { await supabase.from("notifications").delete().eq("reference_type", "order").eq("reference_id", orderId); } catch {}
    try { await supabase.from("order_items").delete().eq("order_id", orderId); } catch {}

    const { error: delError } = await supabase.from("orders").delete().eq("id", orderId);

    if (delError) {
      // If direct delete failed (RLS permission code 42501 on orders), mark cancelled & DELETED_ORDER
      // so it is removed from the active orders list and stock is safely restored
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          order_status: "cancelled",
          tracking_notes: "DELETED_ORDER",
        })
        .eq("id", orderId);

      if (updateErr) {
        throw new Error(
          "Could not delete order: " +
            parseDbError(delError) +
            ". Run supabase/migrations/023_packaging_and_online_order_delete.sql in Supabase SQL Editor."
        );
      }

      return {
        success: true,
        orderNumber: existing.order_number ?? existing.id,
      };
    }

    return {
      success: true,
      orderNumber: existing.order_number ?? existing.id,
    };
  },

  getDeliveryOtp(order: Pick<Order, "delivery_otp" | "tracking_notes">): string | null {
    return getOrderDeliveryOtp(order);
  },

  async issueDeliveryOtp(orderId: string): Promise<string> {
    const existing = await this.getById(orderId);
    const current = existing ? this.getDeliveryOtp(existing) : null;
    if (current && existing?.order_status !== "delivered") return current;

    const otp = generateDeliveryOtp();
    const supabase = requireClient();
    const withColumn = await supabase
      .from("orders")
      .update({
        delivery_otp: otp,
        delivery_otp_verified: false,
      })
      .eq("id", orderId)
      .select("id")
      .single();

    if (withColumn.error) {
      const fallback = await supabase
        .from("orders")
        .update({ tracking_notes: embedOtpInNotes(existing?.tracking_notes, otp) })
        .eq("id", orderId);
      if (fallback.error) throw new Error(parseDbError(fallback.error));
    }
    return otp;
  },

  async verifyDeliveryOtp(orderId: string, otp: string): Promise<void> {
    const order = await this.getById(orderId);
    if (!order) throw new Error("Order not found");
    const expected = this.getDeliveryOtp(order);
    const entered = otp.replace(/\D/g, "");
    if (!expected || entered !== expected) {
      throw new Error("Wrong OTP. Ask the customer for the 6-digit code from their order page.");
    }

    const supabase = requireClient();
    const paid = {
      order_status: "delivered" as const,
      delivered_at: new Date().toISOString(),
      payment_status: "paid",
      delivery_otp_verified: true,
      tracking_notes: stripOtpFromNotes(order.tracking_notes),
    };
    const { error } = await supabase.from("orders").update(paid).eq("id", orderId);
    if (error) {
      const { error: fallback } = await supabase
        .from("orders")
        .update({
          order_status: "delivered",
          delivered_at: paid.delivered_at,
          payment_status: "paid",
          tracking_notes: stripOtpFromNotes(order.tracking_notes),
        })
        .eq("id", orderId);
      if (fallback) throw new Error(parseDbError(fallback));
    }
  },

  async markOrdersSeen() {
    const supabase = requireClient();
    await supabase.from("orders").update({ is_new: false }).eq("is_new", true);
  },

  async updateOrder(params: {
    orderId: string;
    totalAmount: number;
    deliveryCharge?: number;
    items: { id?: string; productId: string; quantity: number; price: number }[];
  }) {
    if (params.items.length === 0) {
      throw new Error("Order must have at least one item.");
    }

    const supabase = requireClient();

    const { error: deleteError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", params.orderId);
    if (deleteError) {
      throw new Error(
        parseDbError(deleteError) +
          " Run supabase/migrations/006_admin_order_items.sql in Supabase."
      );
    }

    const orderItems = params.items.map((item) => ({
      order_id: params.orderId,
      product_id: item.productId,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
    if (itemsError) {
      throw new Error(
        parseDbError(itemsError) +
          " Run supabase/migrations/006_admin_order_items.sql in Supabase."
      );
    }

    return this.updateOrderTotals({
      orderId: params.orderId,
      totalAmount: params.totalAmount,
      deliveryCharge: params.deliveryCharge,
    });
  },

  async getDashboardStats() {
    const supabase = requireClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const { data: orders } = await supabase
      .from("orders")
      .select("total_amount, order_status, created_at, payment_status, tracking_notes")
      .or("tracking_notes.is.null,tracking_notes.neq.DELETED_ORDER");

    const all = orders ?? [];
    const active = (o: { order_status: string }) =>
      !["delivered", "cancelled"].includes(o.order_status);

    return {
      totalOrders: all.length,
      pendingOrders: all.filter(active).length,
      deliveredOrders: all.filter((o) => o.order_status === "delivered").length,
      todaySales: all
        .filter((o) => new Date(o.created_at) >= today && o.order_status !== "cancelled")
        .reduce((s, o) => s + Number(o.total_amount), 0),
      monthlySales: all
        .filter((o) => new Date(o.created_at) >= monthStart && o.order_status !== "cancelled")
        .reduce((s, o) => s + Number(o.total_amount), 0),
      newOrders: all.filter(
        (o) => o.order_status === "received" || o.order_status === "pending"
      ).length,
    };
  },

  async getSalesReport() {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("orders")
      .select("total_amount, payment_status, created_at, order_status, tracking_notes")
      .neq("order_status", "cancelled")
      .or("tracking_notes.is.null,tracking_notes.neq.DELETED_ORDER");
    if (error) throw error;
    return data ?? [];
  },
};

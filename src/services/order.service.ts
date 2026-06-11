import { createClient } from "@/lib/supabase/client";
import type { Order, OrderItem, OrderStatus, PaymentMethod } from "@/types/database";
import { customerService } from "@/services/erp/customer.service";

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
  const year = new Date().getFullYear();
  const seq = Date.now().toString().slice(-6);
  return `OGS-${year}-${seq}`;
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
    const supabase = createClient();
    const { data, error } = await supabase
      .from("orders")
      .select(orderSelectFull)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      const fallback = await supabase
        .from("orders")
        .select(orderSelectBasic)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []) as Order[];
    }
    return (data ?? []) as Order[];
  },

  async getById(orderId: string): Promise<Order | null> {
    const supabase = createClient();
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
    const supabase = createClient();
    const { data, error } = await supabase
      .from("orders")
      .select(orderSelectFull)
      .eq("order_number", orderNumber.trim().toUpperCase())
      .maybeSingle();
    if (error) throw error;
    return data as Order | null;
  },

  async trackByOrderNumber(orderNumber: string) {
    const supabase = createClient();
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
    const supabase = createClient();
    let query = supabase.from("orders").select(orderSelectFull).order("created_at", { ascending: false });

    if (filters?.status && filters.status !== "all") {
      query = query.eq("order_status", filters.status);
    }
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
    const supabase = createClient();
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
  }): Promise<Order> {
    if (params.items.length === 0) {
      throw new Error("Your cart is empty.");
    }

    const supabase = createClient();
    const orderNumber = await this.generateOrderNumber();

    // Try new schema first (received + extra columns), then legacy (pending)
    const deliveryCharge = params.deliveryCharge ?? 0;

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
        is_new: true,
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
        is_new: true,
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
      },
      {
        user_id: params.userId,
        address_id: params.addressId,
        total_amount: params.totalAmount,
        payment_status: "pending",
        order_status: "pending",
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

    await supabase.from("cart_items").delete().eq("user_id", params.userId);

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
    const supabase = createClient();
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
    const supabase = createClient();
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
    const supabase = createClient();

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
      if (!error && data) return data as Order;
      lastError = error;
      if (error?.code === "42501") break;
    }

    throw new Error(parseDbError(lastError ?? { message: "Could not update order status" }));
  },

  async markOrdersSeen() {
    const supabase = createClient();
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

    const supabase = createClient();

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
    const supabase = createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const { data: orders } = await supabase
      .from("orders")
      .select("total_amount, order_status, created_at, payment_status");

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
    const supabase = createClient();
    const { data, error } = await supabase
      .from("orders")
      .select("total_amount, payment_status, created_at, order_status")
      .neq("order_status", "cancelled");
    if (error) throw error;
    return data ?? [];
  },
};

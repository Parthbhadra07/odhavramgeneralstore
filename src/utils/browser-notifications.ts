export interface OrderNotificationPayload {
  id?: string;
  order_number?: string;
  customer_name?: string;
  total_amount?: number;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function showOrderNotification(order: OrderNotificationPayload): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const parts = [
    order.order_number && `Order ${order.order_number}`,
    order.customer_name,
    order.total_amount != null && `₹${order.total_amount}`,
  ].filter(Boolean);

  try {
    const notification = new Notification("New order received", {
      body: parts.join(" · ") || "A new order has arrived",
      tag: order.id ? `order-${order.id}` : "new-order",
      requireInteraction: false,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // ignore
  }
}

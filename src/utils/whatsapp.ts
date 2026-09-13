import { STORE_PHONE, APP_NAME } from "@/lib/constants";

/**
 * Normalizes an Indian phone number to standard international format without '+' for WhatsApp.
 * e.g. "9876543210" -> "919876543210"
 * e.g. "+91 98765 43210" -> "919876543210"
 * e.g. "919876543210" -> "919876543210"
 */
export function normalizeIndianPhone(phone?: string): string {
  if (!phone || !phone.trim()) {
    return `91${STORE_PHONE.replace(/\D/g, "")}`;
  }
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }
  if (digits.length > 10 && digits.startsWith("0")) {
    return `91${digits.slice(1)}`;
  }
  return digits.length >= 10 ? digits : `91${STORE_PHONE.replace(/\D/g, "")}`;
}

export function whatsAppShareUrl(message: string, phone?: string) {
  const text = encodeURIComponent(message);
  const targetPhone = normalizeIndianPhone(phone);
  return `https://wa.me/${targetPhone}?text=${text}`;
}

export function openWhatsAppShare(message: string, phone?: string) {
  window.open(whatsAppShareUrl(message, phone), "_blank", "noopener,noreferrer");
}

export function orderConfirmationMessage(orderNumber: string, total: string) {
  return `Hello from ${APP_NAME}!\n\nYour order ${orderNumber} has been received.\nTotal: ${total}\n\nThank you for shopping with us!`;
}

export function orderStatusMessage(orderNumber: string, status: string) {
  return `${APP_NAME} — Order Update\n\nOrder: ${orderNumber}\nStatus: ${status}\n\nFor queries call ${STORE_PHONE}`;
}

export function invoiceShareMessage(billNumber: string, total: string) {
  return `${APP_NAME}\nBill: ${billNumber}\nAmount: ${total}\n\nThank you for your purchase!`;
}

/**
 * Rich formatted WhatsApp status message with OTP and live tracking URL
 */
export function orderStatusWhatsAppMessage(params: {
  orderNumber: string;
  status: string;
  customerName?: string | null;
  totalAmount?: number | string | null;
  deliveryOtp?: string | null;
  trackingNotes?: string | null;
  appUrl?: string;
}): string {
  const name = params.customerName?.trim() || "Customer";
  const appBase =
    params.appUrl ||
    (typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "https://odhavramstore.in");

  const statusEmojis: Record<string, string> = {
    pending: "⏳",
    confirmed: "✅",
    preparing: "🍳",
    packed: "📦",
    out_for_delivery: "🚚",
    delivered: "🎉",
    cancelled: "❌",
  };

  const emoji = statusEmojis[params.status.toLowerCase()] || "📋";
  const formattedStatus = params.status.replace(/_/g, " ").toUpperCase();

  const lines = [
    `🛒 *${APP_NAME}*`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `Dear *${name}*, your order status has been updated:`,
    ``,
    `📋 *Order ID*: *${params.orderNumber}*`,
    `📍 *Current Status*: ${emoji} *${formattedStatus}*`,
  ];

  if (params.totalAmount != null) {
    lines.push(`💰 *Total Amount*: ₹${Number(params.totalAmount).toFixed(2)}`);
  }

  if (params.deliveryOtp && (params.status === "out_for_delivery" || params.status === "packed")) {
    lines.push(``);
    lines.push(`🔑 *Delivery OTP*: *${params.deliveryOtp}*`);
    lines.push(`_(Please share this OTP with the delivery partner upon arrival)_`);
  }

  if (params.trackingNotes?.trim()) {
    lines.push(`📝 *Note*: ${params.trackingNotes.trim()}`);
  }

  lines.push(``);
  lines.push(`🔗 *Track Order Live*: ${appBase}/track-order?id=${params.orderNumber}`);
  lines.push(``);
  lines.push(`📞 Need assistance? Call us at *${STORE_PHONE}*`);
  lines.push(`🙏 _Thank you for shopping with ${APP_NAME}!_`);

  return lines.join("\n");
}

/**
 * Rich formatted POS bill receipt for WhatsApp
 */
export function posBillWhatsAppMessage(params: {
  billNumber: string;
  totalAmount: number | string;
  customerName?: string | null;
  paymentMethod?: string;
  itemsCount?: number;
  discount?: number;
  date?: string;
}): string {
  const name = params.customerName?.trim() || "Customer";
  const billDate = params.date || new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const lines = [
    `🧾 *${APP_NAME}*`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `Dear *${name}*, thank you for your purchase!`,
    ``,
    `📄 *Invoice No*: *${params.billNumber}*`,
    `📅 *Date*: ${billDate}`,
  ];

  if (params.paymentMethod) {
    lines.push(`💳 *Payment Mode*: ${params.paymentMethod.toUpperCase()}`);
  }

  if (params.itemsCount != null && params.itemsCount > 0) {
    lines.push(`📦 *Items*: ${params.itemsCount}`);
  }

  if (params.discount && Number(params.discount) > 0) {
    lines.push(`🏷️ *Discount Savings*: ₹${Number(params.discount).toFixed(2)}`);
  }

  lines.push(`💵 *Grand Total*: *₹${Number(params.totalAmount).toFixed(2)}*`);
  lines.push(``);
  lines.push(`🙏 _Thank you for visiting ${APP_NAME}! Visit again soon._`);
  lines.push(`📞 Store Support: *${STORE_PHONE}*`);

  return lines.join("\n");
}

const OTP_NOTE = /\[DELIVERY_OTP:(\d{4,6})\]/;

export function generateDeliveryOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function embedOtpInNotes(notes: string | null | undefined, otp: string) {
  const cleaned = (notes ?? "").replace(OTP_NOTE, "").trim();
  return `${cleaned}${cleaned ? " " : ""}[DELIVERY_OTP:${otp}]`.trim();
}

export function stripOtpFromNotes(notes: string | null | undefined) {
  return (notes ?? "").replace(OTP_NOTE, "").trim() || null;
}

export function readOtpFromNotes(notes: string | null | undefined) {
  const match = notes?.match(OTP_NOTE);
  return match?.[1] ?? null;
}

export function getOrderDeliveryOtp(order: {
  delivery_otp?: string | null;
  tracking_notes?: string | null;
}) {
  return order.delivery_otp ?? readOtpFromNotes(order.tracking_notes);
}

export function shouldShowCustomerDeliveryOtp(
  order: {
    order_status?: string | null;
    delivery_otp_verified?: boolean | null;
    delivery_otp?: string | null;
    tracking_notes?: string | null;
  }
) {
  const otp = getOrderDeliveryOtp(order);
  if (!otp) return false;
  if (order.delivery_otp_verified) return false;
  const status = order.order_status ?? "";
  return status !== "delivered" && status !== "cancelled";
}

export function deliveryOtpMessage(orderNumber: string, otp: string) {
  return `Odhavram General Store\n\nYour delivery OTP for order ${orderNumber} is ${otp}.\nShare this code only with our delivery person when the order arrives.`;
}

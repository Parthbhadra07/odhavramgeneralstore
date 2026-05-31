export const APP_NAME = "Odhavram General Store";
export const APP_SHORT_NAME = "OGS";
export const APP_DESCRIPTION =
  "Your neighborhood grocery store in Odhav. Daily essentials, fresh goods, and home delivery.";

export const STORE_PHONE = "8160373047";
export const STORE_PHONE_DISPLAY = "+91 81603 73047";
export const STORE_PHONE_TEL = `tel:${STORE_PHONE}`;
export const STORE_EMAIL = "bhadraparth1@gmail.com";
export const STORE_ADDRESS = "Shop no 3 swastik residency opp to fellowship school, silvassa road vapi, Gujarat";

/** Delivery: free above this subtotal (₹), else standard charge */
export const FREE_DELIVERY_MIN = 499;
export const STANDARD_DELIVERY_CHARGE = 40;

/** Order workflow statuses */
export const ORDER_STATUSES = [
  "received",
  "confirmed",
  "preparing",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export type StoreOrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Order Received",
  received: "Order Received",
  confirmed: "Confirmed",
  preparing: "Preparing",
  packed: "Packed",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: "Cash on Delivery",
  qr: "UPI / Bank QR",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

export const PROMO_OFFERS = [
  {
    title: "Local Store",
    description: "Trusted groceries from Odhavram General Store",
    code: "OGSLOCAL",
    color: "from-green-600 to-emerald-500",
  },
  {
    title: "Free Delivery",
    description: "Free delivery on orders above ₹499",
    code: "FREEDEL",
    color: "from-emerald-600 to-teal-500",
  },
  {
    title: "Call to Order",
    description: `Order by phone: ${STORE_PHONE}`,
    code: "CALL",
    color: "from-teal-600 to-green-500",
  },
];

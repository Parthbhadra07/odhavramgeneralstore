export const ERP_ROLES = [
  "super_admin",
  "admin",
  "staff",
  "cashier",
  "customer",
] as const;

export type ErpRole = (typeof ERP_ROLES)[number];

export const STAFF_ROLES: ErpRole[] = [
  "super_admin",
  "admin",
  "staff",
  "cashier",
];

export const ADMIN_ROLES: ErpRole[] = ["super_admin", "admin"];

export const CASHIER_ROLES: ErpRole[] = ["super_admin", "admin", "cashier"];

export const POS_PAYMENT_METHODS = [
  "cash",
  "upi",
  "card",
  "credit",
] as const;

export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number];

export const POS_PAYMENT_LABELS: Record<PosPaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  credit: "Credit",
};

export const EXPENSE_CATEGORIES = [
  "rent",
  "electricity",
  "salaries",
  "transport",
  "repairs",
  "miscellaneous",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: "Rent",
  electricity: "Electricity",
  salaries: "Salaries",
  transport: "Transport",
  repairs: "Repairs",
  miscellaneous: "Miscellaneous",
};

export const STOCK_MOVEMENT_LABELS: Record<string, string> = {
  opening: "Opening Stock",
  opening_stock: "Opening Stock",
  purchase: "Purchase",
  purchase_return: "Purchase Return",
  pos_sale: "POS Sale",
  online_order: "Online Order",
  return: "Return",
  sales_return: "Sales Return",
  damaged: "Damaged",
  adjustment: "Adjustment",
  cancel: "Cancelled",
  transfer: "Stock Transfer",
  expired: "Expired",
};

export const PURCHASE_RETURN_REASONS = [
  "damage",
  "expired",
  "wrong_item",
  "excess_stock",
  "other",
] as const;

export const PURCHASE_RETURN_REASON_LABELS: Record<string, string> = {
  damage: "Damage",
  expired: "Expired",
  wrong_item: "Wrong Item",
  excess_stock: "Excess Stock",
  other: "Other",
};

export const SALES_RETURN_REASONS = [
  "damaged",
  "wrong_product",
  "expired",
  "customer_return",
  "other",
] as const;

export const SALES_RETURN_REASON_LABELS: Record<string, string> = {
  damaged: "Damaged",
  wrong_product: "Wrong Product",
  expired: "Expired",
  customer_return: "Customer Return",
  other: "Other",
};

export const SALES_RETURN_TYPES = ["refund", "replacement", "store_credit"] as const;

export const SALES_RETURN_TYPE_LABELS: Record<string, string> = {
  refund: "Refund",
  replacement: "Replacement",
  store_credit: "Store Credit",
};

export const REFUND_STATUSES = ["pending", "approved", "rejected", "paid"] as const;

export const REFUND_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

export const REFUND_METHODS = ["cash", "upi", "bank_transfer", "store_credit"] as const;

export const REFUND_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  store_credit: "Store Credit",
};

/** Loyalty: 1 point per ₹100 spent */
export const LOYALTY_POINTS_PER_100 = 1;
/** 1 point = ₹1 discount when redeeming */
export const LOYALTY_POINT_VALUE = 1;

export const EXPIRY_ALERT_DAYS = [30, 15, 7] as const;

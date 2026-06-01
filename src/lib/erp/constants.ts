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
  purchase: "Purchase",
  purchase_return: "Purchase Return",
  pos_sale: "POS Sale",
  online_order: "Online Order",
  return: "Return",
  damaged: "Damaged",
  adjustment: "Adjustment",
  cancel: "Cancelled",
};

/** Loyalty: 1 point per ₹100 spent */
export const LOYALTY_POINTS_PER_100 = 1;
/** 1 point = ₹1 discount when redeeming */
export const LOYALTY_POINT_VALUE = 1;

export const EXPIRY_ALERT_DAYS = [30, 15, 7] as const;

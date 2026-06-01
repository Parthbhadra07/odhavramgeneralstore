import type {
  ExpenseCategory,
  PosPaymentMethod,
} from "@/lib/erp/constants";

export type StockMovementType =
  | "opening"
  | "purchase"
  | "purchase_return"
  | "pos_sale"
  | "online_order"
  | "return"
  | "damaged"
  | "adjustment"
  | "cancel";

export type PosSaleStatus =
  | "completed"
  | "held"
  | "suspended"
  | "cancelled"
  | "returned";

export interface ErpProduct {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  unit: string | null;
  description: string | null;
  price: number;
  purchase_price: number | null;
  selling_price: number | null;
  mrp: number | null;
  gst_percentage: number | null;
  stock: number;
  reorder_level: number | null;
  min_stock_level: number | null;
  max_stock_level: number | null;
  expiry_date: string | null;
  batch_number: string | null;
  opening_stock: number | null;
  image_url: string | null;
  category_id: string | null;
  featured: boolean;
  is_active: boolean | null;
  created_at: string;
  categories?: { id: string; name: string; slug: string } | null;
}

export interface Customer {
  id: string;
  user_id: string | null;
  name: string;
  mobile: string;
  address: string | null;
  gst_number: string | null;
  credit_balance: number;
  loyalty_points: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  mobile: string | null;
  gst_number: string | null;
  address: string | null;
  email: string | null;
  outstanding_amount: number;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: StockMovementType;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  products?: Pick<ErpProduct, "name" | "sku" | "barcode">;
}

export interface PurchaseBill {
  id: string;
  bill_number: string;
  invoice_date: string;
  supplier_id: string;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_amount: number;
  invoice_pdf_url: string | null;
  notes: string | null;
  created_at: string;
  suppliers?: Supplier;
  purchase_items?: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  purchase_bill_id: string;
  product_id: string;
  barcode: string | null;
  quantity: number;
  purchase_rate: number;
  gst_percentage: number;
  gst_amount: number;
  total_amount: number;
  batch_number: string | null;
  expiry_date: string | null;
  products?: ErpProduct;
}

export interface PosSale {
  id: string;
  bill_number: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  discount: number;
  loyalty_points_redeemed: number;
  loyalty_discount: number;
  total_amount: number;
  payment_method: PosPaymentMethod;
  payment_status: string;
  sale_status: PosSaleStatus;
  held_at: string | null;
  notes: string | null;
  cashier_id: string | null;
  created_at: string;
  pos_sale_items?: PosSaleItem[];
}

export interface PosSaleItem {
  id: string;
  pos_sale_id: string;
  product_id: string;
  product_name: string;
  barcode: string | null;
  quantity: number;
  rate: number;
  gst_percentage: number;
  gst_amount: number;
  total_amount: number;
}

export interface Expense {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  amount: number;
  notes: string | null;
  receipt_url: string | null;
  created_at: string;
}

export interface CashClosing {
  id: string;
  closing_date: string;
  opening_cash: number;
  cash_sales: number;
  upi_sales: number;
  card_sales: number;
  credit_sales: number;
  online_cash_sales: number;
  expenses: number;
  closing_cash: number;
  notes: string | null;
  created_at: string;
}

export interface ErpNotification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  payment_date: string;
  notes: string | null;
  created_at: string;
}

export interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  min_stock_level: number;
  required_quantity: number;
}

export interface PosCartLine {
  productId: string;
  name: string;
  barcode: string | null;
  rate: number;
  gstPercentage: number;
  quantity: number;
}

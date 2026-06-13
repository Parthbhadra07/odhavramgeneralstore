import type {
  ExpenseCategory,
  PosPaymentMethod,
} from "@/lib/erp/constants";

export type StockMovementType =
  | "opening"
  | "opening_stock"
  | "purchase"
  | "purchase_return"
  | "pos_sale"
  | "online_order"
  | "return"
  | "sales_return"
  | "damaged"
  | "adjustment"
  | "cancel"
  | "transfer"
  | "expired";

export type PurchaseReturnReason =
  | "damage"
  | "expired"
  | "wrong_item"
  | "excess_stock"
  | "other";

export type SalesReturnReason =
  | "damaged"
  | "wrong_product"
  | "expired"
  | "customer_return"
  | "other";

export type SalesReturnType = "refund" | "replacement" | "store_credit";

export type RefundStatus = "pending" | "approved" | "rejected" | "paid";

export type RefundMethod = "cash" | "upi" | "bank_transfer" | "store_credit";

export type PosSaleStatus =
  | "completed"
  | "held"
  | "suspended"
  | "cancelled"
  | "returned";

export type BarcodeFormat = "CODE128" | "EAN13" | "EAN8" | "UPC" | "QR";
export type ThermalPrinterType = "tvs" | "zebra" | "tsc" | "generic";
export type CustomerAccountStatus = "active" | "blocked" | "closed";

export interface ErpProduct {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  unit: string | null;
  hsn_code?: string | null;
  discount_percent?: number | null;
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
  is_bestseller?: boolean;
  is_new_arrival?: boolean;
  is_active: boolean | null;
  created_at: string;
  categories?: { id: string; name: string; slug: string } | null;
}

export interface Customer {
  id: string;
  user_id: string | null;
  name: string;
  mobile: string;
  email: string | null;
  address: string | null;
  gst_number: string | null;
  credit_balance: number;
  credit_limit?: number;
  account_status?: CustomerAccountStatus;
  last_payment_date?: string | null;
  loyalty_points: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerCredit {
  id: string;
  customer_id: string;
  amount: number;
  transaction_type: "credit" | "payment" | "adjust";
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  due_date?: string | null;
  payment_method?: string | null;
  description?: string | null;
  created_at: string;
}

export interface CreditLedgerEntry {
  id: string;
  date: string;
  description: string;
  type: string;
  debit: number;
  credit: number;
  runningBalance: number;
  notes: string | null;
  dueDate?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
}

export interface CreditDashboardStats {
  totalCreditGiven: number;
  totalCreditCollected: number;
  outstandingBalance: number;
  overdueAmount: number;
  activeCreditCustomers: number;
  todaysCollection: number;
}

export interface BarcodeLabelRecord {
  id: string;
  product_id: string;
  barcode: string;
  label_format: string;
  printer_type: string | null;
  label_width_mm: number | null;
  label_height_mm: number | null;
  print_quantity: number;
  printed_at: string | null;
  created_at: string;
}

export interface BarcodeDashboardStats {
  totalWithBarcode: number;
  generatedToday: number;
  printedToday: number;
  withoutBarcode: number;
}

export interface BarcodeLabelConfig {
  format: BarcodeFormat;
  labelWidthMm: number;
  labelHeightMm: number;
  barcodeHeight: number;
  fontSize: number;
  printerType: ThermalPrinterType;
  showProductName: boolean;
  showMrp: boolean;
  showSellingPrice: boolean;
  showSku: boolean;
  showBarcodeNumber: boolean;
  showStoreName: boolean;
  showMfgDate: boolean;
  showExpiryDate: boolean;
}

export interface PosSalesHistoryStats {
  todaysSales: number;
  monthSales: number;
  totalBills: number;
  averageBillValue: number;
  creditBills: number;
  cashBills: number;
}

export interface PosSaleFilters {
  status?: PosSaleStatus;
  dateFrom?: string;
  dateTo?: string;
  customerName?: string;
  customerMobile?: string;
  billNumber?: string;
  paymentMethod?: PosPaymentMethod;
  minAmount?: number;
  maxAmount?: number;
  creditOnly?: boolean;
  cancelledOnly?: boolean;
  search?: string;
  limit?: number;
}

export interface CustomerWithStats extends Customer {
  total_orders: number;
  total_purchase_amount: number;
  last_order_date: string | null;
}

export interface SupplierWithStats extends Supplier {
  total_purchases: number;
  last_purchase_date: string | null;
  purchase_count: number;
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
  lot_number: string | null;
  quantity: number;
  purchase_rate: number;
  selling_price: number | null;
  mrp: number | null;
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
  lot_id?: string | null;
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
  lotId?: string | null;
  name: string;
  barcode: string | null;
  rate: number;
  gstPercentage: number;
  quantity: number;
}

export interface StoreSettings {
  id: string;
  store_name: string;
  store_mobile: string;
  store_address: string | null;
  store_logo_url: string | null;
  gst_number: string | null;
  currency: string | null;
  default_gst_percentage: number | null;
  upi_id: string | null;
  upi_merchant_name: string | null;
  enable_upi_qr: boolean;
  receipt_header_text: string | null;
  receipt_footer_text: string | null;
  receipt_width: "58mm" | "80mm";
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  barcode: string | null;
  stock: number;
  purchase_rate: number;
  selling_price: number;
  mrp: number | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

export interface PosPaymentSplit {
  id: string;
  pos_sale_id: string;
  payment_method: PosPaymentMethod;
  amount: number;
  created_at: string;
}

export interface StockLedgerRow {
  date: string;
  productName: string;
  transactionType: string;
  referenceNumber: string | null;
  qtyIn: number;
  qtyOut: number;
  balance: number;
}

export interface ProductLot {
  id: string;
  product_id: string;
  lot_number: string | null;
  batch_number: string | null;
  barcode: string;
  purchase_price: number;
  selling_price: number | null;
  mrp: number | null;
  quantity: number;
  current_stock: number;
  expiry_date: string | null;
  purchase_item_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  products?: Pick<ErpProduct, "name" | "sku" | "barcode" | "price" | "selling_price">;
}

export interface LotStockMovement {
  id: string;
  lot_id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  product_lots?: Pick<ProductLot, "barcode" | "lot_number" | "batch_number">;
  products?: Pick<ErpProduct, "name" | "sku">;
}

export interface ReceiptLineItem {
  name: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface ReceiptData {
  orderId: string;
  date: string;
  time: string;
  cashierName?: string | null;
  customerName?: string | null;
  customerMobile?: string | null;
  deliveryAddress?: string | null;
  paymentMethod: string;
  orderStatus?: string | null;
  items: ReceiptLineItem[];
  subtotal: number;
  discount?: number;
  discountPercent?: number;
  deliveryCharge?: number;
  taxCgst?: number;
  taxSgst?: number;
  taxIgst?: number;
  grandTotal: number;
  notes?: string | null;
  /** Amount charged on credit this bill */
  creditDue?: number;
  /** Customer total outstanding credit after bill */
  creditBalance?: number;
  /** UPI QR amount (defaults to grandTotal) */
  upiAmount?: number;
  /** Force UPI QR display (overrides payment method check) */
  showUpiQr?: boolean;
  /** Prices include GST — show note instead of separate tax lines */
  gstIncluded?: boolean;
}

export interface PurchaseReturn {
  id: string;
  return_number: string;
  supplier_id: string;
  purchase_bill_id: string | null;
  return_date: string;
  reason: PurchaseReturnReason;
  reason_notes: string | null;
  total_amount: number;
  notes: string | null;
  created_at: string;
  suppliers?: Supplier;
  purchase_bills?: Pick<PurchaseBill, "bill_number">;
  purchase_return_items?: PurchaseReturnItem[];
}

export interface PurchaseReturnItem {
  id: string;
  purchase_return_id: string;
  product_id: string;
  lot_id: string | null;
  purchase_item_id: string | null;
  product_name: string;
  barcode: string | null;
  lot_number: string | null;
  batch_number: string | null;
  quantity: number;
  purchase_rate: number;
  total_amount: number;
}

export interface SalesReturn {
  id: string;
  return_number: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  order_id: string | null;
  pos_sale_id: string | null;
  return_date: string;
  reason: SalesReturnReason;
  return_type: SalesReturnType;
  reason_notes: string | null;
  total_amount: number;
  notes: string | null;
  created_at: string;
  customers?: Customer;
  sales_return_items?: SalesReturnItem[];
}

export interface SalesReturnItem {
  id: string;
  sales_return_id: string;
  product_id: string;
  lot_id: string | null;
  product_name: string;
  barcode: string | null;
  quantity: number;
  rate: number;
  total_amount: number;
}

export interface Refund {
  id: string;
  sales_return_id: string | null;
  order_id: string | null;
  pos_sale_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  amount: number;
  refund_method: RefundMethod;
  status: RefundStatus;
  reference_number: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  sales_returns?: Pick<SalesReturn, "return_number">;
}

export interface ProfitReport {
  revenue: number;
  cogs: number;
  grossProfit: number;
  purchaseReturns: number;
  salesReturns: number;
  expenses: number;
  discounts: number;
  deliveryCharges: number;
  netProfit: number;
  inventoryValue: number;
}

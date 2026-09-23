import type { StoreOrderStatus } from "@/lib/constants";

export type UserRole =
  | "customer"
  | "admin"
  | "super_admin"
  | "staff"
  | "cashier";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type OrderStatus = StoreOrderStatus;
export type PaymentMethod = "cod" | "qr";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
  sku?: string | null;
  barcode?: string | null;
  brand?: string | null;
  unit?: string | null;
  pieces_per_packet?: number | null;
  packets_per_box?: number | null;
  packet_selling_price?: number | null;
  box_selling_price?: number | null;
  packet_barcode?: string | null;
  box_barcode?: string | null;
  purchase_price?: number | null;
  selling_price?: number | null;
  mrp?: number | null;
  gst_percentage?: number | null;
  reorder_level?: number | null;
  min_stock_level?: number | null;
  max_stock_level?: number | null;
  expiry_date?: string | null;
  batch_number?: string | null;
  opening_stock?: number | null;
  is_active?: boolean | null;
  image_url: string | null;
  category_id: string | null;
  featured: boolean;
  is_bestseller?: boolean | null;
  is_new_arrival?: boolean | null;
  auto_refill_enabled?: boolean | null;
  auto_refill_quantity?: number | null;
  auto_refill_time?: string | null;
  last_auto_refilled_date?: string | null;
  auto_refill_slot2_enabled?: boolean | null;
  auto_refill_slot2_quantity?: number | null;
  auto_refill_slot2_time?: string | null;
  last_auto_refilled_slot2_date?: string | null;
  created_at: string;
  categories?: Category | null;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  products?: Product;
}

export interface Address {
  id: string;
  user_id: string;
  address_line: string;
  city: string;
  state: string;
  postal_code: string;
  is_default: boolean;
  created_at?: string;
}

export interface Order {
  id: string;
  order_number: string | null;
  user_id: string;
  address_id: string | null;
  total_amount: number;
  delivery_charge?: number | null;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  payment_method: PaymentMethod | string | null;
  tracking_notes: string | null;
  delivered_at: string | null;
  delivery_person?: string | null;
  delivery_assigned_at?: string | null;
  delivery_otp?: string | null;
  delivery_otp_verified?: boolean | null;
  customer_name: string | null;
  customer_phone: string | null;
  is_new?: boolean;
  created_at: string;
  addresses?: Address | null;
  order_items?: OrderItem[];
  users?: Pick<User, "name" | "email" | "phone"> | null;
  tracking_history?: TrackingHistory[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  products?: Product;
}

export interface TrackingHistory {
  id: string;
  order_id: string;
  status: string;
  note: string | null;
  created_at: string;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  created_at?: string;
  products?: Product;
}

export interface LocalCartItem {
  productId: string;
  quantity: number;
  product?: Product;
}

export type ProductSort =
  | "newest"
  | "price-asc"
  | "price-desc"
  | "name-asc";

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sort?: ProductSort;
  featured?: boolean;
  includeInactive?: boolean;
}

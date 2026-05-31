import type { StoreOrderStatus } from "@/lib/constants";

export type UserRole = "customer" | "admin";
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
  image_url: string | null;
  category_id: string | null;
  featured: boolean;
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
}

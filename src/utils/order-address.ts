import type { Address, Order } from "@/types/database";

/** Normalize Supabase embed (object or single-element array). */
export function getOrderAddress(order: Order): Address | null {
  const raw = order.addresses;
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

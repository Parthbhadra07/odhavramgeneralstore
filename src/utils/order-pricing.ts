import { FREE_DELIVERY_MIN, STANDARD_DELIVERY_CHARGE } from "@/lib/constants";

export function calculateDeliveryCharge(subtotal: number): number {
  return subtotal >= FREE_DELIVERY_MIN ? 0 : STANDARD_DELIVERY_CHARGE;
}

export function orderItemsSubtotal(
  items: { price: number; quantity: number }[]
): number {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

/** Use stored charge, or infer from total vs items, or apply store rule */
export function resolveDeliveryCharge(
  subtotal: number,
  totalAmount: number,
  storedCharge?: number | null
): number {
  if (storedCharge != null && !Number.isNaN(storedCharge)) {
    return Math.max(0, Number(storedCharge));
  }
  const inferred = totalAmount - subtotal;
  if (inferred > 0 && inferred <= STANDARD_DELIVERY_CHARGE * 2) {
    return inferred;
  }
  return calculateDeliveryCharge(subtotal);
}

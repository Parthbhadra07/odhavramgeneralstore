import type { ErpProduct, StockMovement } from "@/types/erp";

export type StockHealthKey = "out" | "critical" | "low" | "expiring" | "ok";

export interface StockHealth {
  key: StockHealthKey;
  label: string;
  hint: string;
  suggestedBuy: number;
  daysLeft: number | null;
  sold14: number;
}

function minLevel(p: ErpProduct) {
  return p.min_stock_level ?? p.reorder_level ?? 5;
}

function isExpiringSoon(p: ErpProduct, withinDays = 14) {
  if (!p.expiry_date) return false;
  const exp = new Date(p.expiry_date);
  const until = new Date();
  until.setDate(until.getDate() + withinDays);
  return exp <= until && exp >= new Date(new Date().toDateString());
}

/** Units sold in the last 14 days from stock ledger (sales / POS / orders). */
export function unitsSoldSince(movements: StockMovement[], productId: string, days = 14) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return movements
    .filter(
      (m) =>
        m.product_id === productId &&
        m.quantity < 0 &&
        new Date(m.created_at).getTime() >= since
    )
    .reduce((s, m) => s + Math.abs(m.quantity), 0);
}

export function describeStock(
  p: ErpProduct,
  movements: StockMovement[] = []
): StockHealth {
  const min = minLevel(p);
  const sold14 = unitsSoldSince(movements, p.id, 14);
  const daily = sold14 / 14;
  const daysLeft = daily > 0 ? Math.floor(p.stock / daily) : null;
  const coverGap = Math.ceil(sold14 + min - p.stock);
  const floorGap = min - p.stock;
  const suggestedBuy = Math.max(0, coverGap, floorGap);

  if (p.stock <= 0) {
    return {
      key: "out",
      label: "Out of stock",
      hint: suggestedBuy > 0 ? `Order about ${suggestedBuy} to restock` : "Add stock when the next purchase arrives",
      suggestedBuy: Math.max(suggestedBuy, min),
      daysLeft: 0,
      sold14,
    };
  }
  if (p.stock <= Math.max(1, Math.ceil(min * 0.4))) {
    return {
      key: "critical",
      label: "Almost gone",
      hint:
        daysLeft != null
          ? `At this pace, about ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
          : `Below the usual minimum of ${min}`,
      suggestedBuy,
      daysLeft,
      sold14,
    };
  }
  if (p.stock <= min) {
    return {
      key: "low",
      label: "Running low",
      hint:
        daysLeft != null
          ? `Roughly ${daysLeft} days of stock left`
          : `Minimum you like to keep is ${min}`,
      suggestedBuy,
      daysLeft,
      sold14,
    };
  }
  if (isExpiringSoon(p)) {
    return {
      key: "expiring",
      label: "Use soon",
      hint: p.expiry_date ? `Expires ${p.expiry_date}` : "Needing attention for expiry",
      suggestedBuy: 0,
      daysLeft,
      sold14,
    };
  }
  return {
    key: "ok",
    label: "Healthy",
    hint:
      daysLeft != null && daysLeft < 60
        ? `About ${daysLeft} days of stock at recent sales`
        : "Stock looks fine",
    suggestedBuy: 0,
    daysLeft,
    sold14,
  };
}

export const HEALTH_STYLE: Record<StockHealthKey, string> = {
  out: "bg-red-100 text-red-800",
  critical: "bg-orange-100 text-orange-800",
  low: "bg-amber-100 text-amber-900",
  expiring: "bg-purple-100 text-purple-800",
  ok: "bg-green-100 text-green-800",
};

const HEALTH_RANK: Record<StockHealthKey, number> = {
  out: 0,
  critical: 1,
  low: 2,
  expiring: 3,
  ok: 4,
};

export function sortByUrgency(products: ErpProduct[], movements: StockMovement[]) {
  return [...products].sort((a, b) => {
    const ha = describeStock(a, movements);
    const hb = describeStock(b, movements);
    const rank = HEALTH_RANK[ha.key] - HEALTH_RANK[hb.key];
    if (rank !== 0) return rank;
    return a.stock - b.stock;
  });
}

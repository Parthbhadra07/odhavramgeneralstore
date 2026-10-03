import type { Product } from "@/types/database";

export interface OfferTimeRemaining {
  text: string;
  isExpired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Extracts offer_start_date and offer_end_date either from product properties
 * or from embedded metadata inside description: <!--OFFER:{"start":"...","end":"..."}-->
 */
export function getProductOfferDates(product: Partial<Product>): {
  startDate: string | null;
  endDate: string | null;
} {
  let startDate = product.offer_start_date || null;
  let endDate = product.offer_end_date || null;

  if ((!startDate || !endDate) && product.description) {
    const match = product.description.match(/<!--OFFER:(\{.*?\})-->/);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        if (!startDate && parsed.start) startDate = parsed.start;
        if (!endDate && parsed.end) endDate = parsed.end;
      } catch {
        // ignore parse error
      }
    }
  }

  return { startDate, endDate };
}

/**
 * Embeds offer dates metadata into product description safely
 */
export function embedOfferDatesIntoDescription(
  description: string | null | undefined,
  dates: { startDate?: string | null; endDate?: string | null }
): string {
  const clean = (description || "").replace(/<!--OFFER:\{.*?\}-->/g, "").trim();
  if (!dates.startDate && !dates.endDate) {
    return clean;
  }
  const meta = JSON.stringify({
    start: dates.startDate || null,
    end: dates.endDate || null,
  });
  return clean ? `${clean}\n\n<!--OFFER:${meta}-->` : `<!--OFFER:${meta}-->`;
}

/**
 * Checks whether an offer on a product is currently active based on price and dates
 */
export function isOfferActive(product: Partial<Product>): boolean {
  const hasDiscount = Boolean((product.mrp && product.price && product.mrp > product.price) || product.featured);
  if (!hasDiscount) return false;

  const { startDate, endDate } = getProductOfferDates(product);
  const now = Date.now();

  if (startDate) {
    const startTime = new Date(startDate).getTime();
    if (!isNaN(startTime) && now < startTime) {
      return false; // Offer has not started yet
    }
  }

  if (endDate) {
    if (endDate === "realtime_daily" || endDate === "daily" || endDate === "today" || endDate === "weekend") {
      return true; // Live real-time recurring deal
    }
    const endTime = new Date(endDate).getTime();
    if (!isNaN(endTime) && now > endTime) {
      return false; // Offer has expired
    }
  }

  return true;
}

/**
 * Calculates remaining time until offer end date
 * Supports real-time daily countdown (ends at 23:59:59 today), weekend mode,
 * and fixed timestamp deadlines that persist across website restarts.
 */
export function getOfferTimeRemaining(endDateStr?: string | null): OfferTimeRemaining {
  let targetTime: number;

  const isDaily = !endDateStr || endDateStr === "realtime_daily" || endDateStr === "daily" || endDateStr === "today";
  const isWeekend = endDateStr === "weekend";

  if (isDaily) {
    // Real-time daily countdown: target is end of today (23:59:59.999 local time)
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    targetTime = endOfDay.getTime();
  } else if (isWeekend) {
    // Real-time weekend countdown: target is upcoming Sunday 23:59:59.999 local time
    const now = new Date();
    const day = now.getDay(); // 0 is Sunday
    const daysUntilSunday = (7 - day) % 7;
    const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSunday, 23, 59, 59, 999);
    targetTime = endOfWeek.getTime();
  } else {
    targetTime = new Date(endDateStr).getTime();
    if (isNaN(targetTime)) {
      // Fallback to real-time daily
      const now = new Date();
      targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    }
  }

  const diff = targetTime - Date.now();
  if (diff <= 0) {
    return {
      text: "Offer Expired",
      isExpired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  if (days > 0) {
    return {
      text: `${days}d ${hours}h left`,
      isExpired: false,
      days,
      hours,
      minutes,
      seconds,
    };
  }

  if (hours > 0) {
    return {
      text: `${hours}h ${minutes}m left`,
      isExpired: false,
      days,
      hours,
      minutes,
      seconds,
    };
  }

  return {
    text: `${minutes}m ${seconds}s left`,
    isExpired: false,
    days,
    hours,
    minutes,
    seconds,
  };
}

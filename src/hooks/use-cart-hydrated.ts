"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cart-store";

/** Wait until persisted cart is loaded from localStorage (avoids false empty cart) */
export function useCartHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useCartStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useCartStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}

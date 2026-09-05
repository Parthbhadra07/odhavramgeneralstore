"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCartHydrated } from "@/hooks/use-cart-hydrated";
import {
  clearCartClearedAfterOrderFlag,
  emptyCartAfterOrder,
  useCartStore,
  wasCartClearedAfterOrder,
} from "@/store/cart-store";
import { cartService } from "@/services/cart.service";

/** Syncs local cart with Supabase when user logs in */
export function useCartSync() {
  const { user } = useAuth();
  const setItems = useCartStore((s) => s.setItems);
  const hydrated = useCartHydrated();

  useEffect(() => {
    if (!user || !hydrated) return;

    const sync = async () => {
      try {
        if (wasCartClearedAfterOrder()) {
          emptyCartAfterOrder();
          try {
            await cartService.clearCart(user.id);
          } catch {
            // Keep the cleared flag so a later refresh still does not restore items
            return;
          }
          return;
        }

        const localItems = useCartStore.getState().items;
        const serverItems = await cartService.getItems(user.id);

        if (serverItems.length > 0) {
          clearCartClearedAfterOrderFlag();
          setItems(
            serverItems.map((item) => ({
              productId: item.product_id,
              quantity: item.quantity,
              product: item.products,
            }))
          );
        } else if (localItems.length > 0) {
          for (const item of localItems) {
            await cartService.addItem(user.id, item.productId, item.quantity);
          }
        }
      } catch {
        // Offline or not configured — local cart still works
      }
    };

    void sync();
  }, [user?.id, hydrated, setItems]);
}

"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCartStore } from "@/store/cart-store";
import { cartService } from "@/services/cart.service";

/** Syncs local cart with Supabase when user logs in */
export function useCartSync() {
  const { user } = useAuth();
  const { items, setItems } = useCartStore();

  useEffect(() => {
    if (!user) return;

    const sync = async () => {
      try {
        const serverItems = await cartService.getItems(user.id);
        if (serverItems.length > 0) {
          setItems(
            serverItems.map((item) => ({
              productId: item.product_id,
              quantity: item.quantity,
              product: item.products,
            }))
          );
        } else if (items.length > 0) {
          for (const item of items) {
            await cartService.addItem(user.id, item.productId, item.quantity);
          }
        }
      } catch {
        // Offline or not configured — local cart still works
      }
    };

    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}

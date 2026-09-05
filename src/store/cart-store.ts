import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LocalCartItem, Product } from "@/types/database";

const CART_STORAGE_KEY = "freshmart-cart";
const CART_CLEARED_AFTER_ORDER_KEY = "freshmart-cart-order-cleared";

export function wasCartClearedAfterOrder(): boolean {
  try {
    return localStorage.getItem(CART_CLEARED_AFTER_ORDER_KEY) === "1";
  } catch {
    return false;
  }
}

export function markCartClearedAfterOrder() {
  try {
    localStorage.setItem(CART_CLEARED_AFTER_ORDER_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearCartClearedAfterOrderFlag() {
  try {
    localStorage.removeItem(CART_CLEARED_AFTER_ORDER_KEY);
  } catch {
    // ignore
  }
}

function persistEmptyCartToStorage() {
  try {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ state: { items: [], isOpen: false }, version: 0 })
    );
  } catch {
    // ignore
  }
}

/** Empty the cart in memory, localStorage, and mark it so login sync cannot restore it. */
export function emptyCartAfterOrder() {
  useCartStore.setState({ items: [], isOpen: false });
  persistEmptyCartToStorage();
  markCartClearedAfterOrder();
}

interface CartState {
  items: LocalCartItem[];
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setItems: (items: LocalCartItem[]) => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      setOpen: (open) => set({ isOpen: open }),

      addItem: (product, quantity = 1) => {
        clearCartClearedAfterOrderFlag();
        const items = get().items;
        const existing = items.find((i) => i.productId === product.id);
        if (existing) {
          set({
            items: items.map((i) =>
              i.productId === product.id
                ? { ...i, quantity: i.quantity + quantity }
                : i
            ),
            isOpen: true,
          });
        } else {
          set({
            items: [...items, { productId: product.id, quantity, product }],
            isOpen: true,
          });
        }
      },

      removeItem: (productId) =>
        set({ items: get().items.filter((i) => i.productId !== productId) }),

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.productId === productId ? { ...i, quantity } : i
          ),
        });
      },

      clearCart: () => set({ items: [] }),

      setItems: (items) => set({ items }),

      getTotal: () =>
        get().items.reduce(
          (sum, i) => sum + (i.product?.price ?? 0) * i.quantity,
          0
        ),

      getItemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: CART_STORAGE_KEY,
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<CartState> | undefined;
        if (wasCartClearedAfterOrder()) {
          return { ...current, ...persistedState, items: [], isOpen: false };
        }
        return { ...current, ...persistedState };
      },
    }
  )
);

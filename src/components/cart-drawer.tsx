"use client";

import { useRouter } from "next/navigation";
import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import { ProductImage } from "@/components/product-image";
import { useCartStore } from "@/store/cart-store";
import { formatPrice } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

export function CartDrawer() {
  const router = useRouter();
  const { items, isOpen, setOpen, updateQuantity, removeItem, getTotal } =
    useCartStore();

  if (!isOpen) return null;

  const total = getTotal();

  const goToCheckout = () => {
    setOpen(false);
    router.push("/checkout");
  };

  const goToCart = () => {
    setOpen(false);
    router.push("/cart");
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-xl"
        role="dialog"
        aria-label="Shopping cart"
      >
        <div className="flex items-center justify-between border-b px-4 py-4">
          <h2 className="text-lg font-semibold">Your Cart</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 hover:bg-gray-100"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingBag className="mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-600">Your cart is empty</p>
              <Button
                variant="outline"
                className="mt-4"
                href="/products"
                onClick={() => setOpen(false)}
              >
                Continue Shopping
              </Button>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li
                  key={item.productId}
                  className="flex gap-3 border-b border-gray-100 pb-4"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                    <ProductImage
                      src={item.product?.image_url}
                      alt={item.product?.name ?? "Product"}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.product?.name}
                    </p>
                    <p className="text-sm font-semibold text-green-700">
                      {formatPrice((item.product?.price ?? 0) * item.quantity)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity - 1)
                        }
                        className="rounded border p-1 hover:bg-gray-50"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity + 1)
                        }
                        className="rounded border p-1 hover:bg-gray-50"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="ml-auto text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t p-4">
            <div className="mb-4 flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span className="text-green-700">{formatPrice(total)}</span>
            </div>
            <Button type="button" className="w-full" onClick={goToCheckout}>
              Proceed to Checkout
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="mt-2 w-full"
              onClick={goToCart}
            >
              View Full Cart
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}

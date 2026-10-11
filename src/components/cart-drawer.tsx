"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  X,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Zap,
  Sparkles,
  ArrowRight,
  Receipt,
  Store,
} from "lucide-react";
import { toast } from "sonner";
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
  const totalItemCount = items.reduce((acc, i) => acc + i.quantity, 0);

  // Total savings calculation if MRP exists
  const totalSavings = items.reduce((acc, item) => {
    if (item.product?.mrp && item.product.mrp > (item.product.price ?? 0)) {
      return acc + (item.product.mrp - item.product.price) * item.quantity;
    }
    return acc;
  }, 0);

  const deliveryCharge = total >= 499 ? 0 : 40;
  const grandTotal = total + deliveryCharge;

  const handleContinueShopping = () => {
    setOpen(false);
    router.push("/products");
  };

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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Drawer Container: Bottom Sheet on Mobile, Slide-Over on Desktop */}
      <aside
        className={cn(
          "fixed z-50 flex flex-col bg-white shadow-2xl transition-transform duration-300",
          // Mobile: Bottom Sheet with rounded top corners
          "inset-x-0 bottom-0 max-h-[92vh] h-auto rounded-t-3xl border-t border-gray-100",
          // Desktop (sm+): Right Slide Drawer
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:max-w-md sm:w-full sm:h-full sm:max-h-full sm:rounded-none sm:border-t-0 sm:border-l"
        )}
        role="dialog"
        aria-label="Shopping cart"
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="mx-auto my-2.5 h-1.5 w-12 rounded-full bg-gray-300 sm:hidden shrink-0" />

        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:py-4 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
              My Cart
            </h2>
            {totalItemCount > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                {totalItemCount} {totalItemCount === 1 ? "item" : "items"}
              </span>
            )}
            <span className="hidden xs:flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
              <Zap className="h-3 w-3 text-emerald-600 fill-emerald-500" />
              15-20 Mins
            </span>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin p-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
                <ShoppingBag className="h-10 w-10 stroke-[1.5]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Your cart is empty</h3>
              <p className="mt-1 max-w-xs text-xs sm:text-sm text-gray-500">
                Explore our catalog for fresh groceries, snacks, household essentials, and daily deals.
              </p>
              <div className="mt-6 w-full max-w-xs space-y-2">
                <Button
                  type="button"
                  className="w-full font-bold shadow-md"
                  onClick={handleContinueShopping}
                >
                  Continue Shopping
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Free Delivery Target Banner */}
              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-blue-50/50 p-3 shadow-2xs">
                {total >= 499 ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>🎉 Congratulations! You unlocked <b>FREE Delivery</b>!</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                      <span>Add <b>{formatPrice(499 - total)}</b> more for FREE Delivery</span>
                      <span className="text-[11px] text-emerald-700 font-black">
                        {Math.round((total / 499) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100/60">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(5, (total / 499) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Items List Styled Like Modern Catalogue Cards */}
              <div className="space-y-3">
                {items.map((item) => {
                  const maxStock =
                    item.product && typeof item.product.stock === "number"
                      ? item.product.stock
                      : Infinity;
                  const isMaxReached = item.quantity >= maxStock;
                  const hasDiscount =
                    item.product?.mrp && item.product.mrp > (item.product?.price ?? 0);
                  const discountPct = hasDiscount
                    ? Math.round(
                        (((item.product!.mrp! - item.product!.price) /
                          item.product!.mrp!) *
                          100)
                      )
                    : 0;

                  return (
                    <div
                      key={item.productId}
                      className="group flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-xs hover:border-gray-200 transition-all"
                    >
                      {/* Product Thumbnail */}
                      <div className="relative h-18 w-18 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-white p-1 flex items-center justify-center">
                        <ProductImage
                          src={item.product?.image_url}
                          alt={item.product?.name ?? "Product"}
                          fill
                          fit="contain"
                          className="object-contain p-1"
                        />
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs sm:text-sm font-bold text-gray-900 leading-snug">
                          {item.product?.name}
                        </p>
                        <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                          {item.product?.unit ? `1 ${item.product.unit}` : "Standard"}
                        </p>

                        <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-sm font-extrabold text-blue-950">
                            {formatPrice((item.product?.price ?? 0) * item.quantity)}
                          </span>
                          {hasDiscount && (
                            <span className="text-[11px] text-gray-400 line-through">
                              {formatPrice(item.product!.mrp! * item.quantity)}
                            </span>
                          )}
                          {discountPct > 0 && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded">
                              {discountPct}% off
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stepper Matching Mobile Catalogue */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center rounded-lg bg-blue-700 text-white shadow-2xs gap-1.5 px-1 py-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (item.quantity <= 1) {
                                removeItem(item.productId);
                                toast.success("Item removed from cart");
                              } else {
                                updateQuantity(item.productId, item.quantity - 1);
                              }
                            }}
                            className="p-1 hover:bg-blue-800 rounded transition active:scale-90"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3 stroke-[3]" />
                          </button>
                          <span className="min-w-3 text-center text-xs font-black">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={isMaxReached}
                            onClick={() => {
                              if (isMaxReached) {
                                toast.error(`Only ${maxStock} items available in stock!`);
                                return;
                              }
                              updateQuantity(item.productId, item.quantity + 1);
                            }}
                            className={cn(
                              "p-1 rounded transition active:scale-90",
                              isMaxReached
                                ? "opacity-40 cursor-not-allowed"
                                : "hover:bg-blue-800"
                            )}
                            aria-label="Increase quantity"
                            title={isMaxReached ? `Only ${maxStock} in stock` : "Add one more"}
                          >
                            <Plus className="h-3 w-3 stroke-[3]" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            removeItem(item.productId);
                            toast.success("Removed from cart");
                          }}
                          className="text-[11px] text-gray-400 hover:text-red-600 transition flex items-center gap-0.5 p-1"
                          title="Remove item"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bill Details Summary Card */}
              <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-gray-900 border-b border-gray-200/60 pb-2">
                  <Receipt className="h-3.5 w-3.5 text-blue-700" />
                  <span>Bill Details</span>
                </div>

                <div className="flex justify-between text-gray-600">
                  <span>Items Total</span>
                  <span className="font-semibold text-gray-900">{formatPrice(total)}</span>
                </div>

                <div className="flex justify-between text-gray-600">
                  <span>Delivery Partner Fee</span>
                  <span>
                    {deliveryCharge === 0 ? (
                      <span className="font-bold text-emerald-700">FREE</span>
                    ) : (
                      formatPrice(deliveryCharge)
                    )}
                  </span>
                </div>

                {totalSavings > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50/80 p-1.5 rounded-lg border border-emerald-100">
                    <span>Your Total Savings</span>
                    <span>-{formatPrice(totalSavings)}</span>
                  </div>
                )}

                <div className="flex justify-between items-baseline border-t border-gray-200/60 pt-2 font-black text-sm text-gray-900">
                  <span>To Pay</span>
                  <span className="text-base font-black text-blue-950">
                    {formatPrice(grandTotal)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Drawer Footer Actions */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 p-3.5 sm:p-4 bg-white shrink-0 space-y-2 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  Total to Pay
                </p>
                <p className="text-lg font-black text-blue-950 leading-tight">
                  {formatPrice(grandTotal)}
                </p>
              </div>

              <Button
                type="button"
                className="flex-1 font-bold shadow-md bg-blue-700 hover:bg-blue-800 text-white gap-2 py-3"
                onClick={goToCheckout}
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleContinueShopping}
                className="flex-1 text-center py-1.5 text-xs font-bold text-gray-600 hover:text-blue-700 hover:bg-gray-50 rounded-lg transition border border-gray-200"
              >
                Continue Shopping
              </button>
              <button
                type="button"
                onClick={goToCart}
                className="flex-1 text-center py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 rounded-lg transition"
              >
                View Full Cart →
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

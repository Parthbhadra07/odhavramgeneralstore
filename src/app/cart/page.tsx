"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProductImage } from "@/components/product-image";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  Zap,
  Sparkles,
  ArrowRight,
  Receipt,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useCartStore } from "@/store/cart-store";
import { formatPrice } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

export default function CartPage() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, getTotal } = useCartStore();
  const total = getTotal();
  const totalItemCount = items.reduce((acc, i) => acc + i.quantity, 0);

  const totalSavings = items.reduce((acc, item) => {
    if (item.product?.mrp && item.product.mrp > (item.product.price ?? 0)) {
      return acc + (item.product.mrp - item.product.price) * item.quantity;
    }
    return acc;
  }, 0);

  const deliveryCharge = total >= 499 ? 0 : 40;
  const grandTotal = total + deliveryCharge;

  if (items.length === 0) {
    return (
      <div className="container mx-auto flex flex-col items-center px-4 py-16 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
          <ShoppingBag className="h-10 w-10 stroke-[1.5]" />
        </div>
        <h1 className="text-2xl font-black text-gray-900">Your cart is empty</h1>
        <p className="mt-1 max-w-sm text-sm text-gray-500">
          Looks like you haven&apos;t added any items to your grocery bag yet.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button
            href="/products"
            className="font-bold shadow-md bg-blue-700 hover:bg-blue-800"
            onClick={() => router.push("/products")}
          >
            Continue Shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl">
      {/* Top Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Shopping Cart
            </h1>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
              {totalItemCount} {totalItemCount === 1 ? "item" : "items"}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Review your groceries before checking out
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
            <Zap className="h-3.5 w-3.5 text-emerald-600 fill-emerald-500" />
            Express Delivery in 15-20 Mins
          </span>
          <Link
            href="/products"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline px-2 py-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Continue Shopping
          </Link>
        </div>
      </div>

      {/* Free Delivery Target Banner */}
      <div className="mb-6 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-blue-50/40 p-4 shadow-2xs">
        {total >= 499 ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
            <Sparkles className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>🎉 Congratulations! You have unlocked <b>FREE Express Delivery</b>!</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-gray-700">
              <span>Shop for <b>{formatPrice(499 - total)}</b> more for FREE Delivery</span>
              <span className="text-xs text-emerald-700 font-black">
                {Math.round((total / 499) * 100)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100/70">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(5, (total / 499) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Products Column */}
        <div className="lg:col-span-2 space-y-3">
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
                  (((item.product!.mrp! - item.product!.price) / item.product!.mrp!) *
                    100)
                )
              : 0;

            return (
              <div
                key={item.productId}
                className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-gray-100 bg-white p-3.5 sm:p-4 shadow-xs hover:border-gray-200 transition-all"
              >
                {/* Image */}
                <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-white p-1 flex items-center justify-center">
                  <ProductImage
                    src={item.product?.image_url}
                    alt={item.product?.name ?? ""}
                    fill
                    fit="contain"
                    className="object-contain p-1"
                  />
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col justify-between min-w-0">
                  <div>
                    <Link
                      href={`/products/view?slug=${encodeURIComponent(item.product?.slug ?? "")}`}
                      className="font-bold text-sm sm:text-base text-gray-900 hover:text-blue-700 transition line-clamp-2"
                    >
                      {item.product?.name}
                    </Link>
                    <p className="text-xs font-medium text-gray-400 mt-0.5">
                      {item.product?.unit ? `1 ${item.product.unit}` : "Standard"}
                    </p>

                    <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                      <span className="text-base font-black text-blue-950">
                        {formatPrice((item.product?.price ?? 0) * item.quantity)}
                      </span>
                      {hasDiscount && (
                        <span className="text-xs text-gray-400 line-through">
                          {formatPrice(item.product!.mrp! * item.quantity)}
                        </span>
                      )}
                      {discountPct > 0 && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          {discountPct}% off
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stepper + Remove */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center rounded-lg bg-blue-700 text-white shadow-2xs gap-1.5 px-1.5 py-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (item.quantity <= 1) {
                            removeItem(item.productId);
                            toast.success("Removed from cart");
                          } else {
                            updateQuantity(item.productId, item.quantity - 1);
                          }
                        }}
                        className="p-1 hover:bg-blue-800 rounded transition active:scale-90"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5 stroke-[3]" />
                      </button>
                      <span className="min-w-4 text-center text-xs font-black">
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
                      >
                        <Plus className="h-3.5 w-3.5 stroke-[3]" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        removeItem(item.productId);
                        toast.success("Removed from cart");
                      }}
                      className="text-gray-400 hover:text-red-600 transition p-1"
                      title="Remove from cart"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bill Summary Column */}
        <div className="h-fit space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 font-black text-base text-gray-900 border-b border-gray-100 pb-3">
              <Receipt className="h-4 w-4 text-blue-700" />
              <h2>Bill Details</h2>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Items Subtotal</span>
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
                <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 p-2 rounded-xl border border-emerald-100 text-xs">
                  <span>Total Savings on MRP</span>
                  <span>-{formatPrice(totalSavings)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-baseline border-t border-gray-100 pt-3 text-base font-black text-gray-900">
              <span>To Pay</span>
              <span className="text-xl font-black text-blue-950">
                {formatPrice(grandTotal)}
              </span>
            </div>

            <Button
              href="/checkout"
              className="w-full font-bold shadow-md bg-blue-700 hover:bg-blue-800 text-white gap-2 py-3"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              href="/products"
              className="w-full text-xs font-bold border-gray-200 text-gray-700 hover:bg-gray-50"
              onClick={() => router.push("/products")}
            >
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

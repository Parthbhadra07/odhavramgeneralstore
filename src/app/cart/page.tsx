"use client";

import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { formatPrice } from "@/utils/format";
import { Button } from "@/components/ui/button";

export default function CartPage() {
  const { items, updateQuantity, removeItem, getTotal } = useCartStore();
  const total = getTotal();

  if (items.length === 0) {
    return (
      <div className="container mx-auto flex flex-col items-center px-4 py-16 text-center">
        <ShoppingBag className="mb-4 h-16 w-16 text-gray-300" />
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-gray-600">Add some fresh groceries to get started!</p>
        <Button href="/products" className="mt-6">
          Start Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Shopping Cart</h1>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex gap-4 rounded-xl border bg-white p-4 shadow-sm"
            >
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                <ProductImage
                  src={item.product?.image_url}
                  alt={item.product?.name ?? ""}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <Link
                    href={`/products/view?slug=${encodeURIComponent(item.product?.slug ?? "")}`}
                    className="font-medium hover:text-green-700"
                  >
                    {item.product?.name}
                  </Link>
                  <p className="text-green-700 font-semibold">
                    {formatPrice(item.product?.price ?? 0)}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(item.productId, item.quantity - 1)
                      }
                      className="rounded border p-1.5 hover:bg-gray-50"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(item.productId, item.quantity + 1)
                      }
                      className="rounded border p-1.5 hover:bg-gray-50"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="h-fit rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>
          <div className="space-y-2 border-b pb-4 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Delivery</span>
              <span>{total >= 499 ? "FREE" : formatPrice(40)}</span>
            </div>
          </div>
          <div className="flex justify-between py-4 text-lg font-bold">
            <span>Total</span>
            <span className="text-green-700">
              {formatPrice(total >= 499 ? total : total + 40)}
            </span>
          </div>
          <Button href="/checkout" className="w-full">
            Proceed to Checkout
          </Button>
        </div>
      </div>
    </div>
  );
}

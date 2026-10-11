"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { emptyCartAfterOrder, useCartStore } from "@/store/cart-store";
import { useAuth } from "@/hooks/use-auth";
import { formatPrice } from "@/utils/format";
import { CheckoutForm } from "@/components/checkout-form";
import { Button } from "@/components/ui/button";
import { addressService } from "@/services/address.service";
import { orderService } from "@/services/order.service";
import { OnlinePaymentQr } from "@/components/checkout/online-payment-qr";
import { ProductImage } from "@/components/product-image";
import type { Address } from "@/types/database";
import type { AddressInput } from "@/lib/validators";
import { cn } from "@/utils/cn";
import { calculateDeliveryCharge } from "@/utils/order-pricing";
import { useCartHydrated } from "@/hooks/use-cart-hydrated";
import {
  Zap,
  Sparkles,
  MapPin,
  Home,
  ArrowLeft,
  ArrowRight,
  Banknote,
  QrCode,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Receipt,
  Plus,
  ShieldCheck,
} from "lucide-react";

type PaymentMethod = "cod" | "qr";

export default function CheckoutPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const cartHydrated = useCartHydrated();
  const { items, getTotal, setOpen } = useCartStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [utr, setUtr] = useState("");
  const [showItemsList, setShowItemsList] = useState(true);

  const subtotal = getTotal();
  const delivery = calculateDeliveryCharge(subtotal);
  const total = subtotal + delivery;
  const totalItemCount = items.reduce((acc, i) => acc + i.quantity, 0);

  const totalSavings = items.reduce((acc, item) => {
    if (item.product?.mrp && item.product.mrp > (item.product.price ?? 0)) {
      return acc + (item.product.mrp - item.product.price) * item.quantity;
    }
    return acc;
  }, 0);

  useEffect(() => {
    setOpen(false);
  }, [setOpen]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login?redirect=/checkout");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      addressService.getByUser(user.id).then((addrs) => {
        setAddresses(addrs);
        if (addrs.length === 1) {
          setSelectedAddress(addrs[0].id);
        }
      });
    }
  }, [user]);

  const handleSaveAddress = async (data: AddressInput) => {
    if (!user) return;
    const address = await addressService.create(user.id, data);
    setAddresses((prev) => [...prev, address]);
    setSelectedAddress(address.id);
    setShowNewAddress(false);
    toast.success("Address saved successfully");
  };

  const placeOrder = async (method: PaymentMethod) => {
    if (!user || !selectedAddress || items.length === 0) {
      toast.error("Please select a delivery address");
      return;
    }

    setPlacing(true);
    try {
      const notes =
        method === "qr" && utr.trim() ? `UPI UTR: ${utr.trim()}` : undefined;

      const dbOrder = await orderService.createOrder({
        userId: user.id,
        addressId: selectedAddress,
        totalAmount: total,
        deliveryCharge: delivery,
        paymentMethod: method,
        customerName: profile?.name || user.email?.split("@")[0] || "Customer",
        customerPhone: profile?.phone || "",
        notes,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          price: i.product?.price ?? 0,
        })),
      });
      emptyCartAfterOrder();

      if (method === "cod") {
        toast.success("Order placed successfully! Pay cash on delivery.");
      } else {
        toast.success("Order placed! We will confirm once payment is verified.");
      }

      router.push(
        `/checkout/success?order=${dbOrder.id}&number=${encodeURIComponent(dbOrder.order_number ?? "")}`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to place order";
      toast.error(message, { duration: 6000 });
      console.error("Place order error:", err);
    } finally {
      setPlacing(false);
    }
  };

  if (!cartHydrated || authLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="mt-3 text-sm text-gray-500">Loading checkout...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto flex flex-col items-center px-4 py-16 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
          <ShoppingBag className="h-10 w-10 stroke-[1.5]" />
        </div>
        <h1 className="text-2xl font-black text-gray-900">Your cart is empty</h1>
        <p className="mt-1 max-w-sm text-sm text-gray-500">
          Add items from our catalog to proceed with checkout.
        </p>
        <div className="mt-6">
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
    <div className="min-h-screen bg-gray-50/50 pb-28 sm:pb-12">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl">
        {/* Top Modern Header Matching Catalogue */}
        <div className="mb-4 sm:mb-6 rounded-2xl bg-white p-3.5 sm:p-5 border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/cart"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
              aria-label="Back to cart"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black text-gray-900 tracking-tight">
                  Checkout
                </h1>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                  {totalItemCount} items
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500">
                Confirm delivery address &amp; select payment method
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 border border-emerald-200">
              <Zap className="h-3 w-3 text-emerald-600 fill-emerald-500" />
              15-20 Mins Delivery
            </span>
            <Link
              href="/products"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline px-2 py-1"
            >
              Continue Shopping →
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Main Checkout Options (Address & Payment) */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* 1. Delivery Address Card */}
            <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm sm:text-base font-black text-gray-900">
                    1. Delivery Address
                  </h2>
                </div>

                {!showNewAddress && (
                  <button
                    type="button"
                    onClick={() => setShowNewAddress(true)}
                    className="flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add New</span>
                  </button>
                )}
              </div>

              {addresses.length === 0 && !showNewAddress && (
                <div className="mb-4 rounded-xl bg-amber-50 p-3.5 text-xs text-amber-800 border border-amber-200 flex items-center gap-2">
                  <span>Please add a delivery address to place your grocery order.</span>
                </div>
              )}

              {/* Saved Addresses List */}
              <div className="space-y-2.5">
                {addresses.map((addr) => {
                  const isSelected = selectedAddress === addr.id;

                  return (
                    <label
                      key={addr.id}
                      className={cn(
                        "relative flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3.5 transition-all",
                        isSelected
                          ? "border-emerald-600 bg-emerald-50/40 shadow-xs ring-1 ring-emerald-500/20"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      )}
                    >
                      <input
                        type="radio"
                        name="address"
                        value={addr.id}
                        checked={isSelected}
                        onChange={() => setSelectedAddress(addr.id)}
                        className="mt-0.5 h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1 font-bold text-xs sm:text-sm text-gray-900">
                            <Home className="h-3.5 w-3.5 text-gray-500" />
                            {addr.address_line}
                          </span>
                          {isSelected && (
                            <span className="rounded-full bg-emerald-600 px-2 py-0.2 text-[10px] font-black text-white">
                              Deliver Here
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-600">
                          {addr.city}, {addr.state} - {addr.postal_code}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      )}
                    </label>
                  );
                })}
              </div>

              {/* New Address Form */}
              {showNewAddress && (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50/60 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800">
                      Enter New Delivery Address
                    </span>
                    {addresses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowNewAddress(false)}
                        className="text-xs text-gray-500 hover:text-gray-800 underline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <CheckoutForm onSubmit={handleSaveAddress} />
                </div>
              )}
            </section>

            {/* 2. Payment Method Card */}
            <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-800">
                  <Banknote className="h-4 w-4" />
                </div>
                <h2 className="text-sm sm:text-base font-black text-gray-900">
                  2. Payment Method
                </h2>
              </div>

              <div className="space-y-3">
                {/* Cash on Delivery */}
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3.5 transition-all",
                    paymentMethod === "cod"
                      ? "border-emerald-600 bg-emerald-50/40 shadow-xs ring-1 ring-emerald-500/20"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="cod"
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                    className="mt-0.5 h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-emerald-700" />
                      <p className="font-bold text-xs sm:text-sm text-gray-900">
                        Cash on Delivery (COD)
                      </p>
                      <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[10px] font-bold">
                        Most Popular
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Pay in cash to our delivery partner when groceries arrive at your doorstep.
                    </p>
                  </div>
                  {paymentMethod === "cod" && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  )}
                </label>

                {/* Online Payment via UPI QR */}
                <div
                  className={cn(
                    "rounded-2xl border-2 p-3.5 transition-all",
                    paymentMethod === "qr"
                      ? "border-blue-600 bg-blue-50/40 shadow-xs ring-1 ring-blue-500/20"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="radio"
                      name="payment"
                      value="qr"
                      checked={paymentMethod === "qr"}
                      onChange={() => setPaymentMethod("qr")}
                      className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-blue-700" />
                        <p className="font-bold text-xs sm:text-sm text-gray-900">
                          Online UPI Payment (QR / Google Pay / PhonePe / Paytm)
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Scan our store QR code or pay instantly with any UPI app on your phone.
                      </p>
                    </div>
                    {paymentMethod === "qr" && (
                      <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                    )}
                  </label>

                  {paymentMethod === "qr" && (
                    <div className="mt-4 pt-3 border-t border-blue-200/60">
                      <OnlinePaymentQr
                        amount={total}
                        utr={utr}
                        onUtrChange={setUtr}
                      />
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* 3. Order Items Review Accordion (Mobile & Desktop) */}
            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
              <button
                type="button"
                onClick={() => setShowItemsList(!showItemsList)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-gray-900">
                      Items in this Order ({totalItemCount})
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Tap to {showItemsList ? "hide" : "review"} items
                    </p>
                  </div>
                </div>
                {showItemsList ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>

              {showItemsList && (
                <div className="mt-4 space-y-2.5 border-t border-gray-100 pt-3">
                  {items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between gap-3 text-xs py-1"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-white p-0.5">
                          <ProductImage
                            src={item.product?.image_url}
                            alt={item.product?.name ?? "Item"}
                            fill
                            fit="contain"
                            className="object-contain p-0.5"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate">
                            {item.product?.name}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            Qty: <b className="text-gray-900">{item.quantity}</b> ×{" "}
                            {formatPrice(item.product?.price ?? 0)}
                          </p>
                        </div>
                      </div>
                      <span className="font-black text-blue-950 shrink-0">
                        {formatPrice((item.product?.price ?? 0) * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Bill Details & Order Placement Column */}
          <div className="h-fit space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2 font-black text-sm sm:text-base text-gray-900 border-b border-gray-100 pb-2.5">
                <Receipt className="h-4 w-4 text-blue-700" />
                <h2>Order Summary</h2>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Items Subtotal</span>
                  <span className="font-semibold text-gray-900">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery Partner Fee</span>
                  <span>
                    {delivery === 0 ? (
                      <span className="font-bold text-emerald-700">FREE</span>
                    ) : (
                      formatPrice(delivery)
                    )}
                  </span>
                </div>

                {totalSavings > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 p-2 rounded-xl border border-emerald-100 text-xs">
                    <span>Total Savings</span>
                    <span>-{formatPrice(totalSavings)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-baseline border-t border-gray-100 pt-3 text-sm font-black text-gray-900">
                <span>Total Amount</span>
                <span className="text-xl font-black text-blue-950">
                  {formatPrice(total)}
                </span>
              </div>

              {/* Desktop Place Order Button */}
              <div className="hidden sm:block pt-2">
                <Button
                  className="w-full font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white gap-2 py-3"
                  loading={placing}
                  onClick={() => placeOrder(paymentMethod)}
                  disabled={!selectedAddress}
                >
                  <span>
                    {paymentMethod === "cod"
                      ? "Place Order (Cash on Delivery)"
                      : "Confirm & Place Order (Paid via UPI)"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>

                <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>100% Safe &amp; Verified Delivery</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Mobile Bottom Checkout Bar (Thumb friendly quick commerce) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 px-4 py-3 shadow-2xl flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
            To Pay
          </p>
          <p className="text-lg font-black text-blue-950 leading-tight">
            {formatPrice(total)}
          </p>
        </div>

        <Button
          className="flex-1 font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white gap-2 py-2.5 text-xs"
          loading={placing}
          onClick={() => placeOrder(paymentMethod)}
          disabled={!selectedAddress}
        >
          <span>
            {paymentMethod === "cod"
              ? "Place Order (COD)"
              : "Confirm & Pay (UPI)"}
          </span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

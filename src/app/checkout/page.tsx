"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { emptyCartAfterOrder, useCartStore } from "@/store/cart-store";
import { useAuth } from "@/hooks/use-auth";
import { formatPrice } from "@/utils/format";
import { CheckoutForm } from "@/components/checkout-form";
import { Button } from "@/components/ui/button";
import { addressService } from "@/services/address.service";
import { orderService } from "@/services/order.service";
import { OnlinePaymentQr } from "@/components/checkout/online-payment-qr";
import type { Address } from "@/types/database";
import type { AddressInput } from "@/lib/validators";
import { cn } from "@/utils/cn";
import { calculateDeliveryCharge } from "@/utils/order-pricing";
import { useCartHydrated } from "@/hooks/use-cart-hydrated";

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

  const subtotal = getTotal();
  const delivery = calculateDeliveryCharge(subtotal);
  const total = subtotal + delivery;

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
    toast.success("Address saved");
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
        toast.success("Order placed! Pay on delivery.");
      } else {
        toast.success("Order placed! We will confirm after payment verification.");
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
        <p className="text-gray-600">Loading checkout...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-gray-600">Your cart is empty</p>
        <Button href="/products" className="mt-4">
          Continue Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Checkout</h1>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Delivery Address</h2>
            {addresses.length === 0 && !showNewAddress && (
              <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Add a delivery address to place your order.
              </p>
            )}
            {addresses.map((addr) => (
              <label
                key={addr.id}
                className={cn(
                  "mb-3 flex cursor-pointer rounded-lg border p-4 transition-colors",
                  selectedAddress === addr.id
                    ? "border-green-600 bg-green-50"
                    : "hover:border-gray-300"
                )}
              >
                <input
                  type="radio"
                  name="address"
                  value={addr.id}
                  checked={selectedAddress === addr.id}
                  onChange={() => setSelectedAddress(addr.id)}
                  className="mr-3 mt-1"
                />
                <div>
                  <p>{addr.address_line}</p>
                  <p className="text-sm text-gray-600">
                    {addr.city}, {addr.state} - {addr.postal_code}
                  </p>
                </div>
              </label>
            ))}
            {!showNewAddress ? (
              <Button variant="outline" onClick={() => setShowNewAddress(true)}>
                + Add New Address
              </Button>
            ) : (
              <CheckoutForm onSubmit={handleSaveAddress} />
            )}
          </section>

          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Payment Method</h2>
            <div className="space-y-4">
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                  paymentMethod === "cod"
                    ? "border-green-600 bg-green-50"
                    : "hover:border-gray-300"
                )}
              >
                <input
                  type="radio"
                  name="payment"
                  value="cod"
                  checked={paymentMethod === "cod"}
                  onChange={() => setPaymentMethod("cod")}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-gray-900">Cash on Delivery</p>
                  <p className="text-sm text-gray-600">
                    Pay in cash when your groceries arrive at your doorstep.
                  </p>
                </div>
              </label>

              <div
                className={cn(
                  "rounded-lg border p-4 transition-colors",
                  paymentMethod === "qr"
                    ? "border-emerald-600 bg-emerald-50/40"
                    : "hover:border-gray-300"
                )}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="payment"
                    value="qr"
                    checked={paymentMethod === "qr"}
                    onChange={() => setPaymentMethod("qr")}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      Online Payment (UPI QR / Google Pay / PhonePe / Paytm)
                    </p>
                    <p className="text-sm text-gray-600">
                      Scan store QR code or pay directly with any UPI App.
                    </p>
                  </div>
                </label>

                {paymentMethod === "qr" && (
                  <div className="mt-4 pt-2">
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
        </div>

        <div className="h-fit rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>
          <ul className="mb-4 space-y-2 border-b pb-4 text-sm">
            {items.map((item) => (
              <li key={item.productId} className="flex justify-between">
                <span className="truncate pr-2">
                  {item.product?.name} × {item.quantity}
                </span>
                <span>
                  {formatPrice((item.product?.price ?? 0) * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery</span>
              <span>{delivery === 0 ? "FREE" : formatPrice(delivery)}</span>
            </div>
          </div>
          <div className="mt-4 flex justify-between border-t pt-4 text-lg font-bold">
            <span>Total</span>
            <span className="text-green-700">{formatPrice(total)}</span>
          </div>
          <Button
            className="mt-6 w-full"
            loading={placing}
            onClick={() => placeOrder(paymentMethod)}
            disabled={!selectedAddress}
          >
            {paymentMethod === "cod"
              ? "Place Order (Cash on Delivery)"
              : "Confirm & Place Order (Paid via UPI)"}
          </Button>
        </div>
      </div>
    </div>
  );
}

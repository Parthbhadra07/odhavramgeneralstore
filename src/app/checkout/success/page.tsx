"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Phone } from "lucide-react";
import { orderService } from "@/services/order.service";
import { formatPrice, formatDate } from "@/utils/format";
import {
  APP_NAME,
  STORE_PHONE,
  STORE_PHONE_TEL,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { CallStoreButton } from "@/components/call-store-button";
import { Button } from "@/components/ui/button";
import type { Order } from "@/types/database";

export default function OrderSuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (orderId) orderService.getById(orderId).then(setOrder);
  }, [orderId]);

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p>Loading order details...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-lg px-4 py-12">
      <div className="rounded-2xl border bg-white p-8 text-center shadow-lg">
        <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-600" />
        <h1 className="text-2xl font-bold text-gray-900">Thank You!</h1>
        <p className="mt-2 text-gray-600">
          Your order has been placed at {APP_NAME}.
        </p>

        <div className="mt-6 space-y-3 rounded-xl bg-green-50 p-4 text-left text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Order ID</span>
            <span className="font-mono font-bold text-green-800">
              {order.order_number ?? order.id.slice(0, 8)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Amount</span>
            <span className="font-semibold">{formatPrice(order.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Date & Time</span>
            <span>{formatDate(order.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Payment</span>
            <span>
              {PAYMENT_METHOD_LABELS[order.payment_method ?? "cod"] ??
                order.payment_method}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Status</span>
            <OrderStatusBadge status={order.order_status} />
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-600">
          Questions? Call us at{" "}
          <a href={STORE_PHONE_TEL} className="font-medium text-green-700">
            {STORE_PHONE}
          </a>
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button href={`/track-order?id=${order.order_number}`}>Track Order</Button>
          <Button variant="outline" href={`/orders/${order.id}/invoice`}>
            Download Invoice
          </Button>
        </div>
        <CallStoreButton className="mt-4 w-full justify-center sm:hidden" />
        <Link href="/products" className="mt-4 block text-sm text-green-700 hover:underline">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

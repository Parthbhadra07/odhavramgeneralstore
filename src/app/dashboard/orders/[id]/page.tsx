"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { orderService } from "@/services/order.service";
import { OrderTimeline } from "@/features/orders/order-timeline";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatPrice, formatDate } from "@/utils/format";
import { orderItemsSubtotal, resolveDeliveryCharge } from "@/utils/order-pricing";
import { PAYMENT_METHOD_LABELS, STORE_PHONE, STORE_PHONE_TEL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import type { Order } from "@/types/database";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (id) orderService.getById(id).then(setOrder);
  }, [id]);

  if (!order) return <p>Loading...</p>;

  const items = order.order_items ?? [];
  const subtotal = orderItemsSubtotal(items);
  const delivery = resolveDeliveryCharge(
    subtotal,
    order.total_amount,
    order.delivery_charge
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-gray-500">Order ID</p>
            <h1 className="font-mono text-xl font-bold text-green-800">
              {order.order_number}
            </h1>
          </div>
          <OrderStatusBadge status={order.order_status} />
        </div>
        <p className="text-sm text-gray-600">Placed on {formatDate(order.created_at)}</p>
        <p className="mt-1 text-sm">
          Payment: {PAYMENT_METHOD_LABELS[order.payment_method ?? "cod"]}
        </p>

        <div className="my-6">
          <h2 className="mb-3 font-semibold">Order Progress</h2>
          <OrderTimeline
            currentStatus={order.order_status}
            history={order.tracking_history}
          />
        </div>

        {order.addresses && (
          <div className="mb-6 rounded-lg bg-gray-50 p-4">
            <h3 className="mb-1 font-medium">Delivery Address</h3>
            <p className="text-sm text-gray-600">
              {order.addresses.address_line}, {order.addresses.city},{" "}
              {order.addresses.state} - {order.addresses.postal_code}
            </p>
          </div>
        )}

        <h3 className="mb-3 font-semibold">Items</h3>
        <ul className="space-y-3">
          {order.order_items?.map((item) => (
            <li key={item.id} className="flex gap-3 border-b pb-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                <ProductImage
                  src={item.products?.image_url}
                  alt={item.products?.name ?? ""}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1">
                <p className="font-medium">{item.products?.name}</p>
                <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
              </div>
              <p className="font-semibold">{formatPrice(item.price * item.quantity)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-2 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Delivery</span>
            <span>{delivery === 0 ? "FREE" : formatPrice(delivery)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-green-700">{formatPrice(order.total_amount)}</span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button href={`/orders/${order.id}/invoice`}>Download Invoice</Button>
          <Button variant="outline" href={`/track-order?id=${order.order_number}`}>
            Track Order
          </Button>
          <a href={STORE_PHONE_TEL} className="text-sm text-green-700 hover:underline self-center">
            Call store: {STORE_PHONE}
          </a>
        </div>
      </div>
    </div>
  );
}

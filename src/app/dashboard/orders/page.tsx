"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { orderService } from "@/services/order.service";
import { formatPrice, formatDate } from "@/utils/format";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import type { Order } from "@/types/database";

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      orderService.getByUser(user.id).then(setOrders).finally(() => setLoading(false));
    }
  }, [user]);

  if (loading) return <p>Loading orders...</p>;

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-2xl font-bold">My Orders</h1>
      {orders.length === 0 ? (
        <p className="text-gray-600">No orders yet.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-lg border p-4 transition-colors hover:border-green-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-sm font-bold text-green-800">
                    {order.order_number ?? order.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                </div>
                <OrderStatusBadge status={order.order_status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-green-700">
                  {formatPrice(order.total_amount)}
                </span>
                <span className="text-xs text-gray-500">
                  {PAYMENT_METHOD_LABELS[order.payment_method ?? "cod"]}
                </span>
              </div>
              <div className="mt-3 flex gap-3 text-sm">
                <Link
                  href={`/dashboard/orders/view?id=${order.id}`}
                  className="font-medium text-green-700 hover:underline"
                >
                  View Details
                </Link>
                <Link
                  href={`/track-order?id=${order.order_number}`}
                  className="text-gray-600 hover:underline"
                >
                  Track
                </Link>
                <Link
                  href={`/orders/invoice?id=${order.id}`}
                  className="inline-flex items-center gap-1 text-gray-600 hover:underline"
                >
                  <FileText className="h-3 w-3" /> Invoice
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

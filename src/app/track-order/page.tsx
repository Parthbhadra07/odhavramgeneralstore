"use client";

import { useState, FormEvent, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { orderService } from "@/services/order.service";
import { OrderTimeline } from "@/features/orders/order-timeline";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatPrice, formatDate } from "@/utils/format";
import { APP_NAME, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Order } from "@/types/database";

export default function TrackOrderPage() {
  const searchParams = useSearchParams();
  const [orderId, setOrderId] = useState(searchParams.get("id") ?? "");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const track = async (id?: string) => {
    const num = (id ?? orderId).trim().toUpperCase();
    if (!num) return;
    setLoading(true);
    setError("");
    setOrder(null);
    try {
      const result = await orderService.getByOrderNumber(num);
      if (!result) {
        const rpc = await orderService.trackByOrderNumber(num);
        if (rpc?.order) {
          setOrder({
            ...rpc.order,
            order_items: rpc.items as Order["order_items"],
            tracking_history: rpc.history as Order["tracking_history"],
          });
        } else {
          setError("Order not found. Please check your Order ID.");
        }
      } else {
        setOrder(result);
      }
    } catch {
      setError("Could not find order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setOrderId(id);
      track(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    track();
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Track Your Order</h1>
      <p className="mb-8 text-gray-600">
        Enter your Order ID from {APP_NAME} (e.g. OGS-2026-000001)
      </p>

      <form onSubmit={handleSubmit} className="mb-8 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="OGS-2026-000001"
            className="w-full rounded-lg border py-2.5 pl-10 pr-4 text-sm uppercase focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
          />
        </div>
        <Button type="submit" loading={loading}>
          Track
        </Button>
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 p-4 text-center text-red-700">{error}</p>
      )}

      {order && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm text-gray-500">Order ID</p>
              <p className="font-mono text-lg font-bold text-green-800">
                {order.order_number}
              </p>
            </div>
            <OrderStatusBadge status={order.order_status} />
          </div>

          <div className="mb-6 grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-gray-500">Amount: </span>
              <strong>{formatPrice(order.total_amount)}</strong>
            </p>
            <p>
              <span className="text-gray-500">Placed: </span>
              {formatDate(order.created_at)}
            </p>
            <p>
              <span className="text-gray-500">Payment: </span>
              {PAYMENT_METHOD_LABELS[order.payment_method ?? "cod"]}
            </p>
          </div>

          <h3 className="mb-4 font-semibold">Order Progress</h3>
          <OrderTimeline
            currentStatus={order.order_status}
            history={order.tracking_history}
          />
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Eye, Printer } from "lucide-react";
import { orderService } from "@/services/order.service";
import { useAdminOrderNotifications } from "@/hooks/use-admin-order-notifications";
import { formatPrice, formatDate } from "@/utils/format";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import type { Order } from "@/types/database";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(() => {
    orderService
      .getAll({ status, search, dateFrom, dateTo })
      .then(setOrders);
  }, [status, search, dateFrom, dateTo]);

  const { newOrderCount } = useAdminOrderNotifications(load);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Order Management</h1>
          {newOrderCount > 0 && (
            <p className="text-sm font-medium text-amber-600">
              🔔 {newOrderCount} new order(s) received
            </p>
          )}
        </div>
        <Button variant="outline" onClick={() => orderService.markOrdersSeen().then(load)}>
          Mark all seen
        </Button>
      </div>

      <div className="mb-6 grid gap-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Order ID..."
            className="w-full rounded-lg border py-2 pl-10 pr-3 text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="all">All Status</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <div className="-mx-4 overflow-x-auto rounded-xl border bg-white shadow-sm sm:mx-0">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Order ID</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Total</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                className={cn(
                  "border-b transition-colors",
                  order.order_status === "received" && "bg-amber-50/80"
                )}
              >
                <td className="px-4 py-3 font-mono text-xs font-semibold">
                  {order.order_number ?? order.id.slice(0, 8)}
                </td>
                <td className="px-4 py-3">
                  {order.customer_name ?? order.users?.name ?? "—"}
                </td>
                <td className="px-4 py-3">{order.customer_phone ?? "—"}</td>
                <td className="px-4 py-3 font-medium">
                  {formatPrice(order.total_amount)}
                </td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={order.order_status} />
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDate(order.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/orders/view?id=${order.id}`}
                    className="mr-2 inline-flex text-green-700 hover:text-green-900"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/orders/invoice?id=${order.id}`}
                    className="inline-flex text-gray-600 hover:text-gray-900"
                  >
                    <Printer className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <p className="p-8 text-center text-gray-500">No orders found.</p>
        )}
      </div>
    </div>
  );
}

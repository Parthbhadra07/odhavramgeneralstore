"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Truck,
  Package,
  ArrowRight,
  ExternalLink,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { Modal } from "@/components/admin/modal";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatPrice, formatDate } from "@/utils/format";
import type { OrderStatus } from "@/types/database";

export interface OnlineOrderSummary {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  order_status: string;
  created_at: string;
  payment_status?: string;
  subtotal: number;
  delivery_charge: number;
  total_amount: number;
}

interface OnlineOrdersBreakdownModalProps {
  open: boolean;
  onClose: () => void;
  todaySales: number;
  todayItemsSubtotal: number;
  todayDeliveryCharges: number;
  todayOrders: OnlineOrderSummary[];
  monthlySales?: number;
  monthlyItemsSubtotal?: number;
  monthlyDeliveryCharges?: number;
}

export function OnlineOrdersBreakdownModal({
  open,
  onClose,
  todaySales,
  todayItemsSubtotal,
  todayDeliveryCharges,
  todayOrders,
  monthlySales,
  monthlyItemsSubtotal,
  monthlyDeliveryCharges,
}: OnlineOrdersBreakdownModalProps) {
  const [period, setPeriod] = useState<"today" | "month">("today");

  const isToday = period === "today";
  const displayItems = isToday
    ? todayItemsSubtotal
    : monthlyItemsSubtotal ?? todayItemsSubtotal;
  const displayDelivery = isToday
    ? todayDeliveryCharges
    : monthlyDeliveryCharges ?? todayDeliveryCharges;
  const displayTotal = isToday ? todaySales : monthlySales ?? todaySales;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Online Orders & Delivery Charge Breakdown"
      size="xl"
    >
      <div className="p-4 sm:p-6 space-y-5">
        {/* Header Tabs: Today vs This Month */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <p className="text-xs text-gray-500">
              Delivery charges are tracked separately from item product revenue.
            </p>
          </div>
          <div className="flex rounded-lg bg-gray-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPeriod("today")}
              className={`rounded-md px-3 py-1.5 transition ${
                isToday
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setPeriod("month")}
              className={`rounded-md px-3 py-1.5 transition ${
                !isToday
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              This Month
            </button>
          </div>
        </div>

        {/* 3 Metric Cards: Items Subtotal + Delivery Charges = Total Sales */}
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Card 1: Items Subtotal */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                1. Product Sales
              </span>
              <div className="rounded-lg bg-emerald-600 p-1.5 text-white">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-emerald-900">
              {formatPrice(displayItems)}
            </p>
            <p className="mt-1 text-[11px] text-emerald-700 font-medium">
              Net value of items sold online
            </p>
          </div>

          {/* Card 2: Delivery Charges */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                2. Delivery Charges
              </span>
              <div className="rounded-lg bg-blue-600 p-1.5 text-white">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-blue-900">
              {formatPrice(displayDelivery)}
            </p>
            <p className="mt-1 text-[11px] text-blue-700 font-medium">
              Calculated & collected separately
            </p>
          </div>

          {/* Card 3: Grand Total */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Total Online Revenue
              </span>
              <div className="rounded-lg bg-gray-900 p-1.5 text-white">
                <ShoppingCart className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-gray-900">
              {formatPrice(displayTotal)}
            </p>
            <p className="mt-1 text-[11px] text-gray-500 font-medium">
              Items ({formatPrice(displayItems)}) + Delivery ({formatPrice(displayDelivery)})
            </p>
          </div>
        </div>

        {/* Calculation Banner */}
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-900 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold">💡 Accounting Equation:</span>
            <span>
              Items Subtotal: <strong>{formatPrice(displayItems)}</strong> + Delivery Charges:{" "}
              <strong>{formatPrice(displayDelivery)}</strong> = Grand Total:{" "}
              <strong>{formatPrice(displayTotal)}</strong>
            </span>
          </div>
          <span className="text-[11px] font-semibold text-blue-700">
            {todayOrders.length} order(s) today
          </span>
        </div>

        {/* Orders Table */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Today&apos;s Online Orders Breakdown
            </h4>
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-900"
            >
              All Orders <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {todayOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-gray-500 text-xs">
              <ShoppingCart className="mx-auto h-8 w-8 text-gray-300 mb-2" />
              No online orders received today yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full min-w-[34rem] text-xs">
                <thead className="border-b bg-gray-50 text-gray-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 text-left">Order #</th>
                    <th className="py-2.5 px-3 text-left">Customer</th>
                    <th className="py-2.5 px-3 text-left">Status</th>
                    <th className="py-2.5 px-3 text-right">Items Subtotal</th>
                    <th className="py-2.5 px-3 text-right">Delivery Charge</th>
                    <th className="py-2.5 px-3 text-right">Order Total</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {todayOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-green-800">
                        {o.order_number}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-gray-900">{o.customer_name}</div>
                        {o.customer_phone && (
                          <div className="text-[11px] text-gray-500">{o.customer_phone}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <OrderStatusBadge status={o.order_status as OrderStatus} />
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-gray-800">
                        {formatPrice(o.subtotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {o.delivery_charge === 0 ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            FREE
                          </span>
                        ) : (
                          <span className="font-semibold text-blue-700">
                            +{formatPrice(o.delivery_charge)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                        {formatPrice(o.total_amount)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Link
                          href={`/admin/orders/view?id=${o.id}`}
                          className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-green-50 hover:text-green-800 transition"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Orders placed via the online store are synchronized in real-time.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            <Link
              href="/admin/orders"
              className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 transition"
            >
              Go to Order Management →
            </Link>
          </div>
        </div>
      </div>
    </Modal>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Eye, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { orderService } from "@/services/order.service";
import { useAdminOrderNotifications } from "@/hooks/use-admin-order-notifications";
import { formatPrice, formatDate } from "@/utils/format";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { printSystematicDocument } from "@/utils/document-print";
import type { Order } from "@/types/database";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    orderService
      .getAll({ status, search, dateFrom, dateTo })
      .then(setOrders);
  }, [status, search, dateFrom, dateTo]);

  const handleDeleteOrder = async () => {
    if (!deletingOrder) return;
    setDeleting(true);
    try {
      await orderService.deleteOrder(deletingOrder.id, { restoreStock: true });
      toast.success(
        `Order #${deletingOrder.order_number || deletingOrder.id.slice(0, 8)} deleted and stock restored.`
      );
      setDeletingOrder(null);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete order");
    } finally {
      setDeleting(false);
    }
  };

  const { newOrderCount } = useAdminOrderNotifications(load);

  useEffect(() => {
    load();
  }, [load]);

  const printOrdersRegister = () => {
    printSystematicDocument(
      {
        docTitle: "ONLINE STORE ORDERS AUDIT REGISTER",
        docBadge: "DISPATCH & FULFILLMENT COPY",
        docDate: new Date().toLocaleDateString("en-IN", { dateStyle: "medium" }),
        metadata: [
          { label: "Status Filter", value: status === "all" ? "All Orders" : ORDER_STATUS_LABELS[status] || status },
          { label: "Orders Count", value: `${orders.length} orders` },
        ],
        columns: [
          { header: "#", width: "35px", align: "center" },
          { header: "Order #", align: "left" },
          { header: "Customer Name", align: "left" },
          { header: "Phone", align: "left" },
          { header: "Status", align: "center" },
          { header: "Date", align: "left" },
          { header: "Delivery Fee", align: "right" },
          { header: "Total Value", align: "right" },
        ],
        rows: orders.map((o, idx) => ({
          cells: [
            idx + 1,
            o.order_number ?? o.id.slice(0, 8),
            o.customer_name ?? o.users?.name ?? "Customer",
            o.customer_phone ?? "—",
            ORDER_STATUS_LABELS[o.order_status] || o.order_status,
            formatDate(o.created_at),
            Number(o.delivery_charge || 0) === 0 ? "FREE" : formatPrice(o.delivery_charge),
            formatPrice(o.total_amount),
          ],
        })),
        summaryRows: [
          { label: "Total Filtered Orders", value: `${orders.length} orders`, isBold: true },
          { label: "Total Order Volume Value", value: formatPrice(orders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0)), isBold: true, isHighlight: true },
        ],
        notes: [
          "Complete dispatch and online fulfillment registry for Odhavram General Store e-commerce orders.",
        ],
        signatories: ["Fulfillment Officer", "Delivery Coordinator", "Store Manager Sign"],
      },
      "Online-Orders-Register"
    );
  };

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
        <div className="flex flex-wrap items-center gap-2">
          {orders.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={printOrdersRegister}
              className="gap-1.5 font-bold"
            >
              <Printer className="h-4 w-4 text-emerald-600" />
              <span>Print Orders Summary</span>
            </Button>
          )}
          <Button variant="outline" onClick={() => orderService.markOrdersSeen().then(load)}>
            Mark all seen
          </Button>
        </div>
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

      <div className="-mx-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:mx-0">
        <div className="max-h-[calc(100vh-270px)] sm:max-h-[calc(100vh-250px)] min-h-[300px] overflow-y-auto overscroll-contain scrollbar-thin">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur-xs shadow-xs text-xs font-semibold uppercase tracking-wider text-gray-700">
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
                    "border-b transition-colors hover:bg-gray-50/80",
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
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">
                      {formatPrice(order.total_amount)}
                    </div>
                    <div className="text-[11px] text-gray-500 font-normal whitespace-nowrap">
                      Items: {formatPrice(Math.max(0, Number(order.total_amount) - Number(order.delivery_charge ?? 0)))}
                      {" · "}
                      Del: {Number(order.delivery_charge ?? 0) === 0 ? (
                        <span className="font-semibold text-emerald-700">FREE</span>
                      ) : (
                        <span className="font-semibold text-blue-700">+{formatPrice(Number(order.delivery_charge))}</span>
                      )}
                    </div>
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
                      title="View Order"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/orders/invoice?id=${order.id}`}
                      className="mr-2 inline-flex text-gray-600 hover:text-gray-900"
                      title="Print Invoice"
                    >
                      <Printer className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeletingOrder(order)}
                      className="inline-flex text-red-600 hover:text-red-800 transition-colors"
                      title="Delete Order"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <p className="p-8 text-center text-gray-500">No orders found.</p>
          )}
        </div>
        {orders.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-2 text-xs text-gray-500 flex items-center justify-between">
            <span>Showing {orders.length} order{orders.length === 1 ? "" : "s"}</span>
            <span className="hidden sm:inline text-gray-400">Scroll table vertically to view older orders</span>
          </div>
        )}
      </div>

      {deletingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Online Order?</h3>
                <p className="text-xs text-gray-500 font-mono">
                  #{deletingOrder.order_number ?? deletingOrder.id.slice(0, 8)}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-gray-600">
              Are you sure you want to permanently delete this online order for{" "}
              <strong>{deletingOrder.customer_name || "Customer"}</strong> (Total: {formatPrice(deletingOrder.total_amount)})?
            </p>

            <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
              📦 <strong>Stock Safety:</strong> If this order was not already cancelled, all reserved product items will be automatically returned to the inventory stock ledger.
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                disabled={deleting}
                onClick={() => setDeletingOrder(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={deleting}
                onClick={handleDeleteOrder}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete Order
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

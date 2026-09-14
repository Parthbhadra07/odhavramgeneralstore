"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  ShoppingBag,
  Store,
  ChevronDown,
  ChevronUp,
  Printer,
  Calendar,
  CreditCard,
  Award,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { orderService } from "@/services/order.service";
import { customerService } from "@/services/erp";
import { formatPrice, formatDate } from "@/utils/format";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { POS_PAYMENT_LABELS } from "@/lib/erp/constants";
import { receiptFromPosSale } from "@/utils/receipt";
import { ReceiptActions } from "@/components/erp/receipt-actions";
import { Modal } from "@/components/admin/modal";
import type { Order } from "@/types/database";
import type { PosSale } from "@/types/erp";

export default function OrdersPage() {
  const { user } = useAuth();
  const { settings } = useStoreSettings();
  const [activeTab, setActiveTab] = useState<"online" | "pos">("online");
  const [orders, setOrders] = useState<Order[]>([]);
  const [posSales, setPosSales] = useState<PosSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [receiptSale, setReceiptSale] = useState<PosSale | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      orderService.getByUser(user.id).catch(() => []),
      customerService.getPosSalesForUser(user.id).catch(() => []),
    ])
      .then(([onlineOrders, inStorePurchases]) => {
        setOrders(onlineOrders);
        setPosSales(inStorePurchases);
        // Default to POS tab if only POS sales exist
        if (onlineOrders.length === 0 && inStorePurchases.length > 0) {
          setActiveTab("pos");
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-500">Loading purchase history...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase History</h1>
          <p className="text-sm text-gray-500">
            View your online delivery orders and physical walk-in store receipts in one place.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("online")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "online"
              ? "border-green-600 text-green-700"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          Online Orders
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${
              activeTab === "online"
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {orders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("pos")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "pos"
              ? "border-green-600 text-green-700"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <Store className="h-4 w-4" />
          In-Store Purchases
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${
              activeTab === "pos"
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {posSales.length}
          </span>
        </button>
      </div>

      {/* ONLINE ORDERS TAB */}
      {activeTab === "online" && (
        <div>
          {orders.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <ShoppingBag className="mx-auto h-10 w-10 text-gray-300 mb-2" />
              <p className="text-gray-600 font-medium">No online orders yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Browse our store and place your first online grocery order!
              </p>
              <Link
                href="/products"
                className="mt-4 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Browse Products
              </Link>
            </div>
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
      )}

      {/* IN-STORE PURCHASES (POS BILLS) TAB */}
      {activeTab === "pos" && (
        <div>
          {posSales.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <Store className="mx-auto h-10 w-10 text-gray-300 mb-2" />
              <p className="text-gray-600 font-medium">No in-store purchases found</p>
              <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                Whenever you shop at our store counter, share your registered mobile number
                at the billing desk to earn loyalty points and view digital receipts here!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posSales.map((sale) => {
                const isExpanded = expandedSaleId === sale.id;
                const itemsCount = sale.pos_sale_items?.length ?? 0;
                const pointsEarned = Math.floor(Number(sale.total_amount) / 100);

                return (
                  <div
                    key={sale.id}
                    className="rounded-lg border bg-white transition-colors hover:border-green-300"
                  >
                    <div className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-green-800">
                            {sale.bill_number}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                            Store Receipt
                          </span>
                        </div>
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 capitalize">
                          {sale.sale_status}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(sale.created_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <CreditCard className="h-3.5 w-3.5" />
                            {POS_PAYMENT_LABELS[sale.payment_method as keyof typeof POS_PAYMENT_LABELS] ??
                              sale.payment_method}
                          </span>
                          {pointsEarned > 0 && (
                            <span className="flex items-center gap-1 text-amber-700 font-medium">
                              <Award className="h-3.5 w-3.5" />
                              +{pointsEarned} pts
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="text-base font-bold text-green-700">
                            {formatPrice(sale.total_amount)}
                          </span>
                          <p className="text-[11px] text-gray-400">
                            {itemsCount} {itemsCount === 1 ? "item" : "items"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between pt-2 border-t text-sm">
                        <button
                          type="button"
                          onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-green-700"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3.5 w-3.5" /> Hide Items
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3.5 w-3.5" /> Show {itemsCount} Items
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setReceiptSale(sale)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-900 bg-green-50 px-2.5 py-1 rounded border border-green-200 hover:bg-green-100 transition"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          View Receipt
                        </button>
                      </div>
                    </div>

                    {/* EXPANDED ITEMS LIST */}
                    {isExpanded && sale.pos_sale_items && sale.pos_sale_items.length > 0 && (
                      <div className="border-t bg-slate-50/70 p-4 rounded-b-lg">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-gray-500 uppercase tracking-wider text-[10px]">
                              <th className="pb-1 text-left">Item</th>
                              <th className="pb-1 text-center">Qty</th>
                              <th className="pb-1 text-right">Rate</th>
                              <th className="pb-1 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {sale.pos_sale_items.map((item, idx) => (
                              <tr key={item.id || idx} className="py-1">
                                <td className="py-1.5 font-medium text-gray-800">
                                  {item.product_name}
                                </td>
                                <td className="py-1.5 text-center text-gray-600">{item.quantity}</td>
                                <td className="py-1.5 text-right text-gray-600">
                                  {formatPrice(item.rate)}
                                </td>
                                <td className="py-1.5 text-right font-semibold text-gray-900">
                                  {formatPrice(item.total_amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* POS RECEIPT MODAL */}
      {receiptSale && (
        <Modal
          open={Boolean(receiptSale)}
          onClose={() => setReceiptSale(null)}
          title={`Store Receipt · ${receiptSale.bill_number}`}
          size="md"
        >
          <div className="p-4 sm:p-6">
            <ReceiptActions
              data={receiptFromPosSale(receiptSale)}
              settings={settings}
              defaultWidth={settings?.receipt_width ?? "80mm"}
              receiptId="customer-dashboard-pos-receipt"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  IndianRupee,
  TrendingUp,
  Monitor,
  Warehouse,
  Banknote,
  Smartphone,
  Package,
  CreditCard,
  ShoppingBag,
  Eye,
  ArrowRight,
} from "lucide-react";
import { analyticsService } from "@/services/erp";
import { adminService } from "@/services/admin.service";
import { orderService } from "@/services/order.service";
import { useAdminOrderNotifications } from "@/hooks/use-admin-order-notifications";
import { useErpNotifications } from "@/hooks/use-erp-notifications";
import { StatCard } from "@/components/admin/stat-card";
import { OnlineOrdersBreakdownModal } from "@/components/admin/online-orders-breakdown-modal";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { SimpleBarChart } from "@/components/admin/charts/simple-bar-chart";
import { SimpleLineChart } from "@/components/admin/charts/simple-line-chart";
import { DashboardQuickShortcuts } from "@/components/admin/dashboard-quick-shortcuts";
import { formatPrice, formatDate } from "@/utils/format";
import { APP_NAME } from "@/lib/constants";
import { toast } from "sonner";
import type { OrderStatus } from "@/types/database";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [lowStock, setLowStock] = useState<{ id: string; name: string; stock: number }[]>([]);
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof analyticsService.getDashboardMetrics>> | null>(null);
  const [showOnlineOrdersModal, setShowOnlineOrdersModal] = useState(false);
  const [orderTab, setOrderTab] = useState<"pending" | "recent">("pending");
  const [wipingId, setWipingId] = useState<string | null>(null);
  const [sales7, setSales7] = useState<{ label: string; value: number }[]>([]);
  const [sales30, setSales30] = useState<{ label: string; value: number }[]>([]);
  const [monthlyRev, setMonthlyRev] = useState<{ label: string; value: number }[]>([]);
  const [monthlyProfit, setMonthlyProfit] = useState<{ label: string; value: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number }[]>([]);
  const [categorySales, setCategorySales] = useState<{ label: string; value: number }[]>([]);

  const handleWipeDeliveryFromDashboard = async (orderId: string, orderNumber: string) => {
    if (!confirm(`Wipe delivery fee for order #${orderNumber}? Delivery fee will become FREE.`)) return;
    setWipingId(orderId);
    try {
      await orderService.wipeDeliveryCharge(orderId);
      toast.success(`Delivery fee wiped for order #${orderNumber}! Order total updated.`);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to wipe delivery fee");
    } finally {
      setWipingId(null);
    }
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      analyticsService.getDashboardMetrics().then(setMetrics),
      adminService.getDashboardStats().then((s) => setLowStock(s.lowStock)),
      analyticsService.salesTrend(7).then(setSales7),
      analyticsService.salesTrend(30).then(setSales30),
      analyticsService.monthlyRevenueTrend(6).then(setMonthlyRev),
      analyticsService.monthlyProfitTrend(6).then(setMonthlyProfit),
      analyticsService.topProducts(8).then(setTopProducts),
      analyticsService.categorySales().then(setCategorySales),
    ]).finally(() => setLoading(false));
  };

  const { newOrderCount } = useAdminOrderNotifications(load);
  useErpNotifications(load);

  useEffect(() => {
    load();
  }, []);

  if (loading || !metrics) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="admin-page-title">{APP_NAME} — ERP Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">Real-time store analytics & operations</p>
      </div>

      {newOrderCount > 0 && (
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200"
        >
          🔔 {newOrderCount} new online order(s)
        </Link>
      )}

      {/* Direct Operations Command Center Shortcuts Hub */}
      <DashboardQuickShortcuts newOrderCount={newOrderCount} />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
        <StatCard
          label="Today's Online Sales"
          value={formatPrice(metrics.todayOnlineSales)}
          icon={ShoppingCart}
          color="bg-blue-500"
          subtext={`Items ${formatPrice(metrics.todayOnlineItemsSubtotal ?? 0)} · Delivery ${formatPrice(metrics.todayOnlineDeliveryCharges ?? 0)}`}
          onClick={() => setShowOnlineOrdersModal(true)}
          clickableHint="Breakdown"
        />
        <StatCard label="Today's POS Sales" value={formatPrice(metrics.todayPosSales)} icon={Monitor} color="bg-indigo-500" />
        <StatCard
          label="Total Orders"
          value={metrics.totalOrders}
          icon={Package}
          color="bg-violet-500"
          onClick={() => router.push("/admin/orders")}
          clickableHint="View All"
        />
        <StatCard
          label="Pending Orders"
          value={metrics.pendingOrders}
          icon={Clock}
          color="bg-amber-500"
          onClick={() => router.push("/admin/orders?status=received")}
          clickableHint="Fulfill"
        />
        <StatCard
          label="Delivered Orders"
          value={metrics.deliveredOrders}
          icon={CheckCircle}
          color="bg-green-500"
          onClick={() => router.push("/admin/orders?status=delivered")}
          clickableHint="Delivered"
        />
        <StatCard
          label="Cash Collection"
          value={formatPrice(metrics.cashCollection)}
          icon={Banknote}
          color="bg-emerald-600"
          subtext={`POS ${formatPrice(metrics.posCashSales ?? 0)} + Khata ${formatPrice(metrics.creditCashCollection ?? 0)}`}
        />
        <StatCard
          label="UPI Collection"
          value={formatPrice(metrics.upiCollection)}
          icon={Smartphone}
          color="bg-cyan-600"
          subtext={`POS ${formatPrice(metrics.posUpiSales ?? 0)} + Khata ${formatPrice(metrics.creditUpiCollection ?? 0)}`}
        />
        <StatCard
          label="Credit Given"
          value={formatPrice(metrics.todayCreditGiven ?? 0)}
          icon={CreditCard}
          color="bg-rose-600"
          subtext={`Due ${formatPrice(metrics.outstandingCredit ?? 0)} · Rec ${formatPrice(metrics.todayCreditCollected ?? 0)}`}
          onClick={() => router.push("/admin/credit")}
          clickableHint="Khata"
        />
        <StatCard label="Inventory Value" value={formatPrice(metrics.inventoryValue)} icon={Warehouse} color="bg-teal-600" />
        <StatCard label="Today's Profit" value={formatPrice(metrics.todayProfit)} icon={TrendingUp} color="bg-green-600" />
        <StatCard label="Monthly Profit" value={formatPrice(metrics.monthlyProfit)} icon={IndianRupee} color="bg-emerald-500" subtext={`Revenue ${formatPrice(metrics.monthlyRevenue)}`} />
      </div>

      {/* Real-time Online Orders Live Management Section on Dashboard */}
      <div className="admin-card overflow-hidden border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                Online Store Orders
                {metrics.pendingOrders > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                    {metrics.pendingOrders} need dispatch
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500">
                Live orders received from customer website & mobile catalog
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-gray-100 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setOrderTab("pending")}
                className={`rounded-md px-3 py-1.5 transition cursor-pointer ${
                  orderTab === "pending"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Pending ({metrics.pendingOnlineOrders?.length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setOrderTab("recent")}
                className={`rounded-md px-3 py-1.5 transition cursor-pointer ${
                  orderTab === "recent"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                All Recent ({metrics.recentOnlineOrders?.length ?? 0})
              </button>
            </div>
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-100 transition border border-green-200"
            >
              All Orders <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {(() => {
          const displayOrders =
            orderTab === "pending"
              ? (metrics.pendingOnlineOrders?.length ? metrics.pendingOnlineOrders : metrics.recentOnlineOrders ?? [])
              : (metrics.recentOnlineOrders ?? []);

          if (displayOrders.length === 0) {
            return (
              <div className="py-8 text-center text-gray-500">
                <ShoppingCart className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm font-semibold text-gray-700">No online orders found</p>
                <p className="text-xs text-gray-400 mt-1">
                  Orders placed online will be displayed here in real time.
                </p>
              </div>
            );
          }

          return (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-xs">
                <thead className="border-b border-gray-100 bg-gray-50/80 text-gray-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 text-left">Order #</th>
                    <th className="py-2.5 px-3 text-left">Customer</th>
                    <th className="py-2.5 px-3 text-left">Status</th>
                    <th className="py-2.5 px-3 text-right">Items</th>
                    <th className="py-2.5 px-3 text-right">Delivery</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-left">Date</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayOrders.slice(0, 6).map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50/60 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-green-800">
                        {o.order_number}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-gray-900">{o.customer_name}</div>
                        {o.customer_phone && (
                          <div className="text-[11px] text-gray-500 font-mono">{o.customer_phone}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <OrderStatusBadge status={o.order_status as OrderStatus} />
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-gray-700">
                        {formatPrice(o.subtotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {o.delivery_charge === 0 ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                            FREE
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <span className="font-semibold text-blue-700">
                              +{formatPrice(o.delivery_charge)}
                            </span>
                            <button
                              type="button"
                              disabled={wipingId === o.id}
                              onClick={() => handleWipeDeliveryFromDashboard(o.id, o.order_number)}
                              className="rounded bg-blue-50 px-1 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 border border-blue-200 cursor-pointer"
                              title="Wipe delivery fee for this order"
                            >
                              Wipe fee
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                        {formatPrice(o.total_amount)}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">
                        {formatDate(o.created_at)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          href={`/admin/orders/view?id=${o.id}`}
                          className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-800 hover:bg-green-100 transition border border-green-200"
                        >
                          View <Eye className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      <OnlineOrdersBreakdownModal
        open={showOnlineOrdersModal}
        onClose={() => setShowOnlineOrdersModal(false)}
        todaySales={metrics.todayOnlineSales}
        todayItemsSubtotal={metrics.todayOnlineItemsSubtotal ?? 0}
        todayDeliveryCharges={metrics.todayOnlineDeliveryCharges ?? 0}
        todayOrders={metrics.todayOnlineOrders ?? []}
        monthlySales={metrics.monthlyOnlineSales}
        monthlyItemsSubtotal={metrics.monthlyOnlineItemsSubtotal}
        monthlyDeliveryCharges={metrics.monthlyOnlineDeliveryCharges}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="admin-card p-4 sm:p-5">
          <h2 className="admin-section-title mb-4">Last 7 Days Sales</h2>
          <SimpleLineChart data={sales7} formatValue={(v) => formatPrice(v)} height={160} />
        </div>
        <div className="admin-card p-4 sm:p-5">
          <h2 className="admin-section-title mb-4">Last 30 Days Sales</h2>
          <SimpleLineChart data={sales30.slice(-14)} formatValue={(v) => formatPrice(v)} height={160} color="#2563eb" />
        </div>
        <div className="admin-card p-4 sm:p-5">
          <h2 className="admin-section-title mb-4">Monthly Revenue</h2>
          <SimpleBarChart data={monthlyRev.map((d) => ({ ...d, color: "#16a34a" }))} formatValue={(v) => formatPrice(v)} height={180} />
        </div>
        <div className="admin-card p-4 sm:p-5">
          <h2 className="admin-section-title mb-4">Monthly Profit</h2>
          <SimpleBarChart data={monthlyProfit.map((d) => ({ ...d, color: "#059669" }))} formatValue={(v) => formatPrice(v)} height={180} />
        </div>
        <div className="admin-card p-4 sm:p-5">
          <h2 className="admin-section-title mb-4">Top Selling Products</h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-500">No sales data yet</p>
          ) : (
            <SimpleBarChart
              data={topProducts.map((p) => ({ label: p.name.slice(0, 8), value: p.quantity, color: "#16a34a" }))}
              height={180}
            />
          )}
        </div>
        <div className="admin-card p-4 sm:p-5">
          <h2 className="admin-section-title mb-4">Category-wise Sales</h2>
          {categorySales.length === 0 ? (
            <p className="text-sm text-gray-500">No category data yet</p>
          ) : (
            <SimpleBarChart
              data={categorySales.map((c) => ({ label: c.label.slice(0, 10), value: c.value, color: "#0d9488" }))}
              formatValue={(v) => formatPrice(v)}
              height={180}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="admin-card p-4 sm:p-5">
          <h2 className="admin-section-title mb-4">Low Stock Alert</h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-gray-600">All products are well stocked.</p>
          ) : (
            <ul className="space-y-2">
              {lowStock.slice(0, 8).map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span>{p.name}</span>
                  <span className="font-medium text-amber-600">{p.stock} left</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/inventory" className="mt-4 inline-block text-sm font-medium text-green-700 hover:underline">
            View inventory →
          </Link>
        </div>
        <div className="admin-card p-4 sm:p-5">
          <h2 className="admin-section-title mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            {[
              ["/admin/pos", "POS Billing", true],
              ["/admin/orders", "Orders", false],
              ["/admin/purchases", "Purchases", false],
              ["/admin/reports", "Reports", false],
              ["/admin/stock-adjustment", "Stock Adjust", false],
              ["/admin/barcode-labels", "Barcodes", false],
              ["/admin/reorder", "Reorder AI", false],
            ].map(([href, label, primary]) => (
              <Link
                key={href as string}
                href={href as string}
                className={
                  primary
                    ? "rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    : "rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
                }
              >
                {label as string}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

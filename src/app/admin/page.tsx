"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { analyticsService } from "@/services/erp";
import { adminService } from "@/services/admin.service";
import { useAdminOrderNotifications } from "@/hooks/use-admin-order-notifications";
import { useErpNotifications } from "@/hooks/use-erp-notifications";
import { StatCard } from "@/components/admin/stat-card";
import { SimpleBarChart } from "@/components/admin/charts/simple-bar-chart";
import { SimpleLineChart } from "@/components/admin/charts/simple-line-chart";
import { formatPrice } from "@/utils/format";
import { APP_NAME } from "@/lib/constants";

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [lowStock, setLowStock] = useState<{ id: string; name: string; stock: number }[]>([]);
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof analyticsService.getDashboardMetrics>> | null>(null);
  const [sales7, setSales7] = useState<{ label: string; value: number }[]>([]);
  const [sales30, setSales30] = useState<{ label: string; value: number }[]>([]);
  const [monthlyRev, setMonthlyRev] = useState<{ label: string; value: number }[]>([]);
  const [monthlyProfit, setMonthlyProfit] = useState<{ label: string; value: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number }[]>([]);
  const [categorySales, setCategorySales] = useState<{ label: string; value: number }[]>([]);

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Today's Online Sales" value={formatPrice(metrics.todayOnlineSales)} icon={ShoppingCart} color="bg-blue-500" />
        <StatCard label="Today's POS Sales" value={formatPrice(metrics.todayPosSales)} icon={Monitor} color="bg-indigo-500" />
        <StatCard label="Total Orders" value={metrics.totalOrders} icon={Package} color="bg-violet-500" />
        <StatCard label="Pending Orders" value={metrics.pendingOrders} icon={Clock} color="bg-amber-500" />
        <StatCard label="Delivered Orders" value={metrics.deliveredOrders} icon={CheckCircle} color="bg-green-500" />
        <StatCard label="Cash Collection" value={formatPrice(metrics.cashCollection)} icon={Banknote} color="bg-emerald-600" />
        <StatCard label="UPI Collection" value={formatPrice(metrics.upiCollection)} icon={Smartphone} color="bg-cyan-600" />
        <StatCard label="Inventory Value" value={formatPrice(metrics.inventoryValue)} icon={Warehouse} color="bg-teal-600" />
        <StatCard label="Today's Profit" value={formatPrice(metrics.todayProfit)} icon={TrendingUp} color="bg-green-600" />
        <StatCard label="Monthly Profit" value={formatPrice(metrics.monthlyProfit)} icon={IndianRupee} color="bg-emerald-500" subtext={`Revenue ${formatPrice(metrics.monthlyRevenue)}`} />
      </div>

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

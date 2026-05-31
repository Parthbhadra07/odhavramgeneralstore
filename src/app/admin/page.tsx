"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  ShoppingCart,
  Clock,
  CheckCircle,
  IndianRupee,
  TrendingUp,
} from "lucide-react";
import { orderService } from "@/services/order.service";
import { adminService } from "@/services/admin.service";
import { useAdminOrderNotifications } from "@/hooks/use-admin-order-notifications";
import { formatPrice } from "@/utils/format";
import { APP_NAME } from "@/lib/constants";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<{
    productCount: number;
    orderCount: number;
    userCount: number;
    revenue: number;
    lowStock: { id: string; name: string; stock: number }[];
  } | null>(null);
  const [orderStats, setOrderStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    todaySales: 0,
    monthlySales: 0,
    newOrders: 0,
  });

  const load = () => {
    adminService.getDashboardStats().then(setStats);
    orderService.getDashboardStats().then(setOrderStats);
  };

  const { newOrderCount } = useAdminOrderNotifications(load);

  useEffect(() => {
    load();
  }, []);

  if (!stats) return <p>Loading dashboard...</p>;

  const cards = [
    { label: "Total Orders", value: orderStats.totalOrders, icon: ShoppingCart, color: "bg-blue-500" },
    { label: "Pending Orders", value: orderStats.pendingOrders, icon: Clock, color: "bg-amber-500" },
    { label: "Delivered", value: orderStats.deliveredOrders, icon: CheckCircle, color: "bg-green-500" },
    { label: "Today's Sales", value: formatPrice(orderStats.todaySales), icon: IndianRupee, color: "bg-emerald-500" },
    { label: "Monthly Sales", value: formatPrice(orderStats.monthlySales), icon: TrendingUp, color: "bg-purple-500" },
    { label: "Products", value: stats.productCount, icon: Package, color: "bg-teal-500" },
  ];

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold sm:text-2xl">{APP_NAME} — Admin</h1>
      {newOrderCount > 0 && (
        <Link
          href="/admin/orders"
          className="mb-6 inline-block rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200"
        >
          🔔 {newOrderCount} new order(s) — View now
        </Link>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </div>
              <div className={`rounded-lg p-3 text-white ${color}`}>
                <Icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Low Stock Alert</h2>
          {stats.lowStock.length === 0 ? (
            <p className="text-gray-600">All products are well stocked.</p>
          ) : (
            <ul className="space-y-2">
              {stats.lowStock.map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span>{p.name}</span>
                  <span className="font-medium text-amber-600">{p.stock} left</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/orders" className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700">
              Manage Orders
            </Link>
            <Link href="/admin/products" className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
              Products
            </Link>
            <Link href="/admin/reports" className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
              Reports
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

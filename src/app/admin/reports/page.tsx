"use client";

import { useEffect, useState } from "react";
import { orderService } from "@/services/order.service";
import { formatPrice } from "@/utils/format";

export default function AdminReportsPage() {
  const [report, setReport] = useState<{
    totalRevenue: number;
    orderCount: number;
    monthly: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    orderService.getSalesReport().then((orders) => {
      const monthly: Record<string, number> = {};
      let totalRevenue = 0;

      orders.forEach((o) => {
        const amount = Number(o.total_amount);
        totalRevenue += amount;
        const month = new Date(o.created_at).toLocaleString("en-IN", {
          month: "short",
          year: "numeric",
        });
        monthly[month] = (monthly[month] ?? 0) + amount;
      });

      setReport({
        totalRevenue,
        orderCount: orders.length,
        monthly,
      });
    });
  }, []);

  if (!report) return <p>Loading reports...</p>;

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold sm:text-2xl">Sales Reports</h1>
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">Total Revenue</p>
          <p className="text-3xl font-bold text-green-700">
            {formatPrice(report.totalRevenue)}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">Paid Orders</p>
          <p className="text-3xl font-bold">{report.orderCount}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Monthly Breakdown</h2>
        {Object.keys(report.monthly).length === 0 ? (
          <p className="text-gray-600">No sales data yet.</p>
        ) : (
          <ul className="space-y-3">
            {Object.entries(report.monthly).map(([month, amount]) => (
              <li key={month} className="flex justify-between border-b pb-2">
                <span>{month}</span>
                <span className="font-semibold text-green-700">{formatPrice(amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

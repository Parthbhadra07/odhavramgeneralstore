"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Calendar } from "lucide-react";
import { expiryService } from "@/services/erp";
import type { ErpProduct, ProductLot } from "@/types/erp";
import { formatPrice, formatDate } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

type Tab = "expired" | "30" | "60" | "90";

export default function ExpiryDashboardPage() {
  const [tab, setTab] = useState<Tab>("30");
  const [data, setData] = useState<Awaited<
    ReturnType<typeof expiryService.getDashboard>
  > | null>(null);

  useEffect(() => {
    expiryService.getDashboard().then(setData);
  }, []);

  if (!data) return <p className="p-8">Loading expiry data...</p>;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "expired", label: "Expired", count: data.expired.length + data.expiredLots.length },
    { id: "30", label: "30 Days", count: data.expiring30.length + data.expiringLots30.length },
    { id: "60", label: "60 Days", count: data.expiring60.length + data.expiringLots60.length },
    { id: "90", label: "90 Days", count: data.expiring90.length + data.expiringLots90.length },
  ];

  const products: ErpProduct[] =
    tab === "expired"
      ? data.expired
      : tab === "30"
        ? data.expiring30
        : tab === "60"
          ? data.expiring60
          : data.expiring90;

  const lots: ProductLot[] =
    tab === "expired"
      ? data.expiredLots
      : tab === "30"
        ? data.expiringLots30
        : tab === "60"
          ? data.expiringLots60
          : data.expiringLots90;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Expiry Management</h1>
          <p className="text-sm text-gray-600">
            Monitor expired and near-expiry products
          </p>
        </div>
        <Link href="/admin/inventory">
          <Button variant="outline">Inventory</Button>
        </Link>
      </div>

      {(data.expired.length > 0 || data.expiredLots.length > 0) && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="text-sm text-red-800">
            <strong>{data.expired.length + data.expiredLots.length}</strong> expired
            items with stock — consider purchase return or write-off.
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2 border-b">
        {tabs.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium",
              tab === id
                ? "border-green-600 text-green-800"
                : "border-transparent text-gray-600 hover:text-gray-900"
            )}
          >
            <Calendar className="h-4 w-4" />
            {label}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                id === "expired" && count > 0
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-700"
              )}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border bg-white">
          <h2 className="border-b p-4 font-semibold">Products</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Product</th>
                <th>Stock</th>
                <th>Expiry</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3">{p.name}</td>
                  <td className="p-3">{p.stock}</td>
                  <td className="p-3 text-red-600">{p.expiry_date ?? "—"}</td>
                  <td className="p-3">
                    {formatPrice(p.stock * (p.purchase_price ?? p.price * 0.85))}
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-gray-500">
                    No products in this bucket
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-white">
          <h2 className="border-b p-4 font-semibold">Lots / Batches</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Product</th>
                <th>Barcode</th>
                <th>Batch</th>
                <th>Stock</th>
                <th>Expiry</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="p-3">{l.products?.name ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">{l.barcode}</td>
                  <td className="p-3">{l.batch_number ?? l.lot_number ?? "—"}</td>
                  <td className="p-3">{l.current_stock}</td>
                  <td className="p-3 text-orange-600">{l.expiry_date ?? "—"}</td>
                </tr>
              ))}
              {lots.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">
                    No lots in this bucket
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

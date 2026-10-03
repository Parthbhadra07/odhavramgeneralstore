"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Calendar, Printer } from "lucide-react";
import { toast } from "sonner";
import { expiryService } from "@/services/erp";
import type { ErpProduct, ProductLot } from "@/types/erp";
import { formatPrice, formatDate } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { printSystematicDocument } from "@/utils/document-print";

type Tab = "expired" | "30" | "60" | "90";

export default function ExpiryDashboardPage() {
  const [tab, setTab] = useState<Tab>("30");
  const [data, setData] = useState<Awaited<
    ReturnType<typeof expiryService.getDashboard>
  > | null>(null);

  useEffect(() => {
    expiryService.getDashboard().then(setData);
  }, []);

  if (!data) return <p className="p-8 text-gray-500">Loading expiry data...</p>;

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

  const printExpiryReport = () => {
    if (products.length === 0 && lots.length === 0) {
      toast.error("No expiring items to print for this timeframe.");
      return;
    }
    const tabLabel = tabs.find((t) => t.id === tab)?.label || tab;
    const totalVal = products.reduce(
      (s, p) => s + p.stock * (p.purchase_price ?? p.price * 0.85),
      0
    );

    printSystematicDocument({
      docTitle: "EXPIRY RISK & NEAR-EXPIRY AUDIT STATEMENT",
      docBadge: "QUALITY & LOSS AUDIT RECORD",
      docNumber: `EXPIRY-${tab.toUpperCase()}-${new Date().toISOString().slice(0, 10)}`,
      metadata: [
        { label: "Expiry Horizon", value: tabLabel },
        { label: "Products at Risk", value: products.length },
        { label: "Lots / Batches at Risk", value: lots.length },
        { label: "Estimated Risk Valuation", value: formatPrice(totalVal) },
        { label: "Audit Date", value: formatDate(new Date().toISOString()) },
      ],
      columns: [
        { header: "Product Name", width: "34%" },
        { header: "Barcode / Batch", width: "20%" },
        { header: "Stock Qty", align: "center", width: "14%" },
        { header: "Expiry Date", align: "center", width: "16%" },
        { header: "At-Risk Value", align: "right", width: "16%" },
      ],
      rows: [
        ...products.map((p) => ({
          cells: [
            p.name,
            p.barcode || "Standard Item",
            `${p.stock} ${p.unit ?? "pcs"}`,
            p.expiry_date ?? "Expired / Critical",
            formatPrice(p.stock * (p.purchase_price ?? p.price * 0.85)),
          ],
        })),
        ...lots.map((l) => ({
          cells: [
            l.products?.name ?? "Lot Item",
            `Batch: ${l.batch_number || l.lot_number || l.barcode || "—"}`,
            l.current_stock,
            l.expiry_date ?? "Expired",
            "—",
          ],
        })),
      ],
      summaryRows: [
        { label: "Total SKUs & Batches at Expiry Risk", value: String(products.length + lots.length) },
        { label: "Total Estimated Value at Risk", value: formatPrice(totalVal), isBold: true, isHighlight: true },
      ],
      notes: [
        "Immediate action recommended: Return to supplier (Purchase Return / Debit Note), write-off, or steep clearance sale.",
      ],
      signatories: ["Store Quality Auditor", "Store Proprietor"],
    });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Expiry Management</h1>
          <p className="text-sm text-gray-600">
            Monitor expired and near-expiry products
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(products.length > 0 || lots.length > 0) && (
            <Button
              type="button"
              variant="outline"
              onClick={printExpiryReport}
              className="gap-1.5 font-bold"
            >
              <Printer className="h-4 w-4 text-emerald-600" />
              <span>Print Expiry Audit</span>
            </Button>
          )}
          <Link href="/admin/inventory">
            <Button variant="outline">Inventory</Button>
          </Link>
        </div>
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
              "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-green-600 text-green-800 font-bold"
                : "border-transparent text-gray-600 hover:text-gray-900"
            )}
          >
            <Calendar className="h-4 w-4" />
            {label}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
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
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col">
          <div className="border-b bg-gray-50/80 px-4 py-3 font-semibold text-gray-900 flex items-center justify-between">
            <span>Products ({products.length})</span>
            <span className="text-xs font-normal text-gray-500">Standard Catalog</span>
          </div>
          <div className="max-h-[calc(100vh-320px)] min-h-[280px] overflow-y-auto overscroll-contain scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur-xs shadow-xs text-xs font-semibold uppercase tracking-wider text-gray-700">
                <tr>
                  <th className="p-3 text-left">Product</th>
                  <th>Stock</th>
                  <th>Expiry</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-gray-50/80 transition-colors">
                    <td className="p-3 font-medium text-gray-900">{p.name}</td>
                    <td className="p-3 font-semibold">{p.stock}</td>
                    <td className="p-3 text-red-600 font-medium">{p.expiry_date ?? "—"}</td>
                    <td className="p-3 font-semibold text-gray-900">
                      {formatPrice(p.stock * (p.purchase_price ?? p.price * 0.85))}
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      No products in this expiry horizon
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {products.length > 0 && (
            <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-2 text-xs text-gray-500">
              Showing {products.length} product SKU{products.length === 1 ? "" : "s"}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col">
          <div className="border-b bg-gray-50/80 px-4 py-3 font-semibold text-gray-900 flex items-center justify-between">
            <span>Lots / Batches ({lots.length})</span>
            <span className="text-xs font-normal text-gray-500">Tracked Batches</span>
          </div>
          <div className="max-h-[calc(100vh-320px)] min-h-[280px] overflow-y-auto overscroll-contain scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur-xs shadow-xs text-xs font-semibold uppercase tracking-wider text-gray-700">
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
                  <tr key={l.id} className="border-t hover:bg-gray-50/80 transition-colors">
                    <td className="p-3 font-medium text-gray-900">{l.products?.name ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{l.barcode}</td>
                    <td className="p-3 font-mono text-xs">{l.batch_number ?? l.lot_number ?? "—"}</td>
                    <td className="p-3 font-semibold">{l.current_stock}</td>
                    <td className="p-3 text-orange-600 font-medium">{l.expiry_date ?? "—"}</td>
                  </tr>
                ))}
                {lots.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      No batch lots in this expiry horizon
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {lots.length > 0 && (
            <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-2 text-xs text-gray-500">
              Showing {lots.length} tracked batch{lots.length === 1 ? "" : "es"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Package, Barcode } from "lucide-react";
import { inventoryService } from "@/services/erp";
import type { ErpProduct, LowStockProduct } from "@/types/erp";
import { formatPrice } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeLabel, printBarcodeLabels } from "@/components/erp/barcode-label";

export default function InventoryPage() {
  const [products, setProducts] = useState<ErpProduct[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [expiring, setExpiring] = useState<ErpProduct[]>([]);
  const [search, setSearch] = useState("");
  const [inventoryValue, setInventoryValue] = useState(0);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);

  const load = () => {
    inventoryService
      .listProducts({ search: search || undefined })
      .then(setProducts);
    inventoryService.getLowStock().then(setLowStock);
    inventoryService.getExpiringProducts(30).then(setExpiring);
    inventoryService.getInventoryValue().then(setInventoryValue);
  };

  useEffect(() => {
    load();
  }, [search]);

  const handleAdjust = async (productId: string) => {
    if (!adjustQty) return;
    await inventoryService.adjustStock(productId, adjustQty, "Manual adjustment");
    setAdjustId(null);
    setAdjustQty(0);
    load();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Inventory Management</h1>
        <Link href="/admin/products">
          <Button>Add / Edit Products</Button>
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-600">Inventory Value</p>
          <p className="text-2xl font-bold text-green-800">{formatPrice(inventoryValue)}</p>
        </div>
        <div className="rounded-xl border bg-amber-50 p-4">
          <p className="flex items-center gap-1 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Low Stock
          </p>
          <p className="text-2xl font-bold">{lowStock.length}</p>
        </div>
        <div className="rounded-xl border bg-orange-50 p-4">
          <p className="text-sm text-orange-800">Expiring (30 days)</p>
          <p className="text-2xl font-bold">{expiring.length}</p>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-3 font-semibold text-amber-900">Low Stock Alerts</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="pb-2">Product</th>
                  <th>Current</th>
                  <th>Minimum</th>
                  <th>Required</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((p) => (
                  <tr key={p.id} className="border-t border-amber-200">
                    <td className="py-2">{p.name}</td>
                    <td>{p.stock}</td>
                    <td>{p.min_stock_level}</td>
                    <td className="font-medium text-amber-800">{p.required_quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Input
        placeholder="Search name, SKU, barcode..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-md"
      />

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Product</th>
              <th>SKU</th>
              <th>Stock</th>
              <th>Purchase</th>
              <th>Selling</th>
              <th>GST%</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-400" />
                    {p.name}
                  </div>
                </td>
                <td className="p-3 font-mono text-xs">{p.sku ?? "—"}</td>
                <td
                  className={`p-3 font-medium ${
                    p.stock <= (p.min_stock_level ?? 5) ? "text-red-600" : ""
                  }`}
                >
                  {p.stock} {p.unit ?? "pcs"}
                </td>
                <td className="p-3">{formatPrice(p.purchase_price ?? 0)}</td>
                <td className="p-3">
                  {formatPrice(p.selling_price ?? p.price)}
                </td>
                <td className="p-3">{p.gst_percentage ?? 0}%</td>
                <td className="p-3">
                  {adjustId === p.id ? (
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        className="w-20"
                        value={adjustQty}
                        onChange={(e) => setAdjustQty(Number(e.target.value))}
                        placeholder="+/-"
                      />
                      <Button size="sm" onClick={() => handleAdjust(p.id)}>
                        OK
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-green-700 underline"
                      onClick={() => setAdjustId(p.id)}
                    >
                      Adjust
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">
            <Barcode className="mr-1 inline h-5 w-5" />
            Barcode Labels
          </h2>
          <Button variant="outline" size="sm" onClick={printBarcodeLabels}>
            Print Labels
          </Button>
        </div>
        <div id="barcode-labels-print" className="flex flex-wrap gap-4">
          {products
            .filter((p) => p.barcode)
            .slice(0, 12)
            .map((p) => (
              <BarcodeLabel
                key={p.id}
                value={p.barcode!}
                productName={p.name}
                price={Number(p.selling_price ?? p.price)}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

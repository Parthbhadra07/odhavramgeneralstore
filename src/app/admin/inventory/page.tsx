"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Package, Barcode, History } from "lucide-react";
import { inventoryService, lotService } from "@/services/erp";
import type { ErpProduct, LowStockProduct, ProductLot, StockMovement } from "@/types/erp";
import { formatPrice, formatDate } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeLabel, printBarcodeLabels } from "@/components/erp/barcode-label";
import { STOCK_MOVEMENT_LABELS } from "@/lib/erp/constants";
import { cn } from "@/utils/cn";

type Tab = "stock" | "lots" | "ledger";

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("stock");
  const [products, setProducts] = useState<ErpProduct[]>([]);
  const [lots, setLots] = useState<ProductLot[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
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
    lotService.listAll({ search: search || undefined }).then(setLots);
    inventoryService.getStockMovements(undefined, 200).then(setMovements);
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

      <div className="mb-4 flex flex-wrap gap-2 border-b">
        {(
          [
            { id: "stock" as Tab, label: "Current Stock", icon: Package },
            { id: "lots" as Tab, label: "Lot / Barcode Stock", icon: Barcode },
            { id: "ledger" as Tab, label: "Stock Ledger", icon: History },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-green-600 text-green-800"
                : "border-transparent text-gray-600 hover:text-gray-900"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <Input
        placeholder="Search name, SKU, barcode..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-md"
      />

      {tab === "lots" && (
        <div className="mb-6 overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Product</th>
                <th>Barcode</th>
                <th>Lot</th>
                <th>Batch</th>
                <th>Stock</th>
                <th>Expiry</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="p-3">{l.products?.name ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">{l.barcode}</td>
                  <td className="p-3">{l.lot_number ?? "—"}</td>
                  <td className="p-3">{l.batch_number ?? "—"}</td>
                  <td
                    className={`p-3 font-medium ${
                      l.current_stock <= 5 ? "text-red-600" : ""
                    }`}
                  >
                    {l.current_stock}
                  </td>
                  <td className="p-3">{l.expiry_date ?? "—"}</td>
                  <td className="p-3">
                    {formatPrice(l.selling_price ?? l.products?.selling_price ?? 0)}
                  </td>
                </tr>
              ))}
              {lots.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">
                    No lots found. Add purchases with barcodes to create lots.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "ledger" && (
        <div className="mb-6 overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th>Product</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Before</th>
                <th>After</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-3 whitespace-nowrap">{formatDate(m.created_at)}</td>
                  <td className="p-3">{m.products?.name ?? "—"}</td>
                  <td className="p-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                      {STOCK_MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}
                    </span>
                  </td>
                  <td
                    className={`p-3 font-medium ${
                      m.quantity > 0 ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {m.quantity > 0 ? "+" : ""}
                    {m.quantity}
                  </td>
                  <td className="p-3">{m.stock_before}</td>
                  <td className="p-3">{m.stock_after}</td>
                  <td className="p-3 text-gray-600">{m.notes ?? "—"}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">
                    No stock movements yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "stock" && (
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
      )}

      {tab === "stock" && (
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
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Package,
  Barcode,
  History,
  Sparkles,
  Search,
  ScanBarcode,
  FileSpreadsheet,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { inventoryService, lotService } from "@/services/erp";
import type { ErpProduct, LowStockProduct, ProductLot, StockMovement } from "@/types/erp";
import { formatPrice, formatDate } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeLabel, printBarcodeLabels } from "@/components/erp/barcode-label";
import { StockVerificationModal } from "@/components/admin/stock-verification-modal";
import { STOCK_MOVEMENT_LABELS } from "@/lib/erp/constants";
import { cn } from "@/utils/cn";
import { printSystematicDocument } from "@/utils/document-print";
import {
  describeStock,
  HEALTH_STYLE,
  sortByUrgency,
  type StockHealthKey,
} from "@/utils/inventory-health";

type Tab = "stock" | "lots" | "ledger";
type AttentionFilter = "all" | "needs_action" | "healthy" | StockHealthKey;

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("stock");
  const [products, setProducts] = useState<ErpProduct[]>([]);
  const [lots, setLots] = useState<ProductLot[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [expiring, setExpiring] = useState<ErpProduct[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [inventoryValue, setInventoryValue] = useState(0);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [filter, setFilter] = useState<AttentionFilter>("needs_action");
  const [loading, setLoading] = useState(true);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = () => {
    setLoading(true);
    Promise.all([
      inventoryService.listProducts({ search: debouncedSearch || undefined }),
      lotService.listAll({ search: debouncedSearch || undefined }),
      inventoryService.getStockMovements(undefined, 400),
      inventoryService.getLowStock(),
      inventoryService.getExpiringProducts(30),
      inventoryService.getInventoryValue(),
    ])
      .then(([p, l, m, low, exp, value]) => {
        setProducts(p);
        setLots(l);
        setMovements(m);
        setLowStock(low);
        setExpiring(exp);
        setInventoryValue(value);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load inventory"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const ranked = useMemo(
    () => sortByUrgency(products, movements),
    [products, movements]
  );

  const visible = useMemo(() => {
    if (filter === "all") return ranked;
    if (filter === "needs_action") {
      return ranked.filter((p) => describeStock(p, movements).key !== "ok");
    }
    if (filter === "healthy") {
      return ranked.filter((p) => describeStock(p, movements).key === "ok");
    }
    return ranked.filter((p) => describeStock(p, movements).key === filter);
  }, [ranked, filter, movements]);

  const outCount = ranked.filter((p) => describeStock(p, movements).key === "out").length;
  const actionCount = ranked.filter((p) => describeStock(p, movements).key !== "ok").length;

  const handleAdjust = async (productId: string, qty = adjustQty) => {
    if (!qty) return;
    try {
      await inventoryService.adjustStock(productId, qty, "Manual adjustment");
      toast.success(qty > 0 ? `Added ${qty}` : `Removed ${Math.abs(qty)}`);
      setAdjustId(null);
      setAdjustQty(0);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Adjust failed");
    }
  };

  const chips: { id: AttentionFilter; label: string }[] = [
    { id: "needs_action", label: `Needs attention (${actionCount})` },
    { id: "all", label: `All (${products.length})` },
    { id: "out", label: `Out (${outCount})` },
    { id: "low", label: `Low (${lowStock.length})` },
    { id: "healthy", label: "Healthy" },
  ];

  const printStockValuation = () => {
    if (products.length === 0) {
      toast.error("No inventory products to print.");
      return;
    }
    const totalVal = products.reduce(
      (sum, p) => sum + p.stock * (p.purchase_price ?? p.selling_price ?? p.price * 0.85),
      0
    );
    printSystematicDocument({
      docTitle: "INVENTORY STOCK & VALUATION AUDIT STATEMENT",
      docBadge: "ACCOUNTS PHYSICAL INVENTORY RECORD",
      docNumber: `INV-VAL-${new Date().toISOString().slice(0, 10)}`,
      metadata: [
        { label: "Total Unique SKUs", value: products.length },
        { label: "Estimated Stock Valuation", value: formatPrice(inventoryValue || totalVal) },
        { label: "Out of Stock Items", value: outCount },
        { label: "Low / Expiring Items", value: actionCount },
        { label: "Generated Date", value: formatDate(new Date().toISOString()) },
      ],
      columns: [
        { header: "Product Name", width: "26%" },
        { header: "Barcode", width: "16%" },
        { header: "Status", width: "16%" },
        { header: "On Hand", align: "center", width: "12%" },
        { header: "Selling Rate", align: "right", width: "14%" },
        { header: "Est. Valuation", align: "right", width: "16%" },
      ],
      rows: visible.map((p) => {
        const health = describeStock(p, movements);
        const estVal = p.stock * (p.purchase_price ?? p.selling_price ?? p.price * 0.85);
        return {
          cells: [
            p.name,
            p.barcode || "—",
            health.label,
            `${p.stock} ${p.unit ?? "pcs"}`,
            formatPrice(p.selling_price ?? p.price),
            formatPrice(estVal),
          ],
        };
      }),
      summaryRows: [
        { label: "Total SKUs Listed", value: String(visible.length) },
        {
          label: "Total Estimated Stock Value",
          value: formatPrice(inventoryValue || totalVal),
          isBold: true,
          isHighlight: true,
        },
      ],
      notes: [
        "Official Odhavram General Store stock audit statement.",
        "Values computed on current FIFO/average purchase cost basis.",
      ],
      signatories: ["Store Keeper / Inventory Auditor", "Store Proprietor"],
    });
  };

  const printStockLedgerAudit = () => {
    if (movements.length === 0) {
      toast.error("No stock movements found to print.");
      return;
    }
    printSystematicDocument({
      docTitle: "STOCK MOVEMENT & LEDGER AUDIT REGISTER",
      docBadge: "INVENTORY AUDIT COPY",
      docNumber: `STK-LEDGER-${new Date().toISOString().slice(0, 10)}`,
      metadata: [
        { label: "Total Movements Logged", value: movements.length },
        { label: "Generated Date", value: formatDate(new Date().toISOString()) },
      ],
      columns: [
        { header: "Date", width: "16%" },
        { header: "Product", width: "24%" },
        { header: "Type", width: "16%" },
        { header: "Qty Change", align: "right", width: "14%" },
        { header: "Before", align: "center", width: "10%" },
        { header: "After", align: "center", width: "10%" },
        { header: "Notes", width: "10%" },
      ],
      rows: movements.map((m) => ({
        cells: [
          formatDate(m.created_at),
          m.products?.name ?? "—",
          STOCK_MOVEMENT_LABELS[m.movement_type] ?? m.movement_type,
          (m.quantity > 0 ? "+" : "") + m.quantity,
          m.stock_before,
          m.stock_after,
          m.notes || "—",
        ],
      })),
      summaryRows: [
        { label: "Total Stock Transaction Rows", value: String(movements.length) },
      ],
      notes: [
        "Official Odhavram General Store stock ledger history.",
      ],
      signatories: ["Inventory In-Charge", "Auditor / Manager"],
    });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-gray-600">
            Items that need a purchase are listed first. Suggestions follow recent sales.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/inventory/quick-stock">
            <Button className="bg-emerald-700 hover:bg-emerald-800 text-white">
              <ScanBarcode className="mr-1.5 h-4 w-4" />
              Quick Stock In (Scanner)
            </Button>
          </Link>
          <Link href="/admin/products/import">
            <Button variant="outline">
              <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-600" />
              Bulk CSV Import
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={printStockValuation}
            className="gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-semibold"
          >
            <Printer className="h-4 w-4 text-emerald-600" />
            <span>Print Stock Valuation</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowVerificationModal(true)}
            className="border-blue-200 text-blue-800 hover:bg-blue-50"
          >
            <Printer className="mr-1.5 h-4 w-4 text-blue-600" />
            Stock Audit Sheet
          </Button>
          <Button variant="outline" href="/admin/reorder">
            <Sparkles className="mr-1 h-4 w-4" />
            Smart reorder
          </Button>
          <Button variant="outline" href="/admin/products">
            Add / Edit Products
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-600">Stock value</p>
          <p className="text-2xl font-bold text-green-800">{formatPrice(inventoryValue)}</p>
        </div>
        <button
          type="button"
          onClick={() => setFilter("needs_action")}
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left"
        >
          <p className="flex items-center gap-1 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Need a look
          </p>
          <p className="text-2xl font-bold">{actionCount}</p>
          <p className="text-xs text-amber-800">Low, empty, or expiring soon</p>
        </button>
        <div className="rounded-xl border bg-orange-50 p-4">
          <p className="text-sm text-orange-800">Expiring in 30 days</p>
          <p className="text-2xl font-bold">{expiring.length}</p>
        </div>
      </div>

      {lowStock.length > 0 && filter !== "healthy" && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-1 font-semibold text-amber-900">Suggested purchases</h2>
          <p className="mb-3 text-xs text-amber-800">
            Based on your minimum stock and what sold in the last 2 weeks.
          </p>
          <ul className="space-y-1 text-sm">
            {lowStock.slice(0, 8).map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>{p.name}</span>
                <span className="shrink-0 font-medium text-amber-900">
                  Buy {p.required_quantity} more
                </span>
              </li>
            ))}
          </ul>
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

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search by name or barcode"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {tab === "stock" && (
        <div className="mb-4 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                filter === c.id
                  ? "bg-green-700 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {tab === "lots" && (
        <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="max-h-[calc(100vh-270px)] sm:max-h-[calc(100vh-250px)] min-h-[300px] overflow-y-auto overscroll-contain scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur-xs shadow-xs text-xs font-semibold uppercase tracking-wider text-gray-700">
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
                  <tr key={l.id} className="border-t hover:bg-gray-50/80 transition-colors">
                    <td className="p-3 font-medium text-gray-900">{l.products?.name ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{l.barcode}</td>
                    <td className="p-3">{l.lot_number ?? "—"}</td>
                    <td className="p-3">{l.batch_number ?? "—"}</td>
                    <td
                      className={`p-3 font-medium ${
                        l.current_stock <= 5 ? "text-red-600 font-bold" : ""
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
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      No lots found. Add purchases with barcodes to create lots.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {lots.length > 0 && (
            <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-2 text-xs text-gray-500 flex items-center justify-between">
              <span>Showing {lots.length} lot / batch record{lots.length === 1 ? "" : "s"}</span>
              <span className="hidden sm:inline text-gray-400">Scroll table vertically to review older lots</span>
            </div>
          )}
        </div>
      )}

      {tab === "ledger" && (
        <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b bg-gray-50/80 px-4 py-2.5">
            <span className="text-xs font-semibold text-gray-700">Stock Movements History ({movements.length} records)</span>
            {movements.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={printStockLedgerAudit}
                className="gap-1 bg-white text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Stock Ledger</span>
              </Button>
            )}
          </div>
          <div className="max-h-[calc(100vh-270px)] sm:max-h-[calc(100vh-250px)] min-h-[300px] overflow-y-auto overscroll-contain scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur-xs shadow-xs text-xs font-semibold uppercase tracking-wider text-gray-700">
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
                  <tr key={m.id} className="border-t hover:bg-gray-50/80 transition-colors">
                    <td className="p-3 whitespace-nowrap">{formatDate(m.created_at)}</td>
                    <td className="p-3 font-medium text-gray-900">{m.products?.name ?? "—"}</td>
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
          {movements.length > 0 && (
            <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-2 text-xs text-gray-500 flex items-center justify-between">
              <span>Showing {movements.length} stock movement{movements.length === 1 ? "" : "s"}</span>
              <span className="hidden sm:inline text-gray-400">Scroll table vertically to review audit trails</span>
            </div>
          )}
        </div>
      )}

      {tab === "stock" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="max-h-[calc(100vh-270px)] sm:max-h-[calc(100vh-250px)] min-h-[300px] overflow-y-auto overscroll-contain scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur-xs shadow-xs text-xs font-semibold uppercase tracking-wider text-gray-700">
                <tr>
                  <th className="p-3 text-left">Product</th>
                  <th className="text-left">Status</th>
                  <th>On hand</th>
                  <th>Suggestion</th>
                  <th>Selling</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-500">
                      Loading stock…
                    </td>
                  </tr>
                )}
                {!loading &&
                  visible.map((p) => {
                    const health = describeStock(p, movements);
                    return (
                      <tr key={p.id} className="border-t hover:bg-gray-50/80 transition-colors">
                        <td className="p-3">
                          <p className="font-medium text-gray-900">{p.name}</p>
                          <p className="font-mono text-xs text-gray-500">
                            {p.barcode ?? "—"}
                          </p>
                        </td>
                        <td className="p-3">
                          <span
                            className={cn(
                              "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                              HEALTH_STYLE[health.key]
                            )}
                          >
                            {health.label}
                          </span>
                          <p className="mt-1 max-w-[16rem] text-xs text-gray-500">{health.hint}</p>
                        </td>
                        <td className="p-3 font-medium">
                          {p.stock} {p.unit ?? "pcs"}
                        </td>
                        <td className="p-3">
                          {health.suggestedBuy > 0 ? (
                            <span className="font-medium text-amber-800">
                              Buy {health.suggestedBuy}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-3">{formatPrice(p.selling_price ?? p.price)}</td>
                        <td className="p-3">
                          {adjustId === p.id ? (
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                className="w-20"
                                value={adjustQty || ""}
                                onChange={(e) => setAdjustQty(Number(e.target.value))}
                                placeholder="+ / −"
                              />
                              <Button size="sm" onClick={() => void handleAdjust(p.id)}>
                                Save
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                className="rounded border px-2 py-0.5 text-xs hover:bg-gray-50"
                                onClick={() => void handleAdjust(p.id, 1)}
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                className="rounded border px-2 py-0.5 text-xs hover:bg-gray-50"
                                onClick={() => void handleAdjust(p.id, -1)}
                              >
                                −1
                              </button>
                              <button
                                type="button"
                                className="text-xs text-green-700 underline"
                                onClick={() => setAdjustId(p.id)}
                              >
                                Adjust
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                {!loading && visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      Nothing in this view. Try “All” or clear the search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {visible.length > 0 && (
            <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-2.5 text-xs text-gray-500 flex items-center justify-between">
              <span>Showing {visible.length} of {products.length} product{products.length === 1 ? "" : "s"}</span>
              <span className="hidden sm:inline text-gray-400">Scroll table vertically to review stock catalog</span>
            </div>
          )}
        </div>
      )}

      {tab === "stock" && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">
              <Barcode className="mr-1 inline h-5 w-5" />
              Barcode Labels
            </h2>
            <Button variant="outline" size="sm" onClick={() => printBarcodeLabels()}>
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

      <StockVerificationModal
        open={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        products={products}
      />
    </div>
  );
}

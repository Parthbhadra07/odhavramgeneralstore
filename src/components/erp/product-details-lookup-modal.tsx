"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  ScanBarcode,
  Tag,
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Percent,
  Layers,
  X,
  Plus,
  ArrowRight,
  Barcode,
  DollarSign,
  Calendar,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarcodeScanner } from "@/components/erp/barcode-scanner";
import { inventoryService } from "@/services/erp/inventory.service";
import { lotService } from "@/services/erp/lot.service";
import type { ErpProduct, ProductLot } from "@/types/erp";
import { formatPrice } from "@/utils/format";
import { toast } from "sonner";

interface ProductDetailsLookupModalProps {
  open: boolean;
  onClose: () => void;
  onAddToCart?: (product: ErpProduct) => void;
}

export function ProductDetailsLookupModal({
  open,
  onClose,
  onAddToCart,
}: ProductDetailsLookupModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ErpProduct[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<ErpProduct | null>(null);
  const [lots, setLots] = useState<ProductLot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [showCameraScan, setShowCameraScan] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input whenever modal opens
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedProduct(null);
      setLots([]);
      setShowCameraScan(false);
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 80);
    }
  }, [open]);

  // Handle ESC to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Search debouncing
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSelectedIndex(0);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await inventoryService.listProducts({ search: q });
        setSearchResults(results.slice(0, 15));
        setSelectedIndex(0);
      } catch {
        toast.error("Failed to search products");
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load lots when a product is selected
  const handleSelectProduct = async (product: ErpProduct) => {
    setSelectedProduct(product);
    setLotsLoading(true);
    try {
      const pLots = await lotService.listByProduct(product.id);
      setLots(pLots);
    } catch {
      setLots([]);
    } finally {
      setLotsLoading(false);
    }
  };

  // Direct barcode resolve
  const handleBarcodeLookup = async (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;
    setSearchLoading(true);
    try {
      const resolved = await inventoryService.resolveByBarcode(trimmed);
      if (resolved?.product) {
        await handleSelectProduct(resolved.product);
        setSearchQuery("");
        setSearchResults([]);
        return;
      }
      const products = await inventoryService.listProducts({ search: trimmed });
      if (products[0]) {
        await handleSelectProduct(products[0]);
        setSearchQuery("");
        setSearchResults([]);
        return;
      }
      toast.error(`No product found for barcode: ${trimmed}`);
    } catch {
      toast.error("Lookup failed");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(searchResults.length - 1, prev + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults.length > 0 && searchResults[selectedIndex]) {
        await handleSelectProduct(searchResults[selectedIndex]);
        return;
      }
      if (searchQuery.trim()) {
        await handleBarcodeLookup(searchQuery);
      }
    }
  };

  if (!open) return null;

  // Price calculations
  const purchasePrice = selectedProduct?.purchase_price ?? null;
  const sellingPrice = Number(selectedProduct?.selling_price ?? selectedProduct?.price ?? 0);
  const mrp = Number(selectedProduct?.mrp ?? selectedProduct?.price ?? 0);
  const discountPercent = Number(selectedProduct?.discount_percent ?? 0);
  const profit = purchasePrice !== null && purchasePrice > 0 ? sellingPrice - purchasePrice : null;
  const profitMarginPercent =
    profit !== null && sellingPrice > 0 ? (profit / sellingPrice) * 100 : null;
  const markupPercent =
    profit !== null && purchasePrice !== null && purchasePrice > 0
      ? (profit / purchasePrice) * 100
      : null;

  const stock = selectedProduct?.stock ?? 0;
  const minStock = selectedProduct?.min_stock_level ?? 5;
  const reorderLevel = selectedProduct?.reorder_level ?? 10;
  const unit = selectedProduct?.unit ?? "pcs";

  const isOutOfStock = stock <= 0;
  const isLowStock = !isOutOfStock && stock <= minStock;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-900 to-indigo-900 px-5 py-3.5 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white backdrop-blur">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold sm:text-lg">Product Details & Price Check</h2>
              <p className="text-xs text-blue-200">
                Quick lookup for purchase price, MRP, selling price, and stock levels
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-blue-200 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar Section */}
        <div className="border-b border-gray-100 bg-slate-50 p-4">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Scan barcode gun or type product name, SKU & hit Enter..."
                className="h-11 pl-10 pr-9 text-sm font-medium border-gray-300 bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
            <Button
              type="button"
              variant={showCameraScan ? "primary" : "outline"}
              onClick={() => setShowCameraScan((s) => !s)}
              className="h-11 shrink-0 px-3.5 gap-1.5"
            >
              <ScanBarcode className="h-4 w-4" />
              <span className="hidden sm:inline">{showCameraScan ? "Hide Camera" : "Camera Scan"}</span>
            </Button>
          </div>

          {/* Camera scanner drawer */}
          {showCameraScan && (
            <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 shadow-inner">
              <BarcodeScanner
                defaultMode="camera"
                onScan={(code) => {
                  void handleBarcodeLookup(code);
                  setShowCameraScan(false);
                }}
                onClose={() => setShowCameraScan(false)}
              />
            </div>
          )}

          {/* Search Dropdown / Suggestion List */}
          {searchLoading && (
            <p className="mt-2 text-xs text-gray-500 animate-pulse">Searching inventory...</p>
          )}

          {searchResults.length > 0 && (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg">
              {searchResults.map((p, idx) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => void handleSelectProduct(p)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      idx === selectedIndex ? "bg-blue-100 font-semibold text-blue-900" : "hover:bg-blue-50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500 font-mono">
                        {p.barcode ? `Barcode: ${p.barcode}` : p.sku ? `SKU: ${p.sku}` : "No code"}
                      </p>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <p className="font-semibold text-gray-900">
                        {formatPrice(p.selling_price ?? p.price)}
                      </p>
                      <p className="text-xs text-gray-500">{p.stock} in stock</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {searchQuery && !searchLoading && searchResults.length === 0 && !selectedProduct && (
            <p className="mt-2 text-xs text-gray-500">
              No product matched. Hit <strong>Enter</strong> to run an exact barcode lookup.
            </p>
          )}
        </div>

        {/* Modal Body: Selected Product Details */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {!selectedProduct ? (
            <div className="py-12 text-center text-gray-400">
              <Package className="mx-auto mb-3 h-12 w-12 opacity-30 text-gray-400" />
              <h3 className="text-base font-semibold text-gray-700">No Product Selected</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                Scan a barcode or start typing product name or SKU above to check its full pricing, stock, cost, and batch details.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Product Title Header Card */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                        {selectedProduct.categories?.name ?? "General"}
                      </span>
                      {selectedProduct.brand && (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          Brand: {selectedProduct.brand}
                        </span>
                      )}
                      {discountPercent > 0 && (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                          {discountPercent}% OFF
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">
                      {selectedProduct.name}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 font-mono">
                      {selectedProduct.barcode && (
                        <span className="inline-flex items-center gap-1">
                          <Barcode className="h-3.5 w-3.5 text-gray-400" />
                          Barcode: <strong>{selectedProduct.barcode}</strong>
                        </span>
                      )}
                      {selectedProduct.sku && (
                        <span>
                          SKU: <strong>{selectedProduct.sku}</strong>
                        </span>
                      )}
                      {selectedProduct.hsn_code && (
                        <span>
                          HSN: <strong>{selectedProduct.hsn_code}</strong>
                        </span>
                      )}
                      <span>
                        GST: <strong>{selectedProduct.gst_percentage ?? 0}%</strong>
                      </span>
                    </div>
                  </div>

                  {/* Stock Status Pill */}
                  <div className="shrink-0 text-right">
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                        isOutOfStock
                          ? "bg-red-100 text-red-800 border border-red-200"
                          : isLowStock
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {isOutOfStock ? (
                        <XCircle className="h-3.5 w-3.5" />
                      ) : isLowStock ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      {isOutOfStock ? "Out of Stock" : isLowStock ? "Low Stock" : "In Stock"}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Available: <strong className="text-gray-900 text-sm">{stock}</strong> {unit}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4 Primary Price & Cost Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Purchase Price (Cost) */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-center shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    Purchase Price
                  </p>
                  <p className="mt-1 text-lg sm:text-2xl font-black text-amber-950">
                    {purchasePrice !== null ? formatPrice(purchasePrice) : "Not set"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-amber-700 font-medium">Store Cost Price</p>
                </div>

                {/* MRP */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    MRP
                  </p>
                  <p className="mt-1 text-lg sm:text-2xl font-black text-slate-900">
                    {mrp > 0 ? formatPrice(mrp) : formatPrice(sellingPrice)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500 font-medium">Maximum Retail</p>
                </div>

                {/* Selling Price */}
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-center shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
                    Selling Price
                  </p>
                  <p className="mt-1 text-lg sm:text-2xl font-black text-blue-900">
                    {formatPrice(sellingPrice)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-blue-700 font-medium">
                    {discountPercent > 0 ? `${discountPercent}% discount applied` : "Counter Rate"}
                  </p>
                </div>

                {/* Gross Profit Margin */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-center shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Profit Margin
                  </p>
                  <p className="mt-1 text-lg sm:text-2xl font-black text-emerald-900">
                    {profit !== null ? (
                      profit >= 0 ? `+${formatPrice(profit)}` : `-${formatPrice(Math.abs(profit))}`
                    ) : (
                      "N/A"
                    )}
                  </p>
                  <p className="mt-0.5 text-[10px] font-bold text-emerald-700">
                    {profitMarginPercent !== null ? `${profitMarginPercent.toFixed(1)}% margin` : "Set cost price"}
                  </p>
                </div>
              </div>

              {/* Stock & Reorder Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-200 bg-white p-3.5 text-xs text-gray-700 shadow-sm space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm pb-1 border-b border-gray-100">
                    <Package className="h-4 w-4 text-blue-600" />
                    Stock Breakdown
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Current On Hand:</span>
                    <span className="font-semibold text-gray-900">{stock} {unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Min Stock Warning Level:</span>
                    <span className="font-semibold text-gray-900">{minStock} {unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Suggested Reorder Level:</span>
                    <span className="font-semibold text-gray-900">{reorderLevel} {unit}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3.5 text-xs text-gray-700 shadow-sm space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm pb-1 border-b border-gray-100">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    Financial & Tax Breakdown
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Markup on Cost:</span>
                    <span className="font-semibold text-emerald-700">
                      {markupPercent !== null ? `+${markupPercent.toFixed(1)}%` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">GST Percentage:</span>
                    <span className="font-semibold text-gray-900">{selectedProduct.gst_percentage ?? 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customer Savings vs MRP:</span>
                    <span className="font-semibold text-emerald-700">
                      {mrp > sellingPrice ? formatPrice(mrp - sellingPrice) : "None"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Batches / Lots Section (if available) */}
              {lots.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm pb-2 border-b border-gray-100">
                    <Layers className="h-4 w-4 text-indigo-600" />
                    Active Lots & Batches ({lots.length})
                  </div>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b text-gray-500 uppercase tracking-wider text-[10px]">
                          <th className="py-1 px-2">Batch / Lot</th>
                          <th className="py-1 px-2">Lot Barcode</th>
                          <th className="py-1 px-2">Expiry Date</th>
                          <th className="py-1 px-2 text-right">Lot Stock</th>
                          <th className="py-1 px-2 text-right">Selling Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lots.map((lot) => (
                          <tr key={lot.id} className="hover:bg-gray-50">
                            <td className="py-1.5 px-2 font-medium text-gray-900">
                              {lot.batch_number || lot.lot_number || "Default"}
                            </td>
                            <td className="py-1.5 px-2 font-mono text-gray-600">
                              {lot.barcode}
                            </td>
                            <td className="py-1.5 px-2 text-gray-600">
                              {lot.expiry_date ? (
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3 w-3 text-gray-400" />
                                  {lot.expiry_date}
                                </span>
                              ) : (
                                "No Expiry"
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-right font-semibold text-gray-900">
                              {lot.current_stock}
                            </td>
                            <td className="py-1.5 px-2 text-right font-semibold text-blue-700">
                              {formatPrice(lot.selling_price ?? sellingPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedProduct(null);
              setSearchQuery("");
              setSearchResults([]);
              searchInputRef.current?.focus();
            }}
            disabled={!selectedProduct}
            className="text-xs text-gray-600 hover:text-gray-900"
          >
            Check Another Product
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close (Esc)
            </Button>
            {onAddToCart && selectedProduct && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={isOutOfStock}
                onClick={() => {
                  onAddToCart(selectedProduct);
                  toast.success(`Added ${selectedProduct.name} to bill`);
                  onClose();
                }}
                className="gap-1.5 font-bold"
              >
                <Plus className="h-4 w-4" />
                Add to Bill
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

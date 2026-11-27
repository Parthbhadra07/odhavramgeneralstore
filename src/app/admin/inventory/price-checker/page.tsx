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
  Calendar,
  Barcode,
  DollarSign,
  ArrowUpRight,
  Boxes,
} from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarcodeScanner } from "@/components/erp/barcode-scanner";
import { inventoryService } from "@/services/erp/inventory.service";
import { lotService } from "@/services/erp/lot.service";
import type { ErpProduct, ProductLot } from "@/types/erp";
import { formatPrice } from "@/utils/format";
import { getProductPackagingInfo } from "@/utils/packaging";
import { toast } from "sonner";

export default function PriceAndStockCheckerPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ErpProduct[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<ErpProduct | null>(null);
  const [lots, setLots] = useState<ProductLot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [showCameraScan, setShowCameraScan] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

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

  const packagingInfo = selectedProduct ? getProductPackagingInfo(selectedProduct) : null;

  const isOutOfStock = stock <= 0;
  const isLowStock = !isOutOfStock && stock <= minStock;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Product Price & Stock Checker
          </h1>
          <p className="text-sm text-gray-500">
            Instantly lookup purchase price, MRP, selling price, margins, and real-time inventory stock
          </p>
        </div>
        <Link href="/admin/pos">
          <Button variant="outline" size="sm" className="gap-1.5 font-medium">
            Open POS Billing <ArrowUpRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Search Input Box */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Scan barcode gun or type product name, SKU & hit Enter..."
              className="h-12 pl-10 pr-9 text-base font-medium border-gray-300 bg-gray-50/50 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
          <Button
            type="button"
            variant={showCameraScan ? "primary" : "outline"}
            onClick={() => setShowCameraScan((s) => !s)}
            className="h-12 shrink-0 px-4 gap-2"
          >
            <ScanBarcode className="h-4 w-4" />
            <span className="hidden sm:inline">{showCameraScan ? "Hide Camera" : "Camera Scan"}</span>
          </Button>
        </div>

        {showCameraScan && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 shadow-inner">
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

        {searchLoading && (
          <p className="mt-2 text-xs text-gray-500 animate-pulse">Searching inventory...</p>
        )}

        {searchResults.length > 0 && (
          <ul className="mt-3 max-h-60 space-y-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
            {searchResults.map((p, idx) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => void handleSelectProduct(p)}
                  className={`flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-left text-sm transition-colors ${
                    idx === selectedIndex ? "bg-blue-100 font-semibold text-blue-900" : "hover:bg-blue-50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500 font-mono">
                      {p.barcode ? `Barcode: ${p.barcode}` : p.sku ? `SKU: ${p.sku}` : "No code"} · {p.categories?.name ?? "General"}
                    </p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className="text-base font-bold text-gray-900">
                      {formatPrice(p.selling_price ?? p.price)}
                    </p>
                    <p className="text-xs text-gray-500">{p.stock} in stock</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Product Details Section */}
      {!selectedProduct ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center text-gray-400">
          <Package className="mx-auto mb-3 h-14 w-14 opacity-25" />
          <h3 className="text-lg font-bold text-gray-700">Scan or Search a Product</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Scan any barcode or search by item name to view purchase price, MRP, profit margin, GST, and real-time stock levels.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">
                    {selectedProduct.categories?.name ?? "General"}
                  </span>
                  {selectedProduct.brand && (
                    <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                      Brand: {selectedProduct.brand}
                    </span>
                  )}
                  {discountPercent > 0 && (
                    <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">
                      {discountPercent}% OFF
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-black text-gray-900 leading-tight">
                  {selectedProduct.name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-gray-600 font-mono">
                  {selectedProduct.barcode && (
                    <span className="inline-flex items-center gap-1.5">
                      <Barcode className="h-4 w-4 text-gray-400" />
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

              {/* Status Pill */}
              <div className="shrink-0 text-right">
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold shadow-sm ${
                    isOutOfStock
                      ? "bg-red-100 text-red-800 border border-red-200"
                      : isLowStock
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {isOutOfStock ? (
                    <XCircle className="h-4 w-4" />
                  ) : isLowStock ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {isOutOfStock ? "Out of Stock" : isLowStock ? "Low Stock" : "In Stock"}
                </div>
                <p className="mt-1.5 text-sm text-gray-500">
                  Current Stock: <strong className="text-gray-900 text-base">{stock}</strong> {unit}
                </p>
              </div>
            </div>
          </div>

          {/* 4 Pricing Matrix Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Purchase Price (Cost) */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Purchase Price
              </p>
              <p className="mt-1 text-2xl lg:text-3xl font-black text-amber-950">
                {purchasePrice !== null ? formatPrice(purchasePrice) : "Not Set"}
              </p>
              <p className="mt-1 text-xs text-amber-700 font-medium">Store Cost Price</p>
            </div>

            {/* MRP */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                MRP
              </p>
              <p className="mt-1 text-2xl lg:text-3xl font-black text-slate-900">
                {mrp > 0 ? formatPrice(mrp) : formatPrice(sellingPrice)}
              </p>
              <p className="mt-1 text-xs text-slate-500 font-medium">Maximum Retail</p>
            </div>

            {/* Selling Price */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-800">
                Selling Price
              </p>
              <p className="mt-1 text-2xl lg:text-3xl font-black text-blue-900">
                {formatPrice(sellingPrice)}
              </p>
              <p className="mt-1 text-xs text-blue-700 font-medium">
                {discountPercent > 0 ? `${discountPercent}% discount applied` : "Counter Rate"}
              </p>
            </div>

            {/* Profit Margin */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Gross Profit Margin
              </p>
              <p className="mt-1 text-2xl lg:text-3xl font-black text-emerald-900">
                {profit !== null ? (
                  profit >= 0 ? `+${formatPrice(profit)}` : `-${formatPrice(Math.abs(profit))}`
                ) : (
                  "N/A"
                )}
              </p>
              <p className="mt-1 text-xs font-bold text-emerald-700">
                {profitMarginPercent !== null ? `${profitMarginPercent.toFixed(1)}% margin` : "Set cost price"}
              </p>
            </div>
          </div>

          {/* Multi-Unit Purchase Price & Packaging Breakdown */}
          {packagingInfo && (
            <div className="rounded-2xl border border-blue-200/90 bg-gradient-to-br from-blue-50/50 via-indigo-50/25 to-white p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Boxes className="h-5 w-5 text-blue-600" />
                    <h3 className="text-base font-bold text-gray-900">
                      Multi-Unit Purchase Cost &amp; Price Breakdown
                    </h3>
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                      {packagingInfo.tierTypeLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    {packagingInfo.tierTypeDescription}
                  </p>
                </div>

                <div className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200/60">
                  Single Barcode Multi-Pack System
                </div>
              </div>

              {/* 3 Tier Pricing Cards: PCS, PKT, BOX */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* 1. PCS Tier Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">1</span>
                      <span className="font-bold text-gray-900 text-sm">Piece (PCS)</span>
                    </div>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-mono font-bold text-blue-700">
                      1 pc
                    </span>
                  </div>

                  {/* Purchase Cost Highlight */}
                  <div className="rounded-lg bg-amber-50/90 border border-amber-200 p-2.5 text-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
                      PCS Purchase Cost
                    </span>
                    <span className="text-xl font-black text-amber-950 mt-0.5 block">
                      {packagingInfo.pcsTier.purchasePrice !== null ? formatPrice(packagingInfo.pcsTier.purchasePrice) : "Not Set"}
                    </span>
                    <span className="text-[10px] text-amber-700 font-medium">Cost per single piece</span>
                  </div>

                  {/* Rates & Margins */}
                  <div className="space-y-1.5 text-xs pt-1 border-t border-gray-100">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Selling Price:</span>
                      <span className="font-bold text-blue-700">{formatPrice(packagingInfo.pcsTier.sellingPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Base MRP:</span>
                      <span className="font-medium text-gray-800">{formatPrice(packagingInfo.pcsTier.mrp)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Gross Margin:</span>
                      <span className="font-bold text-emerald-700">
                        {packagingInfo.pcsTier.profit !== null
                          ? `+${formatPrice(packagingInfo.pcsTier.profit)} (${packagingInfo.pcsTier.profitMarginPercent?.toFixed(1)}%)`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. PKT Tier Card */}
                <div className={`rounded-xl border p-4 shadow-2xs space-y-3 ${
                  packagingInfo.pktTier.isAvailable
                    ? "border-slate-200 bg-white"
                    : "border-dashed border-gray-300 bg-gray-50/70"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">2</span>
                      <span className="font-bold text-gray-900 text-sm">Packet (PKT)</span>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[11px] font-mono font-medium ${
                      packagingInfo.pktTier.isAvailable
                        ? "bg-indigo-50 text-indigo-700 font-bold"
                        : "bg-gray-200 text-gray-600"
                    }`}>
                      {packagingInfo.pktTier.isAvailable ? `${packagingInfo.piecesPerPacket} pcs` : "N/A"}
                    </span>
                  </div>

                  {packagingInfo.pktTier.isAvailable ? (
                    <>
                      {/* Purchase Cost Highlight */}
                      <div className="rounded-lg bg-amber-50/90 border border-amber-200 p-2.5 text-center">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
                          PKT Purchase Cost
                        </span>
                        <span className="text-xl font-black text-amber-950 mt-0.5 block">
                          {packagingInfo.pktTier.purchasePrice !== null ? formatPrice(packagingInfo.pktTier.purchasePrice) : "Not Set"}
                        </span>
                        <span className="text-[10px] text-amber-700 font-medium">
                          {packagingInfo.piecesPerPacket} pcs × {formatPrice(purchasePrice || 0)}
                        </span>
                      </div>

                      {/* Rates & Margins */}
                      <div className="space-y-1.5 text-xs pt-1 border-t border-gray-100">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Packet Selling:</span>
                          <span className="font-bold text-indigo-700">{formatPrice(packagingInfo.pktTier.sellingPrice)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Packet MRP:</span>
                          <span className="font-medium text-gray-800">{formatPrice(packagingInfo.pktTier.mrp)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Gross Margin:</span>
                          <span className="font-bold text-emerald-700">
                            {packagingInfo.pktTier.profit !== null
                              ? `+${formatPrice(packagingInfo.pktTier.profit)} (${packagingInfo.pktTier.profitMarginPercent?.toFixed(1)}%)`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-4 text-center">
                      <span className="inline-block rounded-full bg-slate-200/80 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {packagingInfo.tierType === "2_tier_pcs_box" ? "Direct Pcs → Box" : "No Packet Tier"}
                      </span>
                      <p className="mt-2 text-xs text-gray-500 px-2 leading-relaxed">
                        {packagingInfo.tierType === "2_tier_pcs_box"
                          ? "This product (e.g. Cadbury / Chocolates) is packed directly from Pieces into a Box. It does not have an intermediate packet tier."
                          : "No packet packaging multiplier defined for this product."}
                      </p>
                    </div>
                  )}
                </div>

                {/* 3. BOX Tier Card */}
                <div className={`rounded-xl border p-4 shadow-2xs space-y-3 ${
                  packagingInfo.boxTier.isAvailable
                    ? "border-slate-200 bg-white"
                    : "border-dashed border-gray-300 bg-gray-50/70"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-[11px] font-bold text-purple-700">3</span>
                      <span className="font-bold text-gray-900 text-sm">Master Box (BOX)</span>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[11px] font-mono font-medium ${
                      packagingInfo.boxTier.isAvailable
                        ? "bg-purple-50 text-purple-700 font-bold"
                        : "bg-gray-200 text-gray-600"
                    }`}>
                      {packagingInfo.boxTier.isAvailable
                        ? packagingInfo.tierType === "3_tier"
                          ? `${packagingInfo.packetsPerBox} pkts (${packagingInfo.totalPiecesPerBox} pcs)`
                          : `${packagingInfo.totalPiecesPerBox} pcs`
                        : "N/A"}
                    </span>
                  </div>

                  {packagingInfo.boxTier.isAvailable ? (
                    <>
                      {/* Purchase Cost Highlight */}
                      <div className="rounded-lg bg-amber-50/90 border border-amber-200 p-2.5 text-center">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
                          BOX Purchase Cost
                        </span>
                        <span className="text-xl font-black text-amber-950 mt-0.5 block">
                          {packagingInfo.boxTier.purchasePrice !== null ? formatPrice(packagingInfo.boxTier.purchasePrice) : "Not Set"}
                        </span>
                        <span className="text-[10px] text-amber-700 font-medium">
                          {packagingInfo.totalPiecesPerBox} pcs × {formatPrice(purchasePrice || 0)}
                        </span>
                      </div>

                      {/* Rates & Margins */}
                      <div className="space-y-1.5 text-xs pt-1 border-t border-gray-100">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Box Selling:</span>
                          <span className="font-bold text-purple-700">{formatPrice(packagingInfo.boxTier.sellingPrice)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Box MRP:</span>
                          <span className="font-medium text-gray-800">{formatPrice(packagingInfo.boxTier.mrp)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Gross Margin:</span>
                          <span className="font-bold text-emerald-700">
                            {packagingInfo.boxTier.profit !== null
                              ? `+${formatPrice(packagingInfo.boxTier.profit)} (${packagingInfo.boxTier.profitMarginPercent?.toFixed(1)}%)`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-4 text-center">
                      <span className="inline-block rounded-full bg-slate-200/80 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        Single Unit Only
                      </span>
                      <p className="mt-2 text-xs text-gray-500 px-2 leading-relaxed">
                        No master box packaging multiplier configured.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Packaging Breakdown Summary Table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3.5">Tier Unit</th>
                      <th className="py-2.5 px-3.5">Contains</th>
                      <th className="py-2.5 px-3.5 text-right font-black text-amber-900">Purchase Cost</th>
                      <th className="py-2.5 px-3.5 text-right font-black text-blue-900">Selling Price</th>
                      <th className="py-2.5 px-3.5 text-right">MRP</th>
                      <th className="py-2.5 px-3.5 text-right">Profit Margin</th>
                      <th className="py-2.5 px-3.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {/* Piece */}
                    <tr className="hover:bg-blue-50/30">
                      <td className="py-2.5 px-3.5 font-bold text-gray-900">1. Piece (PCS)</td>
                      <td className="py-2.5 px-3.5 font-mono text-gray-600">1 single pc</td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-amber-950">
                        {packagingInfo.pcsTier.purchasePrice !== null ? formatPrice(packagingInfo.pcsTier.purchasePrice) : "—"}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-blue-700">
                        {formatPrice(packagingInfo.pcsTier.sellingPrice)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-gray-600">{formatPrice(packagingInfo.pcsTier.mrp)}</td>
                      <td className="py-2.5 px-3.5 text-right font-semibold text-emerald-700">
                        {packagingInfo.pcsTier.profit !== null
                          ? `+${formatPrice(packagingInfo.pcsTier.profit)} (${packagingInfo.pcsTier.profitMarginPercent?.toFixed(1)}%)`
                          : "—"}
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">Active</span>
                      </td>
                    </tr>

                    {/* Packet */}
                    <tr className={packagingInfo.pktTier.isAvailable ? "hover:bg-blue-50/30" : "bg-gray-50/50 text-gray-400"}>
                      <td className="py-2.5 px-3.5 font-bold text-gray-900">2. Packet (PKT)</td>
                      <td className="py-2.5 px-3.5 font-mono text-gray-600">
                        {packagingInfo.pktTier.isAvailable ? `${packagingInfo.piecesPerPacket} pcs` : "N/A"}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-amber-950">
                        {packagingInfo.pktTier.isAvailable && packagingInfo.pktTier.purchasePrice !== null
                          ? formatPrice(packagingInfo.pktTier.purchasePrice)
                          : "—"}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-indigo-700">
                        {packagingInfo.pktTier.isAvailable ? formatPrice(packagingInfo.pktTier.sellingPrice) : "—"}
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-gray-600">
                        {packagingInfo.pktTier.isAvailable ? formatPrice(packagingInfo.pktTier.mrp) : "—"}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-semibold text-emerald-700">
                        {packagingInfo.pktTier.isAvailable && packagingInfo.pktTier.profit !== null
                          ? `+${formatPrice(packagingInfo.pktTier.profit)} (${packagingInfo.pktTier.profitMarginPercent?.toFixed(1)}%)`
                          : "—"}
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        {packagingInfo.pktTier.isAvailable ? (
                          <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">Active</span>
                        ) : (
                          <span className="rounded bg-gray-200 text-gray-600 px-2 py-0.5 text-[10px] font-medium" title={packagingInfo.pktTier.unavailableReason}>
                            {packagingInfo.tierType === "2_tier_pcs_box" ? "Direct to Box" : "Disabled"}
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Master Box */}
                    <tr className={packagingInfo.boxTier.isAvailable ? "hover:bg-blue-50/30" : "bg-gray-50/50 text-gray-400"}>
                      <td className="py-2.5 px-3.5 font-bold text-gray-900">3. Master Box (BOX)</td>
                      <td className="py-2.5 px-3.5 font-mono text-gray-600">
                        {packagingInfo.boxTier.isAvailable
                          ? packagingInfo.tierType === "3_tier"
                            ? `${packagingInfo.packetsPerBox} pkts (${packagingInfo.totalPiecesPerBox} pcs)`
                            : `${packagingInfo.totalPiecesPerBox} pcs`
                          : "N/A"}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-amber-950">
                        {packagingInfo.boxTier.isAvailable && packagingInfo.boxTier.purchasePrice !== null
                          ? formatPrice(packagingInfo.boxTier.purchasePrice)
                          : "—"}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-purple-700">
                        {packagingInfo.boxTier.isAvailable ? formatPrice(packagingInfo.boxTier.sellingPrice) : "—"}
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-gray-600">
                        {packagingInfo.boxTier.isAvailable ? formatPrice(packagingInfo.boxTier.mrp) : "—"}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-semibold text-emerald-700">
                        {packagingInfo.boxTier.profit !== null
                          ? `+${formatPrice(packagingInfo.boxTier.profit)} (${packagingInfo.boxTier.profitMarginPercent?.toFixed(1)}%)`
                          : "—"}
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        {packagingInfo.boxTier.isAvailable ? (
                          <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">Active</span>
                        ) : (
                          <span className="rounded bg-gray-200 text-gray-600 px-2 py-0.5 text-[10px] font-medium">Disabled</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detailed Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 pb-2 border-b border-gray-100">
                <Package className="h-5 w-5 text-blue-600" />
                Inventory & Stock Management
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Available Stock:</span>
                  <span className="font-bold text-gray-900">{stock} {unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Min Stock Warning Level:</span>
                  <span className="font-semibold text-gray-900">{minStock} {unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Suggested Reorder Level:</span>
                  <span className="font-semibold text-gray-900">{reorderLevel} {unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Unit Type:</span>
                  <span className="font-semibold text-gray-900 uppercase">{unit}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 pb-2 border-b border-gray-100">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Pricing & Tax Intelligence
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Markup on Purchase Cost:</span>
                  <span className="font-bold text-emerald-700">
                    {markupPercent !== null ? `+${markupPercent.toFixed(1)}%` : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GST Percentage:</span>
                  <span className="font-semibold text-gray-900">{selectedProduct.gst_percentage ?? 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">HSN Code:</span>
                  <span className="font-semibold text-gray-900">{selectedProduct.hsn_code ?? "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer Savings vs MRP:</span>
                  <span className="font-bold text-emerald-700">
                    {mrp > sellingPrice ? formatPrice(mrp - sellingPrice) : "None"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Lots table */}
          {lots.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 pb-3 border-b border-gray-100">
                <Layers className="h-5 w-5 text-indigo-600" />
                Active Batches & Lots ({lots.length})
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-gray-500 uppercase tracking-wider text-xs">
                      <th className="py-2 px-3">Batch / Lot</th>
                      <th className="py-2 px-3">Lot Barcode</th>
                      <th className="py-2 px-3">Expiry Date</th>
                      <th className="py-2 px-3 text-right">Lot Stock</th>
                      <th className="py-2 px-3 text-right">Lot Selling Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lots.map((lot) => (
                      <tr key={lot.id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-semibold text-gray-900">
                          {lot.batch_number || lot.lot_number || "Default"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-gray-600">
                          {lot.barcode}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600">
                          {lot.expiry_date ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {lot.expiry_date}
                            </span>
                          ) : (
                            "No Expiry"
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                          {lot.current_stock}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-700">
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
  );
}

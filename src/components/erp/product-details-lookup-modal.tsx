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
  Scale,
  IndianRupee,
  Sparkles,
  Calculator,
  RotateCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarcodeScanner } from "@/components/erp/barcode-scanner";
import { inventoryService } from "@/services/erp/inventory.service";
import { lotService } from "@/services/erp/lot.service";
import type { ErpProduct, ProductLot } from "@/types/erp";
import { formatPrice } from "@/utils/format";
import { toast } from "sonner";

export interface WeightCalcOptions {
  weightInKg: number;
  rate: number;
  unit: string;
  isLoose: boolean;
}

interface ProductDetailsLookupModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: "details" | "weight";
  onAddToCart?: (product: ErpProduct, options?: WeightCalcOptions) => void;
}

const QUICK_WEIGHTS = [
  { label: "50 g", grams: 50 },
  { label: "100 g", grams: 100 },
  { label: "250 g", grams: 250 },
  { label: "500 g", grams: 500 },
  { label: "750 g", grams: 750 },
  { label: "1 kg", grams: 1000 },
  { label: "1.5 kg", grams: 1500 },
  { label: "2 kg", grams: 2000 },
  { label: "5 kg", grams: 5000 },
];

const QUICK_AMOUNTS = [10, 20, 30, 50, 100, 150, 200, 500];
const QUICK_TARES = [
  { label: "0g (None)", grams: 0 },
  { label: "15g (Pouch)", grams: 15 },
  { label: "25g (Box)", grams: 25 },
  { label: "50g (Jar)", grams: 50 },
];

export function ProductDetailsLookupModal({
  open,
  onClose,
  initialTab = "details",
  onAddToCart,
}: ProductDetailsLookupModalProps) {
  const [activeTab, setActiveTab] = useState<"details" | "weight">(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ErpProduct[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<ErpProduct | null>(null);
  const [lots, setLots] = useState<ProductLot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [showCameraScan, setShowCameraScan] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Weight Calculation Tab States
  const [weightMode, setWeightMode] = useState<"weight" | "amount">("weight");
  const [weightUnit, setWeightUnit] = useState<"g" | "kg">("g");
  const [weightInputValue, setWeightInputValue] = useState<string>("500");
  const [amountInputValue, setAmountInputValue] = useState<string>("50");
  const [tareGrams, setTareGrams] = useState<number>(0);
  const [customRate, setCustomRate] = useState<string>("");

  // Sync initial tab when modal opens
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setSearchQuery("");
      setSearchResults([]);
      setSelectedProduct(null);
      setLots([]);
      setShowCameraScan(false);
      setWeightMode("weight");
      setWeightInputValue("500");
      setAmountInputValue("50");
      setTareGrams(0);
      setCustomRate("");

      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 80);
    }
  }, [open, initialTab]);

  // Handle keyboard shortcuts inside modal (ESC to close, F3 for details, F7 for weight)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "F3") {
        e.preventDefault();
        setActiveTab("details");
        return;
      }
      if (e.key === "F7") {
        e.preventDefault();
        setActiveTab("weight");
        return;
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
    setCustomRate(String(product.selling_price ?? product.price ?? ""));
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

  // Base price calculations for Details Tab
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

  // Weight Tab Rate & Amount calculations
  const effectiveRate = customRate !== "" ? parseFloat(customRate) || 0 : sellingPrice;

  let calculatedNetGrams = 0;
  let calculatedNetKg = 0;
  let calculatedPayable = 0;

  if (weightMode === "weight") {
    const rawVal = parseFloat(weightInputValue) || 0;
    const grossGrams = weightUnit === "kg" ? rawVal * 1000 : rawVal;
    calculatedNetGrams = Math.max(0, grossGrams - tareGrams);
    calculatedNetKg = Math.round((calculatedNetGrams / 1000) * 1000) / 1000;
    calculatedPayable = Math.round(calculatedNetKg * effectiveRate * 100) / 100;
  } else {
    // Mode: Calculate Weight from Target Amount
    const targetAmt = parseFloat(amountInputValue) || 0;
    if (effectiveRate > 0) {
      calculatedNetKg = Math.round((targetAmt / effectiveRate) * 1000) / 1000;
      calculatedNetGrams = Math.round(calculatedNetKg * 1000);
      calculatedPayable = Math.round(calculatedNetKg * effectiveRate * 100) / 100;
    }
  }

  const handleAddCalculatedWeightToCart = () => {
    if (!selectedProduct) {
      toast.error("Please search and select an item first");
      return;
    }
    if (calculatedNetKg <= 0) {
      toast.error("Please enter a valid weight or amount");
      return;
    }
    if (!onAddToCart) return;

    onAddToCart(selectedProduct, {
      weightInKg: calculatedNetKg,
      rate: effectiveRate,
      unit: "kg",
      isLoose: true,
    });
    toast.success(
      `Added ${selectedProduct.name} (${calculatedNetKg} kg / ${calculatedNetGrams}g) for ${formatPrice(calculatedPayable)}`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 px-5 py-3 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur shadow-2xs">
              {activeTab === "weight" ? <Scale className="h-5 w-5 text-emerald-400" /> : <Tag className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold sm:text-lg">
                {activeTab === "weight" ? "Weight Calculation & Loose Item Scale" : "Product Details & Price Check"}
              </h2>
              <p className="text-xs text-blue-200">
                {activeTab === "weight"
                  ? "Real-time loose product calculator: grams to ₹, budget to grams & tare deduction"
                  : "Quick lookup for purchase price, MRP, margin, packaging and live stock levels"}
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

        {/* Tab Navigation Header */}
        <div className="flex border-b border-slate-200 bg-slate-100/80 px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
              activeTab === "details"
                ? "border-blue-600 text-blue-950 bg-white rounded-t-xl shadow-2xs"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Package className="h-4 w-4 text-blue-600" />
            <span>Product Details &amp; Pricing</span>
            <kbd className="hidden sm:inline rounded bg-slate-100 px-1 py-0.2 font-mono text-[10px] text-slate-500">
              F3
            </kbd>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("weight")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
              activeTab === "weight"
                ? "border-emerald-600 text-emerald-950 bg-white rounded-t-xl shadow-2xs"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Scale className="h-4 w-4 text-emerald-600" />
            <span>Weight Calculation (Loose Scale)</span>
            <kbd className="hidden sm:inline rounded bg-slate-100 px-1 py-0.2 font-mono text-[10px] text-slate-500">
              F7
            </kbd>
            {selectedProduct && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                Active Item
              </span>
            )}
          </button>
        </div>

        {/* Search Bar Section */}
        <div className="border-b border-gray-100 bg-slate-50 p-3 sm:p-4">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={
                  activeTab === "weight"
                    ? "Search loose item (e.g. Sugar, Rice, Atta, Dal, Oil, Spices)..."
                    : "Scan barcode gun or type product name, SKU & hit Enter..."
                }
                className="h-10 sm:h-11 pl-10 pr-9 text-sm font-medium border-gray-300 bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
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
              className="h-10 sm:h-11 shrink-0 px-3.5 gap-1.5"
            >
              <ScanBarcode className="h-4 w-4" />
              <span className="hidden sm:inline">{showCameraScan ? "Hide Camera" : "Camera Scan"}</span>
            </Button>
          </div>

          {/* Camera scanner drawer */}
          {showCameraScan && (
            <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 shadow-inner">
              <BarcodeScanner
                onScan={async (scanned) => {
                  setShowCameraScan(false);
                  await handleBarcodeLookup(scanned);
                }}
                defaultMode="camera"
              />
            </div>
          )}

          {/* Dropdown Suggestions */}
          {searchLoading && (
            <div className="mt-2 text-xs text-blue-600 font-medium animate-pulse">
              Searching catalogue...
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg z-20">
              <div className="p-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Select matching product ({searchResults.length}):
              </div>
              {searchResults.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    void handleSelectProduct(p);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs sm:text-sm transition-colors ${
                    idx === selectedIndex
                      ? "bg-blue-50 text-blue-900 font-semibold"
                      : "hover:bg-gray-50 text-gray-800"
                  }`}
                >
                  <div className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-gray-900">{p.name}</span>
                    {p.barcode && (
                      <span className="ml-2 font-mono text-[11px] text-gray-400">
                        ({p.barcode})
                      </span>
                    )}
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <span className="font-bold text-gray-900">
                      {formatPrice(p.selling_price ?? p.price)}
                    </span>
                    <span className="ml-1 text-[11px] text-gray-500">
                      / {p.unit || "pcs"} · {p.stock} in stock
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Main Body (Dual Tab Views) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* TAB 2: WEIGHT CALCULATION & LOOSE PRODUCT SCALE */}
          {activeTab === "weight" && (
            <div className="space-y-5">
              {/* Product Header in Weight Mode */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                      <Scale className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-emerald-950 text-sm sm:text-base">
                        {selectedProduct ? selectedProduct.name : "Custom Loose Product / Weighing Scale"}
                      </h3>
                      <p className="text-xs text-emerald-800">
                        {selectedProduct
                          ? `Live Stock: ${selectedProduct.stock} ${selectedProduct.unit || "kg"} available`
                          : "Select an item above or enter custom rate per kg below"}
                      </p>
                    </div>
                  </div>

                  {/* Rate per kg display/edit */}
                  <div className="flex items-center gap-2 rounded-xl bg-white p-2 border border-emerald-300 shadow-2xs">
                    <span className="text-xs font-semibold text-slate-600">Rate:</span>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">₹</span>
                      <input
                        type="number"
                        step="any"
                        value={customRate}
                        onChange={(e) => setCustomRate(e.target.value)}
                        placeholder="Rate / kg"
                        className="w-24 rounded-lg border border-slate-300 py-1 pl-5 pr-2 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-500">/ kg</span>
                  </div>
                </div>

                {/* Quick breakdown pills */}
                {effectiveRate > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-emerald-200/80 pt-2 text-[11px] text-emerald-900">
                    <span className="font-semibold text-emerald-950">Scale Rates:</span>
                    <span className="rounded-md bg-white px-2 py-0.5 border border-emerald-200 shadow-2xs">
                      100g = <strong>{formatPrice(effectiveRate * 0.1)}</strong>
                    </span>
                    <span className="rounded-md bg-white px-2 py-0.5 border border-emerald-200 shadow-2xs">
                      250g = <strong>{formatPrice(effectiveRate * 0.25)}</strong>
                    </span>
                    <span className="rounded-md bg-white px-2 py-0.5 border border-emerald-200 shadow-2xs">
                      500g = <strong>{formatPrice(effectiveRate * 0.5)}</strong>
                    </span>
                    <span className="rounded-md bg-white px-2 py-0.5 border border-emerald-200 shadow-2xs">
                      1 kg = <strong>{formatPrice(effectiveRate)}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Calculator Mode Switcher */}
              <div className="flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setWeightMode("weight")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                    weightMode === "weight"
                      ? "bg-white text-emerald-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Scale className="h-4 w-4 text-emerald-600" />
                  <span>Mode 1: Weigh Scale &rarr; Price (g / kg)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWeightMode("amount")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                    weightMode === "amount"
                      ? "bg-white text-emerald-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <IndianRupee className="h-4 w-4 text-emerald-600" />
                  <span>Mode 2: Target Rupees &rarr; Weight</span>
                </button>
              </div>

              {/* MODE 1: ENTER WEIGHT -> CALCULATE PRICE */}
              {weightMode === "weight" && (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800">
                        Enter Weight
                      </label>
                      <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setWeightUnit("g")}
                          className={`rounded px-2.5 py-0.5 font-bold transition-colors ${
                            weightUnit === "g" ? "bg-emerald-600 text-white" : "text-slate-600"
                          }`}
                        >
                          Grams (g)
                        </button>
                        <button
                          type="button"
                          onClick={() => setWeightUnit("kg")}
                          className={`rounded px-2.5 py-0.5 font-bold transition-colors ${
                            weightUnit === "kg" ? "bg-emerald-600 text-white" : "text-slate-600"
                          }`}
                        >
                          Kg (kg)
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={weightInputValue}
                        onChange={(e) => setWeightInputValue(e.target.value)}
                        placeholder={weightUnit === "g" ? "e.g. 250 or 500" : "e.g. 1.5"}
                        className="w-full rounded-xl border border-slate-300 py-2.5 pl-4 pr-16 text-lg font-bold text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-slate-400">
                        {weightUnit}
                      </span>
                    </div>

                    {/* Quick Weight Presets */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-500 mr-1">Quick:</span>
                      {QUICK_WEIGHTS.map((qw) => (
                        <button
                          key={qw.label}
                          type="button"
                          onClick={() => {
                            if (weightUnit === "g") {
                              setWeightInputValue(String(qw.grams));
                            } else {
                              setWeightInputValue(String(qw.grams / 1000));
                            }
                          }}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-900 transition"
                        >
                          {qw.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Container / Tare Weight Deduction */}
                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        Tare Weight (Container / Box / Bag):
                      </span>
                      <span className="font-mono font-bold text-rose-600">
                        {tareGrams > 0 ? `-${tareGrams} g deducted` : "0 g"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {QUICK_TARES.map((qt) => (
                        <button
                          key={qt.label}
                          type="button"
                          onClick={() => setTareGrams(qt.grams)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                            tareGrams === qt.grams
                              ? "border-rose-400 bg-rose-50 text-rose-900"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {qt.label}
                        </button>
                      ))}
                      <div className="relative ml-auto flex items-center">
                        <input
                          type="number"
                          value={tareGrams || ""}
                          onChange={(e) => setTareGrams(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          placeholder="Custom g"
                          className="w-20 rounded border border-slate-200 px-2 py-0.5 text-xs text-right"
                        />
                        <span className="ml-1 text-[11px] text-slate-400">g</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 2: ENTER TARGET RUPEES -> CALCULATE WEIGHT */}
              {weightMode === "amount" && (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-800">
                      Enter Customer Budget / Target Amount (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-500">₹</span>
                      <input
                        type="number"
                        step="any"
                        value={amountInputValue}
                        onChange={(e) => setAmountInputValue(e.target.value)}
                        placeholder="e.g. 50 or 100"
                        className="w-full rounded-xl border border-slate-300 py-2.5 pl-8 pr-4 text-lg font-bold text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>

                    {/* Quick Rupee Presets */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-500 mr-1">Quick:</span>
                      {QUICK_AMOUNTS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setAmountInputValue(String(amt))}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-900 transition"
                        >
                          ₹{amt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Calculated Result Executive Card */}
              <div className="rounded-xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      Calculated Net Weight
                    </span>
                    <p className="font-mono text-2xl sm:text-3xl font-extrabold text-emerald-950">
                      {calculatedNetGrams >= 1000 ? `${calculatedNetKg} kg` : `${calculatedNetGrams} grams`}
                    </p>
                    <p className="text-xs text-emerald-800">
                      ({calculatedNetKg} kg @ {formatPrice(effectiveRate)}/kg)
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      Total Payable Amount
                    </span>
                    <p className="font-mono text-2xl sm:text-3xl font-extrabold text-green-700">
                      {formatPrice(calculatedPayable)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {tareGrams > 0 ? `Net weight after -${tareGrams}g tare` : "Net bill weight"}
                    </p>
                  </div>
                </div>

                {onAddToCart && (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleAddCalculatedWeightToCart}
                    className="mt-4 w-full h-11 bg-emerald-700 text-sm font-bold text-white hover:bg-emerald-800 shadow-md gap-2"
                  >
                    <Plus className="h-5 w-5" />
                    Add {calculatedNetGrams >= 1000 ? `${calculatedNetKg} kg` : `${calculatedNetGrams}g`} to Bill ({formatPrice(calculatedPayable)})
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: PRODUCT DETAILS & PRICING */}
          {activeTab === "details" && (
            <div>
              {!selectedProduct ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3 shadow-inner">
                    <Package className="h-8 w-8" />
                  </div>
                  <p className="font-semibold text-gray-700 text-base">No Product Selected</p>
                  <p className="mt-1 max-w-sm text-xs text-gray-500">
                    Scan with your barcode gun or search name above to view purchase rates, profit margins, batch details, and packaging info.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Product Title Bar */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
                          {selectedProduct.name}
                        </h3>
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                            <XCircle className="h-3.5 w-3.5" /> Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5" /> Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> In Stock
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        {selectedProduct.barcode && (
                          <span className="flex items-center gap-1 font-mono">
                            <Barcode className="h-3.5 w-3.5 text-gray-400" />
                            {selectedProduct.barcode}
                          </span>
                        )}
                        {selectedProduct.brand && (
                          <span>Brand: <strong className="text-gray-700">{selectedProduct.brand}</strong></span>
                        )}
                        {selectedProduct.unit && (
                          <span>Unit: <strong className="text-gray-700">{selectedProduct.unit}</strong></span>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveTab("weight");
                        setCustomRate(String(sellingPrice));
                      }}
                      className="gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border-emerald-300 hover:bg-emerald-100"
                    >
                      <Scale className="h-3.5 w-3.5" />
                      Weigh &amp; Calculate (F7)
                    </Button>
                  </div>

                  {/* Live Stock & Pricing Cards */}
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">MRP</span>
                      <p className="mt-0.5 text-lg font-bold text-gray-900">{formatPrice(mrp)}</p>
                      <span className="text-[10px] text-gray-500">Printed on pack</span>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">Selling Price</span>
                      <p className="mt-0.5 text-lg font-bold text-blue-900">{formatPrice(sellingPrice)}</p>
                      <span className="text-[10px] text-blue-600">
                        {discountPercent > 0 ? `${discountPercent}% discount` : "Default POS rate"}
                      </span>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">Purchase Rate</span>
                      <p className="mt-0.5 text-lg font-bold text-amber-950">
                        {purchasePrice !== null ? formatPrice(purchasePrice) : "Not Set"}
                      </p>
                      <span className="text-[10px] text-amber-700">Cost from supplier</span>
                    </div>

                    <div className="rounded-xl border border-green-200 bg-green-50/60 p-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-green-800">Gross Margin</span>
                      <p className="mt-0.5 text-lg font-bold text-green-900">
                        {profit !== null ? formatPrice(profit) : "—"}
                      </p>
                      <span className="text-[10px] text-green-700">
                        {profitMarginPercent !== null ? `${profitMarginPercent.toFixed(1)}% profit` : "Cost not set"}
                      </span>
                    </div>
                  </div>

                  {/* Stock Levels & Packaging Details */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 bg-white p-3.5">
                      <div className="flex items-center justify-between border-b pb-2 text-xs font-bold text-gray-800">
                        <span>Current Stock Balance</span>
                        <span className="text-base text-gray-900">{stock} {unit}</span>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-gray-600">
                        <div className="flex justify-between">
                          <span>Reorder Level:</span>
                          <span className="font-medium text-gray-900">{reorderLevel} {unit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Min Stock Threshold:</span>
                          <span className="font-medium text-gray-900">{minStock} {unit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>GST Rate:</span>
                          <span className="font-medium text-gray-900">{selectedProduct.gst_percentage ?? 0}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-3.5">
                      <div className="flex items-center justify-between border-b pb-2 text-xs font-bold text-gray-800">
                        <span>Pack &amp; Box Hierarchy</span>
                        <span className="text-blue-700 font-medium">B2B Wholesale</span>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-gray-600">
                        <div className="flex justify-between">
                          <span>1 Packet contains:</span>
                          <span className="font-medium text-gray-900">{selectedProduct.pieces_per_packet ?? 12} pcs</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Packet Selling Rate:</span>
                          <span className="font-medium text-gray-900">
                            {selectedProduct.packet_selling_price ? formatPrice(selectedProduct.packet_selling_price) : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>1 Master Box contains:</span>
                          <span className="font-medium text-gray-900">{selectedProduct.packets_per_box ?? 12} packets</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Box Selling Rate:</span>
                          <span className="font-medium text-gray-900">
                            {selectedProduct.box_selling_price ? formatPrice(selectedProduct.box_selling_price) : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lots & Batches Info */}
                  {lots.length > 0 && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                        <Layers className="h-4 w-4 text-indigo-600" />
                        <span>Active Lots &amp; Batches ({lots.length})</span>
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
            {onAddToCart && selectedProduct && activeTab === "details" && (
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

"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import {
  ScanBarcode,
  ArrowLeft,
  Package,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Camera,
  Keyboard,
  Hash,
  Layers,
  History,
  Tag,
  Volume2,
  VolumeX,
  X,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";
import { inventoryService } from "@/services/erp/inventory.service";
import { productService } from "@/services/product.service";
import { categoryService } from "@/services/category.service";
import type { ErpProduct } from "@/types/erp";
import type { Category } from "@/types/database";
import { formatPrice, slugify } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/components/erp/barcode-scanner";
import { cn } from "@/utils/cn";

interface ScanAuditEntry {
  id: string;
  time: string;
  productId: string;
  productName: string;
  barcode: string;
  previousStock: number;
  newStock: number;
  delta: number;
  mode: "add" | "set";
}

function playScanTone(type: "success" | "warning" | "error") {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === "warning") {
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else {
      osc.frequency.setValueAtTime(250, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // Audio context may be restricted before user interaction
  }
}

export default function QuickStockInwardPage() {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [stockMode, setStockMode] = useState<"add" | "set">("add");
  const [showCamera, setShowCamera] = useState(false);

  // Current matched product
  const [currentProduct, setCurrentProduct] = useState<ErpProduct | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [updatingStock, setUpdatingStock] = useState(false);

  // New product inline creation form state
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [newBarcode, setNewBarcode] = useState("");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState<number | "">("");
  const [newMrp, setNewMrp] = useState<number | "">("");
  const [newStock, setNewStock] = useState<number | "">(10);
  const [newCategory, setNewCategory] = useState("");
  const [newUnit, setNewUnit] = useState("pcs");
  const [newBrand, setNewBrand] = useState("");
  const [creatingProduct, setCreatingProduct] = useState(false);

  // Categories list
  const [categories, setCategories] = useState<Category[]>([]);

  // Session audit log
  const [auditLog, setAuditLog] = useState<ScanAuditEntry[]>([]);

  // Input refs for instant auto-focus
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const newNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    categoryService.getAll().then(setCategories).catch(() => {});
    barcodeInputRef.current?.focus();
  }, []);

  const focusBarcode = () => {
    setTimeout(() => {
      barcodeInputRef.current?.focus();
      barcodeInputRef.current?.select();
    }, 50);
  };

  const handleBarcodeSubmit = async (codeToSearch?: string) => {
    const raw = codeToSearch || barcodeInput;
    const barcode = raw.trim();
    if (!barcode) return;

    setScanning(true);
    try {
      // 1. Resolve product by barcode
      const resolved = await inventoryService.resolveByBarcode(barcode);
      let found: ErpProduct | null = resolved?.product || null;

      if (!found) {
        // Fallback: search by exact barcode or SKU
        const matches = await inventoryService.listProducts({ search: barcode });
        found = matches.find((m) => m.barcode === barcode || m.sku === barcode) || null;
      }

      if (found) {
        setCurrentProduct(found);
        setIsNewProduct(false);
        setAdjustQty(stockMode === "add" ? 1 : found.stock);
        if (soundEnabled) playScanTone("success");
        setTimeout(() => {
          qtyInputRef.current?.focus();
          qtyInputRef.current?.select();
        }, 80);
      } else {
        // Not found: trigger quick registration mode
        setCurrentProduct(null);
        setIsNewProduct(true);
        setNewBarcode(barcode);
        setNewName("");
        setNewPrice("");
        setNewMrp("");
        setNewStock(10);
        setNewUnit("pcs");
        setNewBrand("");
        if (soundEnabled) playScanTone("warning");
        toast.info(`Barcode "${barcode}" not in database. Enter details to register.`);
        setTimeout(() => {
          newNameInputRef.current?.focus();
        }, 80);
      }
    } catch (err) {
      if (soundEnabled) playScanTone("error");
      toast.error("Lookup failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setScanning(false);
    }
  };

  const handleCommitStockUpdate = async () => {
    if (!currentProduct) return;
    const qty = Number(adjustQty);
    if (isNaN(qty) || qty < 0) {
      toast.error("Please enter a valid stock quantity");
      return;
    }

    setUpdatingStock(true);
    try {
      let delta = 0;
      let finalStock = 0;

      if (stockMode === "add") {
        delta = qty;
        finalStock = (currentProduct.stock || 0) + delta;
      } else {
        // "set" mode: delta is difference
        finalStock = qty;
        delta = finalStock - (currentProduct.stock || 0);
      }

      if (delta !== 0) {
        await inventoryService.adjustStock(
          currentProduct.id,
          delta,
          `Quick Barcode Scanner Inward (${stockMode === "add" ? "Added +" + qty : "Set to " + qty})`
        );
      }

      // Record in session audit log
      const logEntry: ScanAuditEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        productId: currentProduct.id,
        productName: currentProduct.name,
        barcode: currentProduct.barcode || barcodeInput,
        previousStock: currentProduct.stock || 0,
        newStock: finalStock,
        delta,
        mode: stockMode,
      };

      setAuditLog((prev) => [logEntry, ...prev.slice(0, 24)]);
      if (soundEnabled) playScanTone("success");

      toast.success(
        `Updated ${currentProduct.name}: ${currentProduct.stock} ➔ ${finalStock} ${currentProduct.unit || "pcs"}`
      );

      // Reset for next scan immediately
      setCurrentProduct(null);
      setBarcodeInput("");
      focusBarcode();
    } catch (err) {
      if (soundEnabled) playScanTone("error");
      toast.error("Failed to update stock: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUpdatingStock(false);
    }
  };

  const handleCreateNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Product name is required");
      return;
    }
    const price = Number(newPrice);
    if (isNaN(price) || price <= 0) {
      toast.error("Selling price must be greater than 0");
      return;
    }

    const stock = Number(newStock) || 0;
    setCreatingProduct(true);
    try {
      // Find or create category
      let categoryId: string | null = null;
      if (newCategory.trim()) {
        const existingCat = categories.find(
          (c) => c.name.toLowerCase() === newCategory.trim().toLowerCase()
        );
        if (existingCat) {
          categoryId = existingCat.id;
        } else {
          try {
            const createdCat = await categoryService.create({
              name: newCategory.trim(),
              slug: slugify(newCategory.trim()),
              image: null,
            });
            setCategories((prev) => [...prev, createdCat]);
            categoryId = createdCat.id;
          } catch {
            // ignore
          }
        }
      }

      const created = await productService.create({
        name: newName.trim(),
        slug: slugify(newName.trim()),
        description: "",
        price,
        selling_price: price,
        mrp: newMrp ? Number(newMrp) : price,
        stock,
        barcode: newBarcode.trim(),
        category_id: categoryId,
        brand: newBrand.trim() || null,
        unit: newUnit.trim() || "pcs",
        featured: false,
        image_url: null,
      });

      // Audit log entry
      const logEntry: ScanAuditEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        productId: created.id,
        productName: created.name,
        barcode: newBarcode.trim(),
        previousStock: 0,
        newStock: stock,
        delta: stock,
        mode: "set",
      };

      setAuditLog((prev) => [logEntry, ...prev.slice(0, 24)]);
      if (soundEnabled) playScanTone("success");
      toast.success(`Created "${created.name}" with ${stock} ${created.unit || "pcs"} stock!`);

      // Reset state for next scan
      setIsNewProduct(false);
      setBarcodeInput("");
      focusBarcode();
    } catch (err) {
      if (soundEnabled) playScanTone("error");
      toast.error("Failed to create product: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setCreatingProduct(false);
    }
  };

  const handleUndoAudit = async (entry: ScanAuditEntry) => {
    try {
      // Revert the delta
      await inventoryService.adjustStock(
        entry.productId,
        -entry.delta,
        `Reverted Quick Scan entry (${entry.productName})`
      );
      toast.success(`Reverted stock for ${entry.productName} back to ${entry.previousStock}`);
      setAuditLog((prev) => prev.filter((item) => item.id !== entry.id));
    } catch (err) {
      toast.error("Failed to undo: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/inventory"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="admin-page-title flex items-center gap-2">
              <ScanBarcode className="h-6 w-6 text-emerald-600" />
              Quick Stock Inward & Shelf Counter
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Rapidly scan barcodes to add stock or count physical shelf inventory
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio Beep Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
              soundEnabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-gray-200 bg-white text-gray-500"
            )}
            title="Scan sound feedback"
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-emerald-600" /> : <VolumeX className="h-3.5 w-3.5" />}
            {soundEnabled ? "Sound ON" : "Sound Muted"}
          </button>

          {/* Camera Scanner Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCamera(!showCamera)}
            className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <Camera className="h-3.5 w-3.5 mr-1 text-indigo-600" />
            {showCamera ? "Close Camera" : "Scan via Camera"}
          </Button>

          <Link href="/admin/products/import">
            <Button variant="outline" size="sm" className="text-xs">
              Bulk CSV Import
            </Button>
          </Link>
        </div>
      </div>

      {/* Camera Live Scanner (Collapsible) */}
      {showCamera && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-indigo-700" />
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                Live Camera Barcode Scanner
              </span>
            </div>
            <button
              onClick={() => setShowCamera(false)}
              className="text-gray-500 hover:text-gray-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-w-md mx-auto">
            <BarcodeScanner
              defaultMode="camera"
              continuous={true}
              onScan={(scanned) => {
                setBarcodeInput(scanned);
                handleBarcodeSubmit(scanned);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Barcode & Mode Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {/* Mode Selector Tabs */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              Select Scanner Workflow Mode:
            </span>
            <div className="flex rounded-xl bg-gray-100 p-1 border border-gray-200">
              <button
                type="button"
                onClick={() => setStockMode("add")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition",
                  stockMode === "add"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                <Plus className="h-4 w-4 text-emerald-600" />
                Add Stock (+Qty)
                <span className="text-[10px] font-normal text-gray-500 hidden sm:inline">
                  — For supplier deliveries
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStockMode("set")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition",
                  stockMode === "set"
                    ? "bg-white text-blue-800 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                <Hash className="h-4 w-4 text-blue-600" />
                Set Shelf Count (=Qty)
                <span className="text-[10px] font-normal text-gray-500 hidden sm:inline">
                  — For physical audit
                </span>
              </button>
            </div>
          </div>

          <div className="text-right text-xs text-gray-500 hidden sm:block">
            <p>⌨️ USB/Bluetooth gun acts as keyboard</p>
            <p className="text-emerald-700 font-medium">Automatic Enter key on scan</p>
          </div>
        </div>

        {/* Primary Barcode Scan Input Field */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
            Scan Barcode or Type Code & Press Enter:
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <ScanBarcode className="h-6 w-6 text-emerald-600" />
            </div>
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleBarcodeSubmit();
                }
              }}
              placeholder="Aim scanner gun here or type barcode (e.g. 8901030383709)..."
              disabled={scanning}
              className="w-full pl-12 pr-28 py-3.5 text-base sm:text-lg font-mono rounded-xl border-2 border-emerald-500 focus:ring-4 focus:ring-emerald-100 focus:outline-none bg-emerald-50/20 text-gray-900 shadow-inner"
            />
            <div className="absolute inset-y-0 right-1.5 flex items-center">
              <Button
                type="button"
                onClick={() => handleBarcodeSubmit()}
                loading={scanning}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-9 px-4 rounded-lg shadow-sm"
              >
                Search ↵
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* STATE A: PRODUCT FOUND -> QUICK STOCK ADJUSTMENT */}
      {currentProduct && (
        <div className="rounded-2xl border-2 border-emerald-500 bg-white p-6 shadow-md animate-in slide-in-from-top-3 duration-200">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <span className="inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 mb-1">
                  Product Found
                </span>
                <h2 className="text-lg font-bold text-gray-900 leading-snug">
                  {currentProduct.name}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mt-1">
                  <span className="font-mono text-gray-500">Barcode: {currentProduct.barcode || "—"}</span>
                  {currentProduct.brand && <span>Brand: {currentProduct.brand}</span>}
                  <span>Price: <strong className="text-emerald-800">{formatPrice(currentProduct.selling_price ?? currentProduct.price)}</strong></span>
                  {currentProduct.mrp && <span className="line-through text-gray-400">MRP {formatPrice(currentProduct.mrp)}</span>}
                </div>
              </div>
            </div>

            {/* Current Stock Banner */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-right">
              <span className="text-[11px] text-gray-500 block">Current Stock</span>
              <span className="text-2xl font-black text-gray-900">
                {currentProduct.stock} <span className="text-sm font-medium text-gray-500">{currentProduct.unit || "pcs"}</span>
              </span>
            </div>
          </div>

          {/* Quick Adjustment Controls */}
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-800">
                {stockMode === "add" ? "Quantity to Add (+):" : "Physical Count on Shelf (=):"}
              </label>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500 mr-1">Presets:</span>
                {[1, 6, 12, 24, 48].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      if (stockMode === "add") setAdjustQty(num);
                      else setAdjustQty((currentProduct.stock || 0) + num);
                      qtyInputRef.current?.focus();
                    }}
                    className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 transition"
                  >
                    +{num}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  ref={qtyInputRef}
                  type="number"
                  step="1"
                  min="0"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCommitStockUpdate();
                    }
                  }}
                  className="w-full py-3 px-4 text-2xl font-black text-gray-900 rounded-xl border-2 border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">
                  {currentProduct.unit || "pcs"}
                </span>
              </div>

              <Button
                type="button"
                onClick={handleCommitStockUpdate}
                loading={updatingStock}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm h-14 px-8 rounded-xl shadow-md transition"
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Save & Scan Next (Enter ↵)
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCurrentProduct(null);
                  setBarcodeInput("");
                  focusBarcode();
                }}
                className="h-14 px-4 text-xs"
              >
                Cancel
              </Button>
            </div>

            {/* Calculated Preview */}
            <p className="text-xs text-gray-600">
              New Total will be:{" "}
              <strong className="text-emerald-800 text-sm">
                {stockMode === "add"
                  ? (currentProduct.stock || 0) + Number(adjustQty || 0)
                  : Number(adjustQty || 0)}{" "}
                {currentProduct.unit || "pcs"}
              </strong>
            </p>
          </div>
        </div>
      )}

      {/* STATE B: NEW PRODUCT UNKNOWN -> RAPID INLINE REGISTRATION */}
      {isNewProduct && (
        <form
          onSubmit={handleCreateNewProduct}
          className="rounded-2xl border-2 border-amber-400 bg-amber-50/20 p-6 shadow-md animate-in slide-in-from-top-3 duration-200"
        >
          <div className="flex items-start justify-between border-b border-amber-200 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Quick Register New Product
                </h3>
                <p className="text-xs text-gray-600">
                  Barcode <strong className="font-mono text-gray-900">{newBarcode}</strong> is not yet in your shop catalog.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsNewProduct(false);
                setBarcodeInput("");
                focusBarcode();
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="font-bold text-gray-800 block mb-1">Product Name *</label>
              <Input
                ref={newNameInputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Parle-G 80g, Balaji Wafers..."
                required
              />
            </div>

            <div>
              <label className="font-bold text-gray-800 block mb-1">Selling Price (₹) *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value ? Number(e.target.value) : "")}
                placeholder="₹10.00"
                required
              />
            </div>

            <div>
              <label className="font-bold text-gray-800 block mb-1">Initial Stock Count *</label>
              <Input
                type="number"
                step="1"
                min="0"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value ? Number(e.target.value) : "")}
                placeholder="e.g. 24"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Category</label>
              <input
                list="category-suggestions"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Biscuits, Dairy..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <datalist id="category-suggestions">
                {categories.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Printed MRP (₹)</label>
              <Input
                type="number"
                step="0.01"
                value={newMrp}
                onChange={(e) => setNewMrp(e.target.value ? Number(e.target.value) : "")}
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Unit</label>
              <select
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="pcs">Pieces (pcs)</option>
                <option value="kg">Kilogram (kg)</option>
                <option value="L">Litre (L)</option>
                <option value="pkt">Packet (pkt)</option>
                <option value="box">Box (box)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Brand</label>
              <Input
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                placeholder="Parle, Amul, ITC..."
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsNewProduct(false);
                setBarcodeInput("");
                focusBarcode();
              }}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={creatingProduct}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-6 shadow-sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Product & Stock (Enter ↵)
            </Button>
          </div>
        </form>
      )}

      {/* SESSION AUDIT LOG / RECENT SCANS */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-gray-600" />
            <h3 className="text-sm font-bold text-gray-900">
              Recent Scans in this Session ({auditLog.length})
            </h3>
          </div>
          {auditLog.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAuditLog([])}
              className="text-xs text-gray-500 hover:text-gray-900"
            >
              Clear Log
            </Button>
          )}
        </div>

        {auditLog.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            No items scanned yet in this session. Scan a barcode above to begin!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                <tr>
                  <th className="p-2.5">Time</th>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5">Barcode</th>
                  <th className="p-2.5">Stock Change</th>
                  <th className="p-2.5">New Stock</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditLog.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50/80 transition">
                    <td className="p-2.5 font-mono text-gray-500">{entry.time}</td>
                    <td className="p-2.5 font-medium text-gray-900">{entry.productName}</td>
                    <td className="p-2.5 font-mono text-gray-600">{entry.barcode}</td>
                    <td className="p-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 font-semibold text-[11px]",
                          entry.delta > 0
                            ? "bg-emerald-100 text-emerald-800"
                            : entry.delta < 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-700"
                        )}
                      >
                        {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                      </span>
                    </td>
                    <td className="p-2.5 font-bold text-gray-900">
                      {entry.newStock} pcs
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleUndoAudit(entry)}
                        className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-600 transition"
                        title="Revert this stock change"
                      >
                        <RotateCcw className="h-3 w-3" /> Undo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

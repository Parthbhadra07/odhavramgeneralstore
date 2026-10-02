"use client";

import { useEffect, useRef, useState } from "react";
import {
  Eye,
  Pencil,
  Plus,
  Printer,
  Trash2,
  ScanBarcode,
  Camera,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  Receipt,
  RotateCcw,
  Sparkles,
  Tag,
  Check,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { purchaseService, supplierService, inventoryService } from "@/services/erp";
import type { PurchaseBill, Supplier, ErpProduct } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/admin/form-field";
import { ResponsiveTable } from "@/components/admin/responsive-table";
import { ActionButton } from "@/components/admin/action-button";
import { AdminFab } from "@/components/admin/admin-fab";
import { Modal } from "@/components/admin/modal";
import { BarcodeScanner } from "@/components/erp/barcode-scanner";
import { formatPrice, formatDate } from "@/utils/format";
import { printReceipt } from "@/components/erp/receipt-print";
import { lineItemGst } from "@/utils/gst";
import { APP_NAME, STORE_ADDRESS } from "@/lib/constants";

interface StagedPurchaseItem {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  lotNumber: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  purchaseRate: number; // base taxable rate before GST
  totalBillAmount: number; // user entered line amount
  sellingPrice: number;
  mrp: number;
  gstPercentage: number;
  gstAmount: number;
  totalWithGst: number;
  landedUnitCost: number;
}

const emptyForm = {
  billNumber: "",
  invoiceDate: new Date().toISOString().slice(0, 10),
  supplierId: "",
  productId: "",
  barcode: "",
  lotNumber: "",
  batchNumber: "",
  expiryDate: "",
  quantity: 1,
  purchaseRate: 0, // base rate before GST
  totalBillAmount: 0, // line total amount (entered by user or computed)
  sellingPrice: 0,
  mrp: 0,
  gstPercentage: 5,
  taxMode: "inclusive" as "inclusive" | "exclusive",
  lastEditedField: "total" as "rate" | "total",
};

type FormState = typeof emptyForm;
type FormErrors = Partial<Record<keyof FormState, string>>;

function playScanSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {}
}

export default function PurchasesPage() {
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ErpProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // Staged items for multi-item wholesale invoice entry
  const [stagedItems, setStagedItems] = useState<StagedPurchaseItem[]>([]);

  // Camera Barcode Scanner
  const [showCameraScan, setShowCameraScan] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"create" | "edit">("create");

  // Modals
  const [viewBill, setViewBill] = useState<PurchaseBill | null>(null);
  const [editBill, setEditBill] = useState<PurchaseBill | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [editItemId, setEditItemId] = useState("");

  const formRef = useRef<HTMLDivElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      purchaseService.list().then(setBills),
      supplierService.list().then(setSuppliers),
      inventoryService.listProducts().then(setProducts),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openAddForm = () => {
    setShowForm(true);
    setErrors({});
    setStagedItems([]);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // Helper to recompute rate and total bill amount bidirectionally
  const recalculatePricing = (
    current: FormState,
    changes: Partial<FormState>
  ): FormState => {
    const updated = { ...current, ...changes };
    const qty = Math.max(1, updated.quantity || 1);
    const gst = updated.gstPercentage || 0;
    const isInclusive = updated.taxMode === "inclusive";

    if (changes.totalBillAmount !== undefined || (changes.quantity !== undefined && updated.lastEditedField === "total")) {
      // User entered/changed Total Bill Amount -> Calculate Single Item Rate:
      const totalAmt = updated.totalBillAmount || 0;
      let calculatedBaseRate = 0;

      if (isInclusive) {
        // e.g. Bill is ₹1200 for 48 units at 5% GST:
        // Taxable total = 1200 / 1.05 = 1142.857
        // Base rate per unit = 1142.857 / 48 = 23.81
        const taxableTotal = gst > 0 ? totalAmt / (1 + gst / 100) : totalAmt;
        calculatedBaseRate = Math.round((taxableTotal / qty) * 100) / 100;
      } else {
        // Exclusive: Bill of ₹1200 is before tax
        calculatedBaseRate = Math.round((totalAmt / qty) * 100) / 100;
      }

      return {
        ...updated,
        purchaseRate: calculatedBaseRate,
        lastEditedField: changes.totalBillAmount !== undefined ? "total" : updated.lastEditedField,
      };
    } else if (changes.purchaseRate !== undefined || (changes.quantity !== undefined && updated.lastEditedField === "rate")) {
      // User entered/changed Single Item Purchase Rate -> Calculate Total Bill Amount:
      const baseRate = updated.purchaseRate || 0;
      let calculatedTotal = 0;

      if (isInclusive) {
        // Total inclusive = Rate * qty * (1 + gst/100)
        calculatedTotal = Math.round(baseRate * qty * (1 + gst / 100) * 100) / 100;
      } else {
        calculatedTotal = Math.round(baseRate * qty * 100) / 100;
      }

      return {
        ...updated,
        totalBillAmount: calculatedTotal,
        lastEditedField: changes.purchaseRate !== undefined ? "rate" : updated.lastEditedField,
      };
    } else if (changes.taxMode !== undefined || changes.gstPercentage !== undefined) {
      // User changed Tax Mode or GST %:
      if (updated.lastEditedField === "total" && updated.totalBillAmount > 0) {
        let calculatedBaseRate = 0;
        if (isInclusive) {
          const taxableTotal = gst > 0 ? updated.totalBillAmount / (1 + gst / 100) : updated.totalBillAmount;
          calculatedBaseRate = Math.round((taxableTotal / qty) * 100) / 100;
        } else {
          calculatedBaseRate = Math.round((updated.totalBillAmount / qty) * 100) / 100;
        }
        return { ...updated, purchaseRate: calculatedBaseRate };
      } else if (updated.purchaseRate > 0) {
        let calculatedTotal = 0;
        if (isInclusive) {
          calculatedTotal = Math.round(updated.purchaseRate * qty * (1 + gst / 100) * 100) / 100;
        } else {
          calculatedTotal = Math.round(updated.purchaseRate * qty * 100) / 100;
        }
        return { ...updated, totalBillAmount: calculatedTotal };
      }
    }

    return updated;
  };

  const handleProductSelect = (productId: string, target: "create" | "edit") => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;

    const existingRate = Number(p.purchase_price ?? 0);
    const existingSelling = Number(p.selling_price ?? p.price ?? 0);
    const existingMrp = Number(p.mrp ?? p.price ?? 0);
    const existingGst = Number(p.gst_percentage ?? 5);

    const patch: Partial<FormState> = {
      productId,
      barcode: p.barcode ?? "",
      purchaseRate: existingRate,
      sellingPrice: existingSelling,
      mrp: existingMrp,
      gstPercentage: existingGst,
      lastEditedField: "rate",
    };

    if (target === "create") {
      setForm((f) => recalculatePricing(f, patch));
    } else {
      setEditForm((f) => recalculatePricing(f, patch));
    }

    // Auto-focus quantity field for quick entry
    setTimeout(() => {
      const el = document.getElementById(
        target === "create" ? "purchase-qty-input" : "edit-purchase-qty-input"
      );
      el?.focus();
    }, 50);
  };

  const handleBarcodeChange = (code: string, target: "create" | "edit") => {
    const clean = code.trim();
    if (target === "create") {
      setForm((f) => ({ ...f, barcode: code }));
    } else {
      setEditForm((f) => ({ ...f, barcode: code }));
    }

    // Auto-match product from catalog if barcode matches
    if (clean.length >= 3) {
      const matched = products.find((p) => p.barcode === clean);
      if (matched) {
        playScanSound();
        handleProductSelect(matched.id, target);
        toast.success(`Matched: ${matched.name}`);
      }
    }
  };

  const handleBarcodeKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    target: "create" | "edit"
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();

      const code = (target === "create" ? form.barcode : editForm.barcode).trim();
      if (code) {
        const matched = products.find((p) => p.barcode === code);
        if (matched) {
          playScanSound();
          handleProductSelect(matched.id, target);
          toast.success(`Matched: ${matched.name}`);
        } else {
          toast.info(`Barcode "${code}" not found in catalog. Select product to link it.`);
        }
      }

      const qtyInput = document.getElementById(
        target === "create" ? "purchase-qty-input" : "edit-purchase-qty-input"
      );
      qtyInput?.focus();
    }
  };

  const handleScannedFromCamera = (scannedCode: string) => {
    playScanSound();
    handleBarcodeChange(scannedCode, scannerTarget);
    setShowCameraScan(false);

    const matched = products.find((p) => p.barcode === scannedCode.trim());
    if (matched) {
      toast.success(`Scanned: ${matched.name} (${scannedCode})`);
      setTimeout(() => {
        const qtyInput = document.getElementById(
          scannerTarget === "create" ? "purchase-qty-input" : "edit-purchase-qty-input"
        );
        qtyInput?.focus();
      }, 100);
    } else {
      toast.info(`Scanned Barcode: ${scannedCode}. Please select product.`);
    }
  };

  // Live item computation (for pricing breakdown badge)
  const computeItemBadge = (f: FormState) => {
    const qty = Math.max(1, f.quantity || 1);
    const rate = f.purchaseRate || 0;
    const gstPercent = f.gstPercentage || 0;
    const gst = lineItemGst(rate, qty, gstPercent);
    const totalLineCost = gst.totalWithGst;
    const landedUnitCost = Math.round((totalLineCost / qty) * 100) / 100;
    const sellingPrice = f.sellingPrice || 0;
    const mrp = f.mrp || 0;
    const unitProfit = sellingPrice > 0 ? Math.round((sellingPrice - landedUnitCost) * 100) / 100 : 0;
    const marginPercent = sellingPrice > 0 ? Math.round((unitProfit / sellingPrice) * 1000) / 10 : 0;
    const totalBatchProfit = Math.round(unitProfit * qty * 100) / 100;

    return {
      qty,
      taxableSubtotal: gst.taxableAmount,
      totalGst: gst.totalGst,
      totalLineCost,
      landedUnitCost,
      unitProfit,
      marginPercent,
      totalBatchProfit,
      isLoss: sellingPrice > 0 && sellingPrice < landedUnitCost,
    };
  };

  const currentSummary = computeItemBadge(form);

  // Validate single item
  const validateItem = (f: FormState): FormErrors => {
    const errs: FormErrors = {};
    if (!f.supplierId) errs.supplierId = "Select a supplier";
    if (!f.productId) errs.productId = "Select a product";
    if (!f.invoiceDate) errs.invoiceDate = "Purchase date is required";
    if (f.quantity < 1) errs.quantity = "Quantity must be at least 1";
    if (f.purchaseRate < 0) errs.purchaseRate = "Purchase rate cannot be negative";
    if (f.gstPercentage < 0 || f.gstPercentage > 100) {
      errs.gstPercentage = "GST must be between 0 and 100";
    }
    return errs;
  };

  // Add current item to staged multi-item invoice list
  const handleAddItemToBill = () => {
    const validation = validateItem(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      toast.error("Please fill required product, supplier, and quantity details");
      return;
    }

    const prod = products.find((p) => p.id === form.productId);
    const summary = computeItemBadge(form);

    const newItem: StagedPurchaseItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productId: form.productId,
      productName: prod?.name || "Product",
      barcode: form.barcode.trim(),
      lotNumber: form.lotNumber.trim(),
      batchNumber: form.batchNumber.trim(),
      expiryDate: form.expiryDate,
      quantity: form.quantity,
      purchaseRate: form.purchaseRate,
      totalBillAmount: form.totalBillAmount || summary.totalLineCost,
      sellingPrice: form.sellingPrice,
      mrp: form.mrp,
      gstPercentage: form.gstPercentage,
      gstAmount: summary.totalGst,
      totalWithGst: summary.totalLineCost,
      landedUnitCost: summary.landedUnitCost,
    };

    setStagedItems((prev) => [...prev, newItem]);
    toast.success(`Added ${newItem.productName} (${newItem.quantity} units) to Invoice`);

    // Reset item fields for next product, keeping Supplier, Date, Bill Number
    setForm((f) => ({
      ...f,
      productId: "",
      barcode: "",
      quantity: 1,
      purchaseRate: 0,
      totalBillAmount: 0,
      sellingPrice: 0,
      mrp: 0,
      lotNumber: "",
      batchNumber: "",
      expiryDate: "",
    }));
    setErrors({});

    // Refocus barcode input
    setTimeout(() => {
      document.getElementById("purchase-barcode-input")?.focus();
    }, 50);
  };

  const removeStagedItem = (id: string) => {
    setStagedItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Save Complete Purchase Bill (either staged items or single item)
  const handleSavePurchaseBill = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    let itemsToSave: {
      productId: string;
      barcode?: string;
      lotNumber?: string;
      batchNumber?: string;
      expiryDate?: string;
      quantity: number;
      purchaseRate: number;
      sellingPrice?: number;
      mrp?: number;
      gstPercentage: number;
    }[] = [];

    let billNumber = form.billNumber.trim() || `PUR-${Date.now().toString().slice(-6)}`;
    let supplierId = form.supplierId;
    let invoiceDate = form.invoiceDate;

    if (stagedItems.length > 0) {
      itemsToSave = stagedItems.map((item) => ({
        productId: item.productId,
        barcode: item.barcode || undefined,
        lotNumber: item.lotNumber || undefined,
        batchNumber: item.batchNumber || undefined,
        expiryDate: item.expiryDate || undefined,
        quantity: item.quantity,
        purchaseRate: item.purchaseRate,
        sellingPrice: item.sellingPrice || undefined,
        mrp: item.mrp || undefined,
        gstPercentage: item.gstPercentage,
      }));
    } else {
      // Single item direct save
      const validation = validateItem(form);
      setErrors(validation);
      if (Object.keys(validation).length > 0) {
        toast.error("Please fill required product, supplier, and quantity details");
        return;
      }

      itemsToSave = [
        {
          productId: form.productId,
          barcode: form.barcode.trim() || undefined,
          lotNumber: form.lotNumber.trim() || undefined,
          batchNumber: form.batchNumber.trim() || undefined,
          expiryDate: form.expiryDate || undefined,
          quantity: form.quantity,
          purchaseRate: form.purchaseRate,
          sellingPrice: form.sellingPrice || undefined,
          mrp: form.mrp || undefined,
          gstPercentage: form.gstPercentage,
        },
      ];
    }

    setSaving(true);
    try {
      await purchaseService.create({
        billNumber,
        invoiceDate,
        supplierId,
        items: itemsToSave,
      });

      toast.success(
        `Purchase Invoice ${billNumber} saved successfully (${itemsToSave.length} items) — Stock inwarded!`
      );
      setShowForm(false);
      setForm(emptyForm);
      setStagedItems([]);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save purchase");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (bill: PurchaseBill) => {
    const item = bill.purchase_items?.[0];
    if (!item) {
      toast.error("No purchase items to edit");
      return;
    }
    setEditBill(bill);
    setEditItemId(item.id);

    const rate = Number(item.purchase_rate);
    const qty = item.quantity;
    const gstPercent = Number(item.gst_percentage);
    const gst = lineItemGst(rate, qty, gstPercent);

    setEditForm({
      billNumber: bill.bill_number,
      invoiceDate: bill.invoice_date,
      supplierId: bill.supplier_id,
      productId: item.product_id,
      barcode: item.barcode ?? "",
      lotNumber: item.lot_number ?? "",
      batchNumber: item.batch_number ?? "",
      expiryDate: item.expiry_date ?? "",
      quantity: item.quantity,
      purchaseRate: rate,
      totalBillAmount: gst.totalWithGst,
      sellingPrice: Number(item.selling_price ?? 0),
      mrp: Number(item.mrp ?? 0),
      gstPercentage: gstPercent,
      taxMode: "inclusive",
      lastEditedField: "total",
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBill) return;
    const validation = validateItem(editForm);
    if (Object.keys(validation).length > 0) {
      toast.error("Please fix form errors");
      return;
    }
    setSaving(true);
    try {
      await purchaseService.updateBill({
        billId: editBill.id,
        itemId: editItemId,
        supplierId: editForm.supplierId,
        invoiceDate: editForm.invoiceDate,
        billNumber: editForm.billNumber,
        productId: editForm.productId,
        barcode: editForm.barcode.trim() || undefined,
        lotNumber: editForm.lotNumber.trim() || undefined,
        batchNumber: editForm.batchNumber.trim() || undefined,
        expiryDate: editForm.expiryDate || undefined,
        quantity: editForm.quantity,
        purchaseRate: editForm.purchaseRate,
        sellingPrice: editForm.sellingPrice || undefined,
        mrp: editForm.mrp || undefined,
        gstPercentage: editForm.gstPercentage,
      });
      toast.success("Purchase updated — stock and rate adjusted");
      setEditBill(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this purchase? Stock and supplier balance will be reversed.")) return;
    try {
      await purchaseService.delete(id);
      toast.success("Purchase deleted");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  // Thermal 80mm Print
  const printPurchase = (bill: PurchaseBill) => {
    const items = bill.purchase_items ?? [];
    const receiptHtml = document.createElement("div");
    receiptHtml.id = "purchase-print";
    receiptHtml.className = "thermal-receipt thermal-receipt-border mx-auto bg-white p-4 font-mono text-xs";
    receiptHtml.style.width = "80mm";

    const itemsRows = items
      .map(
        (it) => `
      <div style="margin-bottom:6px">
        <div style="font-weight:bold">${it.products?.name ?? "Item"}</div>
        <div style="display:flex;justify-content:space-between;color:#444">
          <span>${it.quantity} x ₹${Number(it.purchase_rate).toFixed(2)} (${it.gst_percentage}% GST)</span>
          <span>₹${Number(it.total_amount).toFixed(2)}</span>
        </div>
        ${it.barcode ? `<div style="font-size:10px;color:#777">Barcode: ${it.barcode}</div>` : ""}
      </div>
    `
      )
      .join("");

    receiptHtml.innerHTML = `
      <div style="text-align:center;font-weight:bold;font-size:14px">${APP_NAME}</div>
      <div style="text-align:center;font-size:11px;color:#555">PURCHASE INWARD VOUCHER / GRN</div>
      <div style="text-align:center;font-size:10px;color:#777">${STORE_ADDRESS}</div>
      <hr style="border-top:2px solid #000;margin:8px 0"/>
      <div style="display:flex;justify-content:space-between">
        <span><strong>Bill #:</strong> ${bill.bill_number}</span>
        <span><strong>Date:</strong> ${formatDate(bill.invoice_date)}</span>
      </div>
      <div><strong>Supplier:</strong> ${bill.suppliers?.name ?? "Wholesale Supplier"}</div>
      ${bill.suppliers?.gst_number ? `<div><strong>GSTIN:</strong> ${bill.suppliers.gst_number}</div>` : ""}
      <hr style="border-top:1px dashed #000;margin:8px 0"/>
      <div style="margin-bottom:6px"><strong>INWARD PRODUCTS (${items.length}):</strong></div>
      ${itemsRows}
      <hr style="border-top:1px dashed #000;margin:8px 0"/>
      <div style="display:flex;justify-content:space-between">
        <span>Taxable Subtotal</span>
        <span>₹${Number(bill.subtotal).toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span>CGST + SGST</span>
        <span>₹${(Number(bill.cgst) + Number(bill.sgst)).toFixed(2)}</span>
      </div>
      <hr style="border-top:2px solid #000;margin:8px 0"/>
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:bold">
        <span>TOTAL INVOICE AMOUNT</span>
        <span>${formatPrice(bill.total_amount)}</span>
      </div>
      <div style="margin-top:14px;display:flex;justify-content:space-between;font-size:10px">
        <span>Goods Received By: ________</span>
        <span>Storekeeper Sign: ________</span>
      </div>
    `;

    document.body.appendChild(receiptHtml);
    printReceipt("purchase-print", "80mm");
    document.body.removeChild(receiptHtml);
  };

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }));
  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.name} ${p.stock !== undefined ? `(Stock: ${p.stock})` : ""} · MRP ₹${p.mrp ?? p.price ?? 0}`,
  }));

  const selectedProductObj = products.find((p) => p.id === form.productId);
  const matchedBarcodeProduct = form.barcode.trim()
    ? products.find((p) => p.barcode === form.barcode.trim())
    : null;

  // Staged multi-item totals
  const stagedSubtotal = stagedItems.reduce((acc, i) => acc + i.purchaseRate * i.quantity, 0);
  const stagedGst = stagedItems.reduce((acc, i) => acc + i.gstAmount, 0);
  const stagedTotal = stagedItems.reduce((acc, i) => acc + i.totalWithGst, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight sm:text-3xl">
              Purchase Management
            </h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              Inward Stock &amp; GST
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Record wholesale distributor bills, calculate single item cost automatically, track barcodes &amp; lots
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={openAddForm} className="gap-1.5 font-bold shadow-xs">
            <Plus className="h-4 w-4" />
            <span>New Purchase Bill</span>
          </Button>
        </div>
      </div>

      <AdminFab label="Add Purchase" icon={Plus} onClick={openAddForm} />

      {/* Camera Barcode Scanner Modal */}
      {showCameraScan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div className="flex items-center gap-2">
                <ScanBarcode className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">Scan Product / Carton Barcode</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCameraScan(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <BarcodeScanner
              defaultMode="camera"
              onScan={handleScannedFromCamera}
              onClose={() => setShowCameraScan(false)}
            />
          </div>
        </div>
      )}

      {/* NEW PURCHASE BILL CREATOR */}
      {showForm && (
        <div
          ref={formRef}
          className="rounded-2xl border border-emerald-300 bg-white p-4 sm:p-6 shadow-md transition-all animate-in fade-in"
        >
          {/* Header of Invoice Form */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-green-700 text-white shadow-xs">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  New Supplier Purchase Invoice
                </h2>
                <p className="text-xs text-slate-500">
                  Enter supplier bill details. Type quantity &amp; total bill amount, single item rate calculates by itself!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Tax Mode Switcher */}
              <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setForm((f) => recalculatePricing(f, { taxMode: "inclusive" }))}
                  className={`rounded-lg px-2.5 py-1 font-bold transition-all ${
                    form.taxMode === "inclusive"
                      ? "bg-white text-emerald-900 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Bill amount already includes GST tax"
                >
                  Bill Includes GST
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => recalculatePricing(f, { taxMode: "exclusive" }))}
                  className={`rounded-lg px-2.5 py-1 font-bold transition-all ${
                    form.taxMode === "exclusive"
                      ? "bg-white text-emerald-900 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="GST tax is added extra on top of rate"
                >
                  GST Added Extra
                </button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowForm(false)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>

          <form onSubmit={handleSavePurchaseBill} className="space-y-6">
            {/* SECTION 1: INVOICE HEADER DETAILS */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5 block">
                1. Distributor &amp; Invoice Header
              </span>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="Supplier Bill / Invoice #"
                  placeholder="e.g. INV-8942 / PUR-001"
                  value={form.billNumber}
                  onChange={(e) => setForm({ ...form, billNumber: e.target.value })}
                />
                <Input
                  label="Purchase Date"
                  type="date"
                  value={form.invoiceDate}
                  error={errors.invoiceDate}
                  onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                  required
                />
                <SelectField
                  label="Select Supplier"
                  value={form.supplierId}
                  onChange={(v) => setForm({ ...form, supplierId: v })}
                  options={supplierOptions}
                  placeholder="Select wholesale distributor"
                  error={errors.supplierId}
                  required
                />
              </div>
            </div>

            {/* SECTION 2: BARCODE OPTION & PRODUCT SELECTION */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  2. Product Identification &amp; Barcode Scanner
                </span>
                <span className="text-xs text-emerald-700 font-semibold">
                  ⚡ Scan carton barcode to auto-fill details
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-12 items-end">
                {/* Barcode input with camera scan button */}
                <div className="sm:col-span-6">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Product Barcode (Scan / Type)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        id="purchase-barcode-input"
                        placeholder="Scan barcode gun or type & hit Enter..."
                        value={form.barcode}
                        onChange={(e) => handleBarcodeChange(e.target.value, "create")}
                        onKeyDown={(e) => handleBarcodeKeyDown(e, "create")}
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-8 text-sm font-mono focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 shadow-2xs"
                      />
                      {form.barcode && (
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, barcode: "" }))}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setScannerTarget("create");
                        setShowCameraScan(true);
                      }}
                      className="shrink-0 h-10 gap-1.5 border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 font-bold text-xs"
                      title="Open phone camera to scan carton/item barcode"
                    >
                      <Camera className="h-4 w-4 text-emerald-700" />
                      <span>Scan</span>
                    </Button>
                  </div>
                </div>

                {/* Product Catalog Dropdown */}
                <div className="sm:col-span-6">
                  <SelectField
                    label="Or Select Product from Catalog"
                    value={form.productId}
                    onChange={(v) => handleProductSelect(v, "create")}
                    options={productOptions}
                    placeholder="Search or pick product"
                    error={errors.productId}
                    required
                  />
                </div>
              </div>

              {/* Matched product badge */}
              {selectedProductObj && (
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 border border-emerald-200 text-xs text-emerald-900">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      Selected: <strong>{selectedProductObj.name}</strong> · Current Stock:{" "}
                      <strong>{selectedProductObj.stock ?? 0} {selectedProductObj.unit || "pcs"}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <span>Prev Buy: <strong>{formatPrice(selectedProductObj.purchase_price ?? 0)}</strong></span>
                    <span>Selling: <strong>{formatPrice(selectedProductObj.selling_price ?? selectedProductObj.price)}</strong></span>
                    <span>MRP: <strong>{formatPrice(selectedProductObj.mrp ?? selectedProductObj.price)}</strong></span>
                  </div>
                </div>
              )}

              {form.barcode.trim() && !matchedBarcodeProduct && !selectedProductObj && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 border border-amber-200 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    New barcode <strong>{form.barcode}</strong>. Please select the product from dropdown to link this barcode.
                  </span>
                </div>
              )}
            </div>

            {/* SECTION 3: BIDIRECTIONAL QUANTITY + BILL AMOUNT + RATE CALCULATOR */}
            <div className="rounded-xl border border-emerald-300 bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3.5">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-emerald-700" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    3. Auto-Calculate Single Item Rate from Quantity &amp; Total Bill
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Type <strong>Total Bill</strong> OR <strong>Single Item Rate</strong> — the other calculates automatically!
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-start">
                {/* 1. Quantity */}
                <div>
                  <label htmlFor="purchase-qty-input" className="mb-1 block text-sm font-semibold text-slate-800">
                    Quantity Inwarded
                  </label>
                  <div className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => recalculatePricing(f, { quantity: Math.max(1, (f.quantity || 1) - 1) }))
                      }
                      className="px-2.5 py-2 text-slate-500 hover:bg-slate-100 font-bold"
                    >
                      -
                    </button>
                    <input
                      id="purchase-qty-input"
                      type="number"
                      min={1}
                      ref={qtyInputRef}
                      value={form.quantity}
                      onChange={(e) =>
                        setForm((f) => recalculatePricing(f, { quantity: Number(e.target.value) }))
                      }
                      className="w-full bg-transparent text-center font-bold text-slate-900 text-sm focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => recalculatePricing(f, { quantity: (f.quantity || 1) + 1 }))
                      }
                      className="px-2.5 py-2 text-slate-500 hover:bg-slate-100 font-bold"
                    >
                      +
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">Total units/packets in this consignment</p>
                </div>

                {/* 2. Total Item Bill Amount (User enters this from distributor invoice) */}
                <div>
                  <label htmlFor="purchase-total-bill-input" className="mb-1 block text-sm font-semibold text-emerald-950">
                    Total Item Bill Amount (₹)
                  </label>
                  <div className="flex items-center rounded-lg border-2 border-emerald-500 bg-emerald-50/40 px-2 py-1.5 focus-within:border-emerald-700 focus-within:bg-white shadow-2xs">
                    <span className="text-emerald-700 font-bold mr-1">₹</span>
                    <input
                      id="purchase-total-bill-input"
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="e.g. 1200.00"
                      value={form.totalBillAmount || ""}
                      onChange={(e) =>
                        setForm((f) =>
                          recalculatePricing(f, { totalBillAmount: Number(e.target.value) || 0 })
                        )
                      }
                      className="w-full bg-transparent font-extrabold text-emerald-950 text-base focus:outline-none text-right"
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-700 font-semibold">⚡ Auto-divides by Qty</span>
                    <span className="text-slate-500 font-mono">
                      {form.quantity > 0 && form.totalBillAmount > 0
                        ? `₹${(form.totalBillAmount / form.quantity).toFixed(2)}/pc`
                        : ""}
                    </span>
                  </div>
                </div>

                {/* 3. Single Item Purchase Rate (Auto calculated or manually entered) */}
                <div>
                  <label htmlFor="purchase-rate-input" className="mb-1 block text-sm font-semibold text-slate-800">
                    Single Item Rate (₹)
                  </label>
                  <div className="flex items-center rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600">
                    <span className="text-slate-400 mr-1 font-semibold">₹</span>
                    <input
                      id="purchase-rate-input"
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="0.00"
                      value={form.purchaseRate || ""}
                      onChange={(e) =>
                        setForm((f) =>
                          recalculatePricing(f, { purchaseRate: Number(e.target.value) || 0 })
                        )
                      }
                      className="w-full bg-transparent font-bold text-slate-900 text-sm focus:outline-none text-right"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {form.taxMode === "inclusive" ? "Taxable rate before GST" : "Base rate per unit"}
                  </p>
                </div>

                {/* 4. GST Percentage */}
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-800">
                    GST Tax Rate (%)
                  </label>
                  <div className="flex items-center gap-1">
                    {[0, 5, 12, 18, 28].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setForm((f) => recalculatePricing(f, { gstPercentage: g }))}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all border ${
                          form.gstPercentage === g
                            ? "bg-emerald-700 text-white border-emerald-800 shadow-2xs"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {g}%
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 text-right">
                    GST: ₹{currentSummary.totalGst.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* LIVE PRICING BREAKDOWN & PROFIT MARGIN BADGE */}
              <div className="mt-4 rounded-xl bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 p-3 sm:p-4 border border-emerald-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Calculated Landed Cost:
                    </span>
                    <p className="text-base sm:text-lg font-black text-emerald-950">
                      {formatPrice(currentSummary.landedUnitCost)}
                      <span className="text-[10px] text-slate-500 font-normal"> / unit</span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Taxable {formatPrice(form.purchaseRate)} + GST {formatPrice(currentSummary.totalGst / currentSummary.qty)}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Total Line Bill Amount:
                    </span>
                    <p className="text-base sm:text-lg font-black text-slate-900">
                      {formatPrice(currentSummary.totalLineCost)}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      For {currentSummary.qty} units inwarded
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Retail Selling Price:
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-extrabold text-sm text-slate-800">
                        {formatPrice(form.sellingPrice || 0)}
                      </span>
                      {form.mrp > 0 && (
                        <span className="text-[10px] text-slate-500">
                          (MRP {formatPrice(form.mrp)})
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500">Store counter price</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Projected Profit Margin:
                    </span>
                    {currentSummary.isLoss ? (
                      <p className="text-sm font-bold text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        Loss {formatPrice(currentSummary.unitProfit)}
                      </p>
                    ) : (
                      <div>
                        <p className="text-sm sm:text-base font-extrabold text-emerald-700">
                          +{formatPrice(currentSummary.unitProfit)} / unit
                          <span className="text-xs ml-1 font-bold">
                            ({currentSummary.marginPercent}%)
                          </span>
                        </p>
                        <p className="text-[10px] text-emerald-800 font-semibold">
                          Total batch profit: +{formatPrice(currentSummary.totalBatchProfit)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RETAIL SELLING & MRP OVERRIDE INPUTS */}
              <div className="mt-3.5 grid gap-3 sm:grid-cols-4">
                <Input
                  label="Selling Price (₹)"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={form.sellingPrice || ""}
                  onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) || 0 })}
                />
                <Input
                  label="MRP (₹)"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={form.mrp || ""}
                  onChange={(e) => setForm({ ...form, mrp: Number(e.target.value) || 0 })}
                />
                <Input
                  label="Lot Number (Auto)"
                  placeholder="e.g. LOT-A1"
                  value={form.lotNumber}
                  onChange={(e) => setForm({ ...form, lotNumber: e.target.value })}
                />
                <Input
                  label="Batch / Expiry"
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                />
              </div>
            </div>

            {/* ACTION ROW: ADD TO INVOICE OR SAVE DIRECTLY */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddItemToBill}
                  className="gap-1.5 border-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 font-bold"
                >
                  <Plus className="h-4 w-4 text-emerald-700" />
                  <span>+ Add Item to Invoice Table</span>
                </Button>

                {stagedItems.length === 0 && (
                  <Button
                    type="submit"
                    loading={saving}
                    className="gap-1.5 bg-green-700 hover:bg-green-800 font-bold shadow-xs"
                  >
                    <span>Save Single Item Purchase Now ({formatPrice(currentSummary.totalLineCost)})</span>
                  </Button>
                )}
              </div>

              {stagedItems.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs">
                    <span className="text-slate-500 block">Invoice Total ({stagedItems.length} items):</span>
                    <span className="text-lg font-black text-emerald-950 font-mono">
                      {formatPrice(stagedTotal)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleSavePurchaseBill()}
                    loading={saving}
                    className="gap-1.5 bg-green-700 hover:bg-green-800 font-extrabold text-sm shadow-md"
                  >
                    <span>Save Complete Purchase Bill ({stagedItems.length} items)</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* SECTION 4: MULTI-ITEM STAGED INVOICE TABLE */}
            {stagedItems.length > 0 && (
              <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-700" />
                    <h3 className="font-bold text-sm text-slate-900">
                      Staged Items on This Invoice ({stagedItems.length} products)
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    Invoice: {form.billNumber || "PUR-New"}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-xs">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        <th className="p-2">#</th>
                        <th className="p-2">Product Name &amp; Barcode</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Rate (Base)</th>
                        <th className="p-2 text-right">GST %</th>
                        <th className="p-2 text-right">Unit Landed</th>
                        <th className="p-2 text-right">Line Total</th>
                        <th className="p-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stagedItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-2 font-mono font-semibold text-slate-500">{idx + 1}</td>
                          <td className="p-2">
                            <span className="font-bold text-slate-900">{item.productName}</span>
                            {item.barcode && (
                              <span className="block font-mono text-[10px] text-slate-400">
                                {item.barcode}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-right font-bold text-slate-900">{item.quantity}</td>
                          <td className="p-2 text-right font-mono">{formatPrice(item.purchaseRate)}</td>
                          <td className="p-2 text-right text-slate-600">{item.gstPercentage}%</td>
                          <td className="p-2 text-right font-mono font-semibold text-emerald-900">
                            {formatPrice(item.landedUnitCost)}
                          </td>
                          <td className="p-2 text-right font-mono font-extrabold text-slate-950">
                            {formatPrice(item.totalWithGst)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeStagedItem(item.id)}
                              className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Remove item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 font-bold bg-slate-50/80">
                        <td colSpan={2} className="p-2 text-slate-700">
                          Total ({stagedItems.length} items)
                        </td>
                        <td className="p-2 text-right">
                          {stagedItems.reduce((acc, i) => acc + i.quantity, 0)}
                        </td>
                        <td className="p-2 text-right font-mono">{formatPrice(stagedSubtotal)}</td>
                        <td className="p-2 text-right text-slate-600">Tax: {formatPrice(stagedGst)}</td>
                        <td className="p-2" />
                        <td className="p-2 text-right font-mono text-base font-extrabold text-emerald-950">
                          {formatPrice(stagedTotal)}
                        </td>
                        <td className="p-2" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* PURCHASES LIST TABLE */}
      <ResponsiveTable
        loading={loading}
        data={bills}
        keyExtractor={(b) => b.id}
        emptyMessage="No purchases recorded yet."
        columns={[
          {
            key: "bill",
            header: "Bill #",
            mobilePrimary: true,
            cell: (b) => (
              <div>
                <span className="font-mono font-bold text-slate-900">{b.bill_number}</span>
                <span className="block text-[11px] text-slate-400 sm:hidden">
                  {formatDate(b.invoice_date)}
                </span>
              </div>
            ),
          },
          {
            key: "date",
            header: "Date",
            cell: (b) => formatDate(b.invoice_date),
          },
          {
            key: "supplier",
            header: "Supplier",
            cell: (b) => (
              <span className="font-semibold text-slate-800">
                {b.suppliers?.name ?? "Wholesale Supplier"}
              </span>
            ),
          },
          {
            key: "product",
            header: "Products Inwarded",
            hideOnMobile: true,
            cell: (b) => {
              const items = b.purchase_items ?? [];
              if (items.length === 0) return "—";
              const first = items[0]?.products?.name ?? "Item";
              const rest = items.length - 1;
              return (
                <div className="text-xs">
                  <span className="font-medium text-slate-900">{first}</span>
                  {rest > 0 && (
                    <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 font-bold text-[10px] text-slate-600">
                      +{rest} more
                    </span>
                  )}
                  <span className="block text-[11px] text-slate-400">
                    Total: {items.reduce((acc, i) => acc + i.quantity, 0)} units
                  </span>
                </div>
              );
            },
          },
          {
            key: "total",
            header: "Total Inward Amount",
            cell: (b) => (
              <span className="font-mono font-bold text-emerald-800 dark:text-emerald-400 text-sm">
                {formatPrice(b.total_amount)}
              </span>
            ),
          },
          {
            key: "gst",
            header: "Tax (CGST+SGST)",
            hideOnMobile: true,
            cell: (b) =>
              formatPrice(Number(b.cgst) + Number(b.sgst) + Number(b.igst)),
          },
        ]}
        actions={(b) => (
          <>
            <ActionButton icon={Pencil} label="Edit Purchase" onClick={() => openEdit(b)} variant="primary" />
            <ActionButton icon={Eye} label="View Purchase" onClick={() => setViewBill(b)} />
            <ActionButton icon={Printer} label="Print Purchase" onClick={() => printPurchase(b)} />
            <ActionButton icon={Trash2} label="Delete Purchase" onClick={() => handleDelete(b.id)} variant="danger" />
          </>
        )}
      />

      {/* VIEW PURCHASE DETAIL MODAL */}
      <Modal
        open={!!viewBill}
        onClose={() => setViewBill(null)}
        title={`Purchase Inward Voucher — ${viewBill?.bill_number ?? ""}`}
        size="xl"
      >
        {viewBill && (
          <div className="space-y-4 text-xs sm:text-sm">
            {/* Header Voucher Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Bill Number</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{viewBill.bill_number}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Invoice Date</span>
                <span className="font-semibold text-slate-800">{formatDate(viewBill.invoice_date)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Distributor</span>
                <span className="font-bold text-slate-900">{viewBill.suppliers?.name ?? "—"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Amount</span>
                <span className="font-mono font-black text-emerald-800 text-base">{formatPrice(viewBill.total_amount)}</span>
              </div>
            </div>

            {/* Inward Items Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-slate-100 text-left font-bold uppercase text-[10px] text-slate-600">
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">Item Name &amp; Barcode</th>
                    <th className="p-2.5">Lot / Batch</th>
                    <th className="p-2.5 text-right">Qty</th>
                    <th className="p-2.5 text-right">Purchase Rate</th>
                    <th className="p-2.5 text-right">GST %</th>
                    <th className="p-2.5 text-right">GST Amount</th>
                    <th className="p-2.5 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewBill.purchase_items?.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="p-2.5 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-2.5">
                        <span className="font-bold text-slate-900">{item.products?.name ?? "—"}</span>
                        {item.barcode && (
                          <span className="block font-mono text-[10px] text-slate-400">{item.barcode}</span>
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-slate-600">
                        {item.lot_number || item.batch_number || "—"}
                      </td>
                      <td className="p-2.5 text-right font-bold">{item.quantity}</td>
                      <td className="p-2.5 text-right font-mono">{formatPrice(item.purchase_rate)}</td>
                      <td className="p-2.5 text-right text-slate-600">{item.gst_percentage}%</td>
                      <td className="p-2.5 text-right font-mono">{formatPrice(item.gst_amount)}</td>
                      <td className="p-2.5 text-right font-mono font-extrabold text-emerald-950">
                        {formatPrice(item.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-bold bg-slate-50">
                    <td colSpan={3} className="p-2.5">Total Inward Summary</td>
                    <td className="p-2.5 text-right font-bold">
                      {viewBill.purchase_items?.reduce((acc, i) => acc + i.quantity, 0)}
                    </td>
                    <td colSpan={2} className="p-2.5 text-right">Taxable: {formatPrice(viewBill.subtotal)}</td>
                    <td className="p-2.5 text-right font-mono">
                      {formatPrice(Number(viewBill.cgst) + Number(viewBill.sgst))}
                    </td>
                    <td className="p-2.5 text-right font-mono font-black text-emerald-950 text-sm">
                      {formatPrice(viewBill.total_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => printPurchase(viewBill)} variant="outline" className="gap-1.5 font-bold">
                <Printer className="h-4 w-4" />
                <span>Print Thermal Receipt</span>
              </Button>
              <Button onClick={() => setViewBill(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* EDIT MODAL WITH BIDIRECTIONAL CALCULATOR */}
      <Modal
        open={!!editBill}
        onClose={() => setEditBill(null)}
        title={`Edit Purchase Item — ${editBill?.bill_number ?? ""}`}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button onClick={handleEdit} loading={saving}>
              Update Purchase
            </Button>
            <Button variant="outline" onClick={() => setEditBill(null)}>
              Cancel
            </Button>
          </div>
        }
      >
        <form
          onSubmit={handleEdit}
          className="grid gap-3 sm:grid-cols-2 text-xs"
        >
          <SelectField
            label="Supplier"
            value={editForm.supplierId}
            onChange={(v) => setEditForm({ ...editForm, supplierId: v })}
            options={supplierOptions}
            required
          />
          <SelectField
            label="Product"
            value={editForm.productId}
            onChange={(v) => handleProductSelect(v, "edit")}
            options={productOptions}
            required
          />

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Barcode</label>
            <div className="flex items-center gap-1.5">
              <input
                value={editForm.barcode}
                onChange={(e) => handleBarcodeChange(e.target.value, "edit")}
                onKeyDown={(e) => handleBarcodeKeyDown(e, "edit")}
                className="h-9 w-full rounded border border-slate-300 px-3 font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setScannerTarget("edit");
                  setShowCameraScan(true);
                }}
                className="gap-1"
              >
                <Camera className="h-3.5 w-3.5" />
                Scan
              </Button>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-800">Quantity</label>
            <input
              id="edit-purchase-qty-input"
              type="number"
              min={1}
              value={editForm.quantity}
              onChange={(e) =>
                setEditForm((f) => recalculatePricing(f, { quantity: Number(e.target.value) }))
              }
              className="h-9 w-full rounded border border-slate-300 px-3 font-bold"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-emerald-950">
              Total Item Bill Amount (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={editForm.totalBillAmount || ""}
              onChange={(e) =>
                setEditForm((f) =>
                  recalculatePricing(f, { totalBillAmount: Number(e.target.value) || 0 })
                )
              }
              className="h-9 w-full rounded border-2 border-emerald-500 bg-emerald-50 px-3 font-bold text-right text-emerald-950"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-800">
              Single Item Purchase Rate (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={editForm.purchaseRate || ""}
              onChange={(e) =>
                setEditForm((f) =>
                  recalculatePricing(f, { purchaseRate: Number(e.target.value) || 0 })
                )
              }
              className="h-9 w-full rounded border border-slate-300 px-3 font-bold text-right"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-800">GST %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={editForm.gstPercentage}
              onChange={(e) =>
                setEditForm((f) =>
                  recalculatePricing(f, { gstPercentage: Number(e.target.value) || 0 })
                )
              }
              className="h-9 w-full rounded border border-slate-300 px-3 font-bold text-right"
            />
          </div>

          <div>
            <label className="mb-1 block text-slate-700">Selling Price (₹)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={editForm.sellingPrice || ""}
              onChange={(e) => setEditForm({ ...editForm, sellingPrice: Number(e.target.value) })}
              className="h-9 w-full rounded border border-slate-300 px-3 text-right"
            />
          </div>

          <div>
            <label className="mb-1 block text-slate-700">MRP (₹)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={editForm.mrp || ""}
              onChange={(e) => setEditForm({ ...editForm, mrp: Number(e.target.value) })}
              className="h-9 w-full rounded border border-slate-300 px-3 text-right"
            />
          </div>

          <div>
            <label className="mb-1 block text-slate-700">Lot Number</label>
            <input
              value={editForm.lotNumber}
              onChange={(e) => setEditForm({ ...editForm, lotNumber: e.target.value })}
              className="h-9 w-full rounded border border-slate-300 px-3"
            />
          </div>

          <div>
            <label className="mb-1 block text-slate-700">Expiry Date</label>
            <input
              type="date"
              value={editForm.expiryDate}
              onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
              className="h-9 w-full rounded border border-slate-300 px-3"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

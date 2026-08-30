"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Pause, Play, Printer, ScanBarcode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BarcodeScanner } from "@/components/erp/barcode-scanner";
import { ReceiptActions } from "@/components/erp/receipt-actions";
import { printReceipt } from "@/components/erp/receipt-print";
import { normalizeScannedBarcode } from "@/lib/barcode-scan-formats";
import { customerService, inventoryService, posService, settingsService } from "@/services/erp";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { useAuth } from "@/hooks/use-auth";
import type { Customer, ErpProduct, PosCartLine, PosSale } from "@/types/erp";
import type { PosPaymentMethod } from "@/lib/erp/constants";
import { LOYALTY_POINTS_PER_100, POS_PAYMENT_LABELS } from "@/lib/erp/constants";
import { isValidMobile } from "@/utils/phone";
import { formatPrice } from "@/utils/format";
import { receiptFromPosSale } from "@/utils/receipt";
import { resolveReceiptWidth, getAutoPrintPreference } from "@/utils/printer-prefs";
import { lineItemInclusiveGst } from "@/utils/gst";

type InvoiceRow = {
  id: string;
  productId: string | null;
  name: string;
  hsn: string;
  unit: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  gstPercentage: number;
  barcode: string | null;
  lotId: string | null;
};

function newRow(): InvoiceRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: null,
    name: "",
    hsn: "",
    unit: "",
    quantity: 1,
    rate: 0,
    discountPercent: 0,
    gstPercentage: 0,
    barcode: null,
    lotId: null,
  };
}

function lineAmount(row: InvoiceRow) {
  const gross = row.quantity * row.rate;
  return Math.round(gross * (1 - (row.discountPercent || 0) / 100) * 100) / 100;
}

function cellClass(extra = "") {
  return `h-8 w-full border-0 bg-transparent px-1.5 text-sm outline-none focus:bg-amber-100 ${extra}`;
}

export function PosInvoiceBilling() {
  const { settings } = useStoreSettings();
  const { profile } = useAuth();
  const [rows, setRows] = useState<InvoiceRow[]>([newRow()]);
  const [heldBills, setHeldBills] = useState<PosSale[]>([]);
  const [lastSale, setLastSale] = useState<PosSale | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [discount, setDiscount] = useState(0);
  const [received, setReceived] = useState(0);
  const [billNotes, setBillNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [printWidth, setPrintWidth] = useState<"58mm" | "80mm">("80mm");
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ErpProduct[]>([]);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const [showSuggest, setShowSuggest] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [showCameraScan, setShowCameraScan] = useState(false);
  const completeSaleRef = useRef<(autoPrint?: boolean) => Promise<void>>(async () => {});
  const holdBillRef = useRef<() => Promise<void>>(async () => {});
  const autoPrintSaleIdRef = useRef<string | null>(null);
  const itemInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const filledLines = rows.filter((r) => r.productId);
  const subtotal = filledLines.reduce((s, r) => s + lineAmount(r), 0);
  const gstTotal = filledLines.reduce((s, r) => {
    const unitRate = r.rate * (1 - (r.discountPercent || 0) / 100);
    const gst = lineItemInclusiveGst(unitRate, r.quantity, r.gstPercentage);
    return s + gst.totalGst;
  }, 0);
  const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  const balance = Math.round((received - total) * 100) / 100;
  const invoiceDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date()),
    []
  );

  const loadHeld = useCallback(() => {
    posService.getHeldBills().then(setHeldBills);
  }, []);

  useEffect(() => {
    loadHeld();
    settingsService.get().then((s) => setPrintWidth(resolveReceiptWidth(s.receipt_width)));
    requestAnimationFrame(() => scanInputRef.current?.focus());
  }, [loadHeld]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        scanInputRef.current?.focus();
        scanInputRef.current?.select();
      }
      if (e.key === "F4") {
        e.preventDefault();
        resetInvoice();
        toast.message("New invoice");
      }
      if (e.key === "F8" && filledLines.length) {
        e.preventDefault();
        void completeSaleRef.current(false);
      }
      if (e.key === "F9" && filledLines.length) {
        e.preventDefault();
        void completeSaleRef.current(true);
      }
      if (e.key === "F6" && filledLines.length) {
        e.preventDefault();
        void holdBillRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filledLines.length]);

  const resetInvoice = () => {
    const fresh = newRow();
    setRows([fresh]);
    setDiscount(0);
    setReceived(0);
    setBillNotes("");
    setSelectedCustomer(null);
    setCustomerMobile("");
    setCustomerName("");
    setPaymentMethod("cash");
    setActiveRowId(fresh.id);
    setShowSuggest(false);
    requestAnimationFrame(() => scanInputRef.current?.focus());
  };

  const updateRow = (id: string, patch: Partial<InvoiceRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const applyProduct = (rowId: string, product: ErpProduct) => {
    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    setRows((prev) => {
      const next = prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              productId: product.id,
              name: product.name,
              hsn: product.hsn_code ?? "",
              unit: product.unit ?? "pcs",
              quantity: r.quantity || 1,
              rate: Number(product.selling_price ?? product.price),
              discountPercent: Number(product.discount_percent ?? 0),
              gstPercentage: Number(product.gst_percentage ?? 0),
              barcode: product.barcode,
              lotId: null,
            }
          : r
      );
      if (next.every((r) => r.productId)) next.push(newRow());
      return next;
    });
    setShowSuggest(false);
    setSuggestions([]);
  };

  const addProductFromScan = useCallback(
    async (rawBarcode: string, options?: { keepScanFocus?: boolean; clearRowId?: string; exactBarcodeOnly?: boolean }) => {
      const code = normalizeScannedBarcode(rawBarcode);
      if (!code) return false;

      try {
        const resolved = await inventoryService.resolveByBarcode(code);
        let product = resolved?.product ?? null;
        if (!product && !options?.exactBarcodeOnly) {
          product = (await inventoryService.listProducts({ search: code }))[0] ?? null;
        }
        if (!product) {
          toast.error("Product not found for this barcode");
          return false;
        }

        const lot = resolved?.lot;
        const stock = lot ? lot.current_stock : product.stock;
        if (stock <= 0) {
          toast.error(`${product.name} is out of stock`);
          return false;
        }

        const lotId = lot?.id ?? null;
        const rate = Number(lot?.selling_price ?? product.selling_price ?? product.price);
        const barcode = lot?.barcode ?? product.barcode;

        setRows((prev) => {
          const existing = prev.find(
            (r) => r.productId === product.id && (r.lotId ?? null) === lotId
          );
          if (existing) {
            if (existing.quantity + 1 > stock) {
              toast.error("Not enough stock");
              return prev;
            }
            let next = prev.map((r) =>
              r.id === existing.id ? { ...r, quantity: r.quantity + 1 } : r
            );
            if (options?.clearRowId && options.clearRowId !== existing.id) {
              next = next.map((r) =>
                r.id === options.clearRowId
                  ? { ...newRow(), id: r.id }
                  : r
              );
            }
            return next;
          }

          const filled: Omit<InvoiceRow, "id"> = {
            productId: product.id,
            name: product.name,
            hsn: product.hsn_code ?? "",
            unit: product.unit ?? "pcs",
            quantity: 1,
            rate,
            discountPercent: Number(product.discount_percent ?? 0),
            gstPercentage: Number(product.gst_percentage ?? 0),
            barcode,
            lotId,
          };

          const targetId =
            options?.clearRowId && prev.some((r) => r.id === options.clearRowId && !r.productId)
              ? options.clearRowId
              : prev.find((r) => !r.productId)?.id;

          let next = targetId
            ? prev.map((r) => (r.id === targetId ? { ...r, ...filled } : r))
            : [...prev, { ...newRow(), ...filled }];

          if (next.every((r) => r.productId)) next = [...next, newRow()];
          return next;
        });

        toast.success(`Added: ${product.name}`);
        setShowSuggest(false);
        setSuggestions([]);
        setScanCode("");
        if (options?.keepScanFocus) {
          requestAnimationFrame(() => scanInputRef.current?.focus());
        }
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Barcode lookup failed");
        return false;
      }
    },
    []
  );

  const searchItems = async (rowId: string, query: string) => {
    updateRow(rowId, { name: query, productId: null });
    setActiveRowId(rowId);
    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggest(false);
      return;
    }
    const products = await inventoryService.listProducts({ search: query.trim() });
    setSuggestions(products.slice(0, 12));
    setSuggestIndex(0);
    setShowSuggest(true);
  };

  const toCartLines = (): PosCartLine[] =>
    filledLines.map((r) => ({
      productId: r.productId as string,
      lotId: r.lotId,
      name: r.name,
      barcode: r.barcode,
      rate: Math.round((r.rate * (1 - (r.discountPercent || 0) / 100)) * 100) / 100,
      gstPercentage: r.gstPercentage,
      quantity: r.quantity,
    }));

  const completeSale = async (autoPrint = false) => {
    const lines = toCartLines();
    if (!lines.length) {
      toast.error("Add at least one item");
      return;
    }
    if (paymentMethod === "credit" && !customerMobile.trim()) {
      toast.error("Enter customer mobile for credit sale");
      return;
    }
    setProcessing(true);
    try {
      const sale = await posService.createSale({
        lines,
        paymentMethod,
        customerId: selectedCustomer?.id,
        customerName: customerName.trim() || undefined,
        customerMobile: customerMobile.trim() || undefined,
        discount,
        notes: billNotes.trim() || undefined,
      });
      setLastSale(sale);
      if (autoPrint && getAutoPrintPreference()) autoPrintSaleIdRef.current = sale.id;
      toast.success(`Invoice ${sale.bill_number} saved`);
      resetInvoice();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sale failed");
    } finally {
      setProcessing(false);
    }
  };

  completeSaleRef.current = completeSale;

  useEffect(() => {
    if (!lastSale || lastSale.id !== autoPrintSaleIdRef.current) return;
    autoPrintSaleIdRef.current = null;
    const timer = window.setTimeout(() => {
      const printed = printReceipt("pos-invoice-receipt", printWidth);
      if (!printed) toast.error("Could not print — use Print below");
    }, 450);
    return () => window.clearTimeout(timer);
  }, [lastSale, printWidth]);

  const holdBill = async () => {
    const lines = toCartLines();
    if (!lines.length) return;
    setProcessing(true);
    try {
      await posService.holdBill({
        lines,
        customerName: customerName || "Held Invoice",
        customerMobile: customerMobile.trim() || undefined,
        customerId: selectedCustomer?.id,
        notes: "Held invoice",
      });
      toast.success("Invoice held");
      resetInvoice();
      loadHeld();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to hold");
    } finally {
      setProcessing(false);
    }
  };

  holdBillRef.current = holdBill;

  const lookupCustomer = async () => {
    const mobile = customerMobile.trim();
    const name = customerName.trim();
    if (!mobile && !name) {
      setSelectedCustomer(null);
      return;
    }
    if (mobile && !isValidMobile(mobile)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    try {
      const found = await customerService.findForPos({ mobile, name });
      if (found) {
        setSelectedCustomer(found);
        setCustomerName(found.name);
        setCustomerMobile(found.mobile);
        toast.success(`Party: ${found.name}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Customer lookup failed");
    }
  };

  const resumeHeld = async (saleId: string) => {
    try {
      const sale = await posService.getById(saleId);
      if (!sale?.pos_sale_items) return;
      const restored = sale.pos_sale_items.map((i) => ({
        id: `${i.product_id}-${Math.random().toString(36).slice(2, 6)}`,
        productId: i.product_id,
        name: i.product_name,
        hsn: "",
        unit: "pcs",
        quantity: i.quantity,
        rate: Number(i.rate),
        discountPercent: 0,
        gstPercentage: Number(i.gst_percentage),
        barcode: i.barcode,
        lotId: (i as { lot_id?: string }).lot_id ?? null,
      }));
      setRows([...restored, newRow()]);
      setCustomerName(sale.customer_name ?? "");
      setCustomerMobile(sale.customer_mobile ?? "");
      await posService.resumeBill(saleId);
      loadHeld();
      toast.success("Invoice resumed");
    } catch {
      toast.error("Could not resume invoice");
    }
  };

  const handleItemKey = (row: InvoiceRow, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (!showSuggest || !suggestions.length || activeRowId !== row.id)) {
      e.preventDefault();
      const typed = row.name.trim();
      if (typed && /^[0-9A-Za-z._-]{6,}$/.test(typed)) {
        void addProductFromScan(typed, { clearRowId: row.id, exactBarcodeOnly: true }).then(
          (found) => {
            if (!found) document.getElementById(`qty-${row.id}`)?.focus();
          }
        );
      } else {
        document.getElementById(`qty-${row.id}`)?.focus();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSuggestIndex((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSuggestIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = suggestions[suggestIndex];
      if (pick) {
        applyProduct(row.id, pick);
        requestAnimationFrame(() => document.getElementById(`qty-${row.id}`)?.focus());
      }
    } else if (e.key === "Escape") {
      setShowSuggest(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-700 bg-white shadow-sm lg:min-h-[calc(100vh-8rem)]">
      <header className="flex flex-wrap items-center justify-between gap-2 bg-[#1a365d] px-4 py-2.5 text-white">
        <div>
          <h1 className="text-lg font-semibold tracking-wide">Sales Invoice</h1>
          <p className="text-[11px] text-slate-300">
            Scan gun (F2) · Type item → Tab Qty → Tab Rate · F4 New · F8 Save · F9 Print
          </p>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-[10px] uppercase text-slate-300">Invoice No.</p>
            <p className="font-mono font-semibold">{lastSale?.bill_number ?? "Auto"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-300">Date</p>
            <p className="font-semibold">{invoiceDate}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-3 border-b bg-slate-50 px-4 py-3 lg:grid-cols-4">
        <label className="text-xs font-medium text-slate-600 lg:col-span-2">
          Barcode / scanner gun
          <div className="mt-1 flex gap-2">
            <input
              ref={scanInputRef}
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                e.stopPropagation();
                void addProductFromScan(scanCode, { keepScanFocus: true });
              }}
              placeholder="Focus here and scan, then Enter"
              className="h-9 flex-1 rounded border border-slate-300 bg-white px-2 font-mono text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <Button
              type="button"
              size="sm"
              variant={showCameraScan ? "primary" : "outline"}
              className="shrink-0"
              onClick={() => setShowCameraScan((s) => !s)}
            >
              <ScanBarcode className="mr-1 h-4 w-4" />
              {showCameraScan ? "Hide" : "Camera"}
            </Button>
          </div>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Party / Customer
          <input
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value);
              setSelectedCustomer(null);
            }}
            onBlur={() => void lookupCustomer()}
            placeholder="Name"
            className="mt-1 h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Mobile
          <input
            value={customerMobile}
            onChange={(e) => {
              setCustomerMobile(e.target.value);
              setSelectedCustomer(null);
            }}
            onBlur={() => void lookupCustomer()}
            placeholder="10-digit mobile"
            className="mt-1 h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Narration
          <input
            value={billNotes}
            onChange={(e) => setBillNotes(e.target.value)}
            placeholder="Optional notes"
            className="mt-1 h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </label>
      </div>
      {showCameraScan && (
        <div className="border-b bg-white px-4 py-3">
          <BarcodeScanner
            defaultMode="keyboard"
            onScan={(code) => {
              void addProductFromScan(code, { keepScanFocus: true });
            }}
            onClose={() => setShowCameraScan(false)}
          />
        </div>
      )}
      {selectedCustomer && (
        <p className="border-b bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
          Linked: {selectedCustomer.name} · Points {selectedCustomer.loyalty_points}
          {selectedCustomer.credit_balance > 0
            ? ` · Credit due ${formatPrice(selectedCustomer.credit_balance)}`
            : ""}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[#2c5282] text-white">
            <tr className="text-left text-[11px] uppercase tracking-wide">
              <th className="w-10 border-r border-slate-500 px-2 py-2">#</th>
              <th className="min-w-[220px] border-r border-slate-500 px-2 py-2">Name of Item</th>
              <th className="w-24 border-r border-slate-500 px-2 py-2">HSN</th>
              <th className="w-20 border-r border-slate-500 px-2 py-2 text-right">Qty</th>
              <th className="w-16 border-r border-slate-500 px-2 py-2">Unit</th>
              <th className="w-24 border-r border-slate-500 px-2 py-2 text-right">Rate</th>
              <th className="w-16 border-r border-slate-500 px-2 py-2 text-right">Disc %</th>
              <th className="w-28 border-r border-slate-500 px-2 py-2 text-right">Amount</th>
              <th className="w-10 px-1 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.id}
                className={`border-b border-slate-200 ${
                  activeRowId === row.id ? "bg-amber-50/80" : idx % 2 ? "bg-slate-50" : "bg-white"
                }`}
              >
                <td className="px-2 py-0.5 text-center text-slate-500">{idx + 1}</td>
                <td className="relative px-0 py-0.5">
                  <input
                    ref={(el) => {
                      itemInputRefs.current[row.id] = el;
                    }}
                    value={row.name}
                    placeholder="Type to search item..."
                    onFocus={() => setActiveRowId(row.id)}
                    onChange={(e) => void searchItems(row.id, e.target.value)}
                    onKeyDown={(e) => handleItemKey(row, e)}
                    className={cellClass()}
                  />
                  {showSuggest && activeRowId === row.id && suggestions.length > 0 && (
                    <ul className="absolute left-0 top-full z-20 max-h-56 w-[min(28rem,70vw)] overflow-auto rounded border bg-white shadow-lg">
                      {suggestions.map((p, i) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              applyProduct(row.id, p);
                              requestAnimationFrame(() =>
                                document.getElementById(`qty-${row.id}`)?.focus()
                              );
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                              i === suggestIndex ? "bg-amber-100" : "hover:bg-slate-50"
                            }`}
                          >
                            <span className="truncate font-medium">{p.name}</span>
                            <span className="ml-2 shrink-0 text-xs text-slate-500">
                              {formatPrice(p.selling_price ?? p.price)} · {p.stock}{" "}
                              {p.unit ?? ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-0 py-0.5">
                  <input
                    value={row.hsn}
                    onChange={(e) => updateRow(row.id, { hsn: e.target.value })}
                    className={cellClass()}
                  />
                </td>
                <td className="px-0 py-0.5">
                  <input
                    id={`qty-${row.id}`}
                    type="number"
                    min={0}
                    step="any"
                    value={row.quantity}
                    onFocus={() => setActiveRowId(row.id)}
                    onChange={(e) =>
                      updateRow(row.id, { quantity: Number(e.target.value) || 0 })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        document.getElementById(`rate-${row.id}`)?.focus();
                      }
                    }}
                    className={cellClass("text-right")}
                  />
                </td>
                <td className="px-1.5 py-0.5 text-slate-600">{row.unit}</td>
                <td className="px-0 py-0.5">
                  <input
                    id={`rate-${row.id}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.rate}
                    onFocus={() => setActiveRowId(row.id)}
                    onChange={(e) =>
                      updateRow(row.id, { rate: Number(e.target.value) || 0 })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const next = rows[idx + 1];
                        if (next) itemInputRefs.current[next.id]?.focus();
                        else {
                          const extra = newRow();
                          setRows((prev) => [...prev, extra]);
                          requestAnimationFrame(() =>
                            itemInputRefs.current[extra.id]?.focus()
                          );
                        }
                      }
                    }}
                    className={cellClass("text-right font-medium")}
                  />
                </td>
                <td className="px-0 py-0.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={row.discountPercent || ""}
                    onChange={(e) =>
                      updateRow(row.id, {
                        discountPercent: Number(e.target.value) || 0,
                      })
                    }
                    className={cellClass("text-right")}
                  />
                </td>
                <td className="px-2 py-0.5 text-right font-medium tabular-nums">
                  {lineAmount(row).toFixed(2)}
                </td>
                <td className="px-1 py-0.5 text-center">
                  {row.productId ? (
                    <button
                      type="button"
                      onClick={() =>
                        setRows((prev) => {
                          const next = prev.filter((r) => r.id !== row.id);
                          return next.length ? next : [newRow()];
                        })
                      }
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                      aria-label="Delete line"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 border-t bg-slate-50 p-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase text-slate-500">
              Mode of payment
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(["cash", "upi", "card", "credit"] as PosPaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`rounded px-3 py-1.5 text-sm font-medium ${
                    paymentMethod === m
                      ? "bg-[#1a365d] text-white"
                      : "border bg-white text-slate-700"
                  }`}
                >
                  {POS_PAYMENT_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void holdBill()}
              disabled={processing || !filledLines.length}
            >
              <Pause className="mr-1 h-4 w-4" />
              Hold
              <span className="ml-1 text-[10px] opacity-60">F6</span>
            </Button>
            <Button
              onClick={() => void completeSale(false)}
              disabled={processing || !filledLines.length}
              className="bg-[#1a365d] hover:bg-[#153054]"
            >
              Save Invoice
              <span className="ml-1 text-[10px] opacity-70">F8</span>
            </Button>
            <Button
              onClick={() => void completeSale(true)}
              disabled={processing || !filledLines.length}
            >
              <Printer className="mr-1 h-4 w-4" />
              Save &amp; Print
              <span className="ml-1 text-[10px] opacity-70">F9</span>
            </Button>
            <Button type="button" variant="ghost" onClick={resetInvoice}>
              New (F4)
            </Button>
          </div>
          {heldBills.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase text-slate-500">
                Held invoices
              </p>
              {heldBills.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => resumeHeld(b.id)}
                  className="mb-1 mr-1 inline-flex items-center gap-1 rounded border bg-white px-2 py-1 text-xs hover:bg-slate-100"
                >
                  {b.bill_number}
                  <Play className="h-3 w-3 text-green-600" />
                </button>
              ))}
            </div>
          )}
          {lastSale && (
            <ReceiptActions
              data={{
                ...receiptFromPosSale(lastSale),
                cashierName: profile?.name ?? null,
              }}
              settings={settings}
              defaultWidth={printWidth}
              receiptId="pos-invoice-receipt"
            />
          )}
        </div>

        <div className="rounded-lg border bg-white p-3 text-sm">
          <div className="flex justify-between py-0.5">
            <span className="text-slate-600">Taxable / Subtotal</span>
            <span className="tabular-nums">{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-0.5 text-slate-500">
            <span>GST (incl.)</span>
            <span className="tabular-nums">{gstTotal.toFixed(2)}</span>
          </div>
          <label className="mt-2 flex items-center justify-between gap-2">
            <span className="text-slate-600">Bill discount</span>
            <input
              type="number"
              min={0}
              value={discount || ""}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              className="h-8 w-28 rounded border px-2 text-right text-sm focus:border-amber-400 focus:outline-none"
            />
          </label>
          <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold text-[#1a365d]">
            <span>Grand Total</span>
            <span className="tabular-nums">{formatPrice(total)}</span>
          </div>
          <label className="mt-2 flex items-center justify-between gap-2">
            <span className="text-slate-600">Received</span>
            <input
              type="number"
              min={0}
              value={received || ""}
              onChange={(e) => setReceived(Number(e.target.value) || 0)}
              className="h-8 w-28 rounded border px-2 text-right text-sm focus:border-amber-400 focus:outline-none"
            />
          </label>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-slate-600">{balance >= 0 ? "Change" : "Balance due"}</span>
            <span className={`font-semibold tabular-nums ${balance < 0 ? "text-red-600" : ""}`}>
              {formatPrice(Math.abs(balance))}
            </span>
          </div>
          {selectedCustomer && total > 0 && (
            <p className="mt-2 text-[11px] text-slate-500">
              Loyalty earn: {Math.floor(total / 100) * LOYALTY_POINTS_PER_100} pts
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

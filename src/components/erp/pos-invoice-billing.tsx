"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Pause, Play, Printer, ScanBarcode, Trash2, Tag, MessageCircle, Globe } from "lucide-react";
import { toast } from "sonner";
import { openWhatsAppShare, posBillWhatsAppMessage } from "@/utils/whatsapp";
import { Button } from "@/components/ui/button";
import { BarcodeScanner } from "@/components/erp/barcode-scanner";
import { ReceiptActions } from "@/components/erp/receipt-actions";
import { printReceipt } from "@/components/erp/receipt-print";
import { ProductDetailsLookupModal } from "@/components/erp/product-details-lookup-modal";
import { PosCreateOnlineAccountModal } from "@/components/erp/pos-create-online-account-modal";
import { OfflineStatusBanner } from "@/components/erp/offline-status-banner";
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
import {
  resolveReceiptWidth,
  setLocalReceiptWidth,
  RECEIPT_WIDTH_OPTIONS,
  type ReceiptWidth,
} from "@/utils/printer-prefs";
import { lineItemInclusiveGst } from "@/utils/gst";

type InvoiceRow = {
  id: string;
  productId: string | null;
  name: string;
  hsn: string;
  unit: "pcs" | "pkt" | "box" | string;
  packMultiplier?: number;
  piecesPerPacket?: number;
  packetsPerBox?: number;
  packetSellingPrice?: number | null;
  boxSellingPrice?: number | null;
  baseRate?: number;
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
    unit: "pcs",
    packMultiplier: 1,
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

function focusCell(id: string) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el) return;
  el.focus();
  el.select();
}

const CHECKOUT_PAY_OPTIONS: { id: PosPaymentMethod; label: string; key: string }[] = [
  { id: "cash", label: "Cash", key: "1" },
  { id: "upi", label: "Online", key: "2" },
  { id: "credit", label: "Credit", key: "3" },
];

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
  const [showOnlineAccountModal, setShowOnlineAccountModal] = useState(false);
  const [loyaltyRedeem, setLoyaltyRedeem] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [received, setReceived] = useState(0);
  const [billNotes, setBillNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [printWidth, setPrintWidth] = useState<ReceiptWidth>("80mm");
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ErpProduct[]>([]);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const [showSuggest, setShowSuggest] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [showCameraScan, setShowCameraScan] = useState(false);
  const [showProductLookup, setShowProductLookup] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"idle" | "payment" | "save">("idle");
  const [payOptionIndex, setPayOptionIndex] = useState(0);
  const [saveBillHighlight, setSaveBillHighlight] = useState(false);
  const completeSaleRef = useRef<(autoPrint?: boolean, method?: PosPaymentMethod) => Promise<void>>(
    async () => {}
  );
  const promptCheckoutRef = useRef<() => void>(() => {});
  const confirmPaymentRef = useRef<(index?: number) => void>(() => {});
  const holdBillRef = useRef<() => Promise<void>>(async () => {});
  const autoPrintSaleIdRef = useRef<string | null>(null);
  const itemInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const savePrintTimerRef = useRef<number | null>(null);

  const filledLines = rows.filter((r) => r.productId);
  const grossSubtotal = filledLines.reduce((s, r) => s + r.rate * r.quantity, 0);
  const itemDiscounts = filledLines.reduce((s, r) => {
    const unitDiscount =
      Math.round(r.rate * ((r.discountPercent || 0) / 100) * 100) / 100;
    return s + unitDiscount * r.quantity;
  }, 0);
  const loyaltyEnabled = settings?.enable_loyalty_points !== false;
  const pointValue = Number(settings?.loyalty_point_value ?? 1.0);
  const loyaltyDiscountAmount = loyaltyEnabled ? Math.round(loyaltyRedeem * pointValue * 100) / 100 : 0;
  const totalItemDiscount = Math.round(itemDiscounts * 100) / 100;
  const totalAllDiscounts = Math.round((totalItemDiscount + discount + loyaltyDiscountAmount) * 100) / 100;
  const gstTotal = filledLines.reduce((s, r) => {
    const unitRate = r.rate * (1 - (r.discountPercent || 0) / 100);
    const gst = lineItemInclusiveGst(unitRate, r.quantity, r.gstPercentage);
    return s + gst.totalGst;
  }, 0);
  const total = Math.max(0, Math.round((grossSubtotal - totalAllDiscounts) * 100) / 100);
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
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (checkoutStep === "payment") {
        if (e.key === "Escape") {
          e.preventDefault();
          setCheckoutStep("idle");
          return;
        }
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          setPayOptionIndex((i) => (i + 1) % CHECKOUT_PAY_OPTIONS.length);
          return;
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          setPayOptionIndex(
            (i) => (i - 1 + CHECKOUT_PAY_OPTIONS.length) % CHECKOUT_PAY_OPTIONS.length
          );
          return;
        }
        if (e.key === "1" || e.key === "2" || e.key === "3") {
          e.preventDefault();
          confirmPaymentRef.current(Number(e.key) - 1);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          confirmPaymentRef.current();
          return;
        }
        return;
      }

      if (e.key === "F2") {
        e.preventDefault();
        scanInputRef.current?.focus();
        scanInputRef.current?.select();
      }
      if (e.key === "F3") {
        e.preventDefault();
        setShowProductLookup((s) => !s);
      }
      if (e.key === "F4") {
        e.preventDefault();
        resetInvoice();
        toast.message("New invoice");
      }
      if (activeRowId) {
        if (e.altKey && (e.key === "p" || e.key === "P" || e.key === "1")) {
          e.preventDefault();
          switchRowUnit(activeRowId, "pcs");
          toast.info("Switched to Pcs (1 pc)");
          return;
        }
        if (e.altKey && (e.key === "k" || e.key === "K" || e.key === "2")) {
          e.preventDefault();
          switchRowUnit(activeRowId, "pkt");
          toast.info("Switched to Packet");
          return;
        }
        if (e.altKey && (e.key === "b" || e.key === "B" || e.key === "3")) {
          e.preventDefault();
          switchRowUnit(activeRowId, "box");
          toast.info("Switched to Box");
          return;
        }
        if (e.altKey && (e.key === "u" || e.key === "U")) {
          e.preventDefault();
          const target = rows.find((r) => r.id === activeRowId);
          if (target) {
            const next = target.unit === "pcs" ? "pkt" : target.unit === "pkt" ? "box" : "pcs";
            switchRowUnit(activeRowId, next);
          }
          return;
        }
      }

      if ((e.key === "F8" || e.key === "F9") && filledLines.length) {
        e.preventDefault();
        promptCheckoutRef.current();
      }
      if (e.key === "F6" && filledLines.length) {
        e.preventDefault();
        void holdBillRef.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [filledLines.length, checkoutStep, activeRowId, rows]);

  const resetInvoice = () => {
    const fresh = newRow();
    setRows([fresh]);
    setDiscount(0);
    setLoyaltyRedeem(0);
    setReceived(0);
    setBillNotes("");
    setSelectedCustomer(null);
    setCustomerMobile("");
    setCustomerName("");
    setPaymentMethod("cash");
    setActiveRowId(fresh.id);
    setShowSuggest(false);
    setCheckoutStep("idle");
    setSaveBillHighlight(false);
    if (savePrintTimerRef.current) {
      window.clearTimeout(savePrintTimerRef.current);
      savePrintTimerRef.current = null;
    }
    requestAnimationFrame(() => scanInputRef.current?.focus());
  };

  const updateRow = (id: string, patch: Partial<InvoiceRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const switchRowUnit = (rowId: string, nextUnit: "pcs" | "pkt" | "box") => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const piecesPerPkt = r.piecesPerPacket || 12;
        const pktsPerBox = r.packetsPerBox || 12;
        const totalPcsInBox = piecesPerPkt * pktsPerBox;
        const baseRate = Number(r.baseRate ?? r.rate);

        let packMultiplier = 1;
        let rate = baseRate;
        if (nextUnit === "pkt") {
          packMultiplier = piecesPerPkt;
          rate = Number(r.packetSellingPrice) || (baseRate * piecesPerPkt);
        } else if (nextUnit === "box") {
          packMultiplier = totalPcsInBox;
          rate = Number(r.boxSellingPrice) || (baseRate * totalPcsInBox);
        }
        return {
          ...r,
          unit: nextUnit,
          packMultiplier,
          rate: Math.round(rate * 100) / 100,
        };
      })
    );
  };

  const handleRowQtyInput = (rowId: string, val: string) => {
    const trimmed = val.trim().toLowerCase();
    const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
    if (match) {
      const num = parseFloat(match[1]) || 1;
      const unitPart = match[2];
      if (unitPart) {
        if (unitPart.startsWith("p")) {
          switchRowUnit(rowId, "pcs");
        } else if (unitPart.startsWith("k")) {
          switchRowUnit(rowId, "pkt");
        } else if (unitPart.startsWith("b")) {
          switchRowUnit(rowId, "box");
        }
        updateRow(rowId, { quantity: num });
      } else {
        // Automatically calculate box or packets based on quantity entered in pieces
        setRows((prev) =>
          prev.map((r) => {
            if (r.id !== rowId) return r;
            const piecesPerPkt = r.piecesPerPacket || 12;
            const pktsPerBox = r.packetsPerBox || 12;
            const totalPcsInBox = piecesPerPkt * pktsPerBox;
            const baseRate = Number(r.baseRate ?? r.rate);

            // If row is already set to pkt or box, treat num as quantity of that unit
            if (r.unit === "pkt" || r.unit === "box") {
              return { ...r, quantity: Math.max(1, num) };
            }

            // In pcs mode: auto-calculate boxes or packets
            if (num >= totalPcsInBox && num % totalPcsInBox === 0) {
              const boxes = num / totalPcsInBox;
              const rate = Number(r.boxSellingPrice) || (baseRate * totalPcsInBox);
              toast.info(`Auto-calculated: ${num} pcs = ${boxes} Box`);
              return {
                ...r,
                unit: "box",
                packMultiplier: totalPcsInBox,
                rate: Math.round(rate * 100) / 100,
                quantity: boxes,
              };
            }
            if (num >= piecesPerPkt && num % piecesPerPkt === 0) {
              const pkts = num / piecesPerPkt;
              const rate = Number(r.packetSellingPrice) || (baseRate * piecesPerPkt);
              toast.info(`Auto-calculated: ${num} pcs = ${pkts} Packet`);
              return {
                ...r,
                unit: "pkt",
                packMultiplier: piecesPerPkt,
                rate: Math.round(rate * 100) / 100,
                quantity: pkts,
              };
            }

            return { ...r, quantity: Math.max(1, num) };
          })
        );
      }
    } else {
      updateRow(rowId, { quantity: parseFloat(val) || 0 });
    }
  };

  const applyProduct = (
    rowId: string,
    product: ErpProduct,
    initialUnit: "pcs" | "pkt" | "box" = "pcs",
    initialMultiplier = 1
  ) => {
    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    const piecesPerPkt = Number(product.pieces_per_packet) || 12;
    const pktsPerBox = Number(product.packets_per_box) || 12;
    const totalPcsInBox = piecesPerPkt * pktsPerBox;
    const baseRate = Number(product.selling_price ?? product.price);

    let unit = initialUnit;
    let packMultiplier = 1;
    let rate = baseRate;
    if (unit === "pkt") {
      packMultiplier = piecesPerPkt;
      rate = Number(product.packet_selling_price) || (baseRate * piecesPerPkt);
    } else if (unit === "box") {
      packMultiplier = totalPcsInBox;
      rate = Number(product.box_selling_price) || (baseRate * totalPcsInBox);
    }

    setRows((prev) => {
      const next = prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              productId: product.id,
              name: product.name,
              hsn: product.hsn_code ?? "",
              unit,
              packMultiplier,
              piecesPerPacket: piecesPerPkt,
              packetsPerBox: pktsPerBox,
              packetSellingPrice: product.packet_selling_price ?? null,
              boxSellingPrice: product.box_selling_price ?? null,
              baseRate,
              quantity: initialMultiplier || r.quantity || 1,
              rate,
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
      let code = normalizeScannedBarcode(rawBarcode);
      if (!code) return false;

      let multiplier = 1;
      let targetUnit: "pcs" | "pkt" | "box" | undefined = undefined;
      const starMatch = code.match(/^(\d+)([pkb])?\s*\*\s*(.+)$/i);
      if (starMatch) {
        multiplier = parseInt(starMatch[1], 10) || 1;
        if (starMatch[2]) {
          const u = starMatch[2].toLowerCase();
          if (u === "p") targetUnit = "pcs";
          else if (u === "k") targetUnit = "pkt";
          else if (u === "b") targetUnit = "box";
        }
        code = starMatch[3].trim();
      }

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

        const piecesPerPkt = Number(product.pieces_per_packet) || 12;
        const pktsPerBox = Number(product.packets_per_box) || 12;
        const totalPcsInBox = piecesPerPkt * pktsPerBox;
        const baseRate = Number(lot?.selling_price ?? product.selling_price ?? product.price);

        let unit: "pcs" | "pkt" | "box" = targetUnit || (resolved as any)?.unit || "pcs";
        let packMultiplier = 1;
        let rate = baseRate;

        // Auto-calculate packet or box from scan multiplier if no unit explicitly specified
        if (!targetUnit && unit === "pcs") {
          if (multiplier >= totalPcsInBox && multiplier % totalPcsInBox === 0) {
            unit = "box";
            packMultiplier = totalPcsInBox;
            rate = Number(product.box_selling_price) || (baseRate * totalPcsInBox);
            multiplier = multiplier / totalPcsInBox;
            toast.info(`Auto-calculated: ${multiplier} Box`);
          } else if (multiplier >= piecesPerPkt && multiplier % piecesPerPkt === 0) {
            unit = "pkt";
            packMultiplier = piecesPerPkt;
            rate = Number(product.packet_selling_price) || (baseRate * piecesPerPkt);
            multiplier = multiplier / piecesPerPkt;
            toast.info(`Auto-calculated: ${multiplier} Packet`);
          }
        }

        if (unit === "pkt") {
          packMultiplier = piecesPerPkt;
          rate = Number(product.packet_selling_price) || (baseRate * piecesPerPkt);
        } else if (unit === "box") {
          packMultiplier = totalPcsInBox;
          rate = Number(product.box_selling_price) || (baseRate * totalPcsInBox);
        }

        const lotId = lot?.id ?? null;
        const barcode = lot?.barcode ?? product.barcode;

        setRows((prev) => {
          const existing = prev.find(
            (r) => r.productId === product.id && (r.lotId ?? null) === lotId && r.unit === unit
          );
          if (existing) {
            const totalExistingPieces = existing.quantity * (existing.packMultiplier || 1);
            const newTotalPieces = totalExistingPieces + (multiplier * packMultiplier);
            if (newTotalPieces > stock) {
              toast.error("Not enough stock");
              return prev;
            }

            // If existing row is in loose pcs, check if repeated scanning reaches packet or box
            if (existing.unit === "pcs") {
              if (newTotalPieces >= totalPcsInBox && newTotalPieces % totalPcsInBox === 0) {
                const boxes = newTotalPieces / totalPcsInBox;
                const boxRate = Number(existing.boxSellingPrice) || (baseRate * totalPcsInBox);
                toast.info(`Auto-calculated: ${newTotalPieces} pcs = ${boxes} Box`);
                let next = prev.map((r) =>
                  r.id === existing.id
                    ? {
                        ...r,
                        unit: "box",
                        packMultiplier: totalPcsInBox,
                        rate: Math.round(boxRate * 100) / 100,
                        quantity: boxes,
                      }
                    : r
                );
                if (options?.clearRowId && options.clearRowId !== existing.id) {
                  next = next.map((r) => (r.id === options.clearRowId ? { ...newRow(), id: r.id } : r));
                }
                return next;
              }
              if (newTotalPieces >= piecesPerPkt && newTotalPieces % piecesPerPkt === 0) {
                const pkts = newTotalPieces / piecesPerPkt;
                const pktRate = Number(existing.packetSellingPrice) || (baseRate * piecesPerPkt);
                toast.info(`Auto-calculated: ${newTotalPieces} pcs = ${pkts} Packet`);
                let next = prev.map((r) =>
                  r.id === existing.id
                    ? {
                        ...r,
                        unit: "pkt",
                        packMultiplier: piecesPerPkt,
                        rate: Math.round(pktRate * 100) / 100,
                        quantity: pkts,
                      }
                    : r
                );
                if (options?.clearRowId && options.clearRowId !== existing.id) {
                  next = next.map((r) => (r.id === options.clearRowId ? { ...newRow(), id: r.id } : r));
                }
                return next;
              }
            }

            let next = prev.map((r) =>
              r.id === existing.id ? { ...r, quantity: r.quantity + multiplier } : r
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
            unit,
            packMultiplier,
            piecesPerPacket: piecesPerPkt,
            packetsPerBox: pktsPerBox,
            packetSellingPrice: product.packet_selling_price ?? null,
            boxSellingPrice: product.box_selling_price ?? null,
            baseRate,
            quantity: multiplier,
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

        const unitSuffix = unit === "pcs" ? "" : ` [${unit.toUpperCase()}]`;
        toast.success(`Added: ${product.name}${unitSuffix}`, { id: "pos-scan-added" });
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
    let searchTerm = query.trim();
    if (!searchTerm) {
      setSuggestions([]);
      setShowSuggest(false);
      return;
    }
    const starMatch = searchTerm.match(/^(\d+)([pkb])?\s*\*\s*(.+)$/i);
    if (starMatch) {
      searchTerm = starMatch[3].trim();
    }
    if (!searchTerm) {
      setSuggestions([]);
      setShowSuggest(false);
      return;
    }
    const products = await inventoryService.listProducts({ search: searchTerm });
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
      rate: r.rate,
      unit: (r.unit === "pkt" || r.unit === "box" ? r.unit : "pcs") as "pcs" | "pkt" | "box",
      packMultiplier: r.packMultiplier || 1,
      piecesPerPacket: r.piecesPerPacket,
      packetsPerBox: r.packetsPerBox,
      packetSellingPrice: r.packetSellingPrice,
      boxSellingPrice: r.boxSellingPrice,
      discountPercent: r.discountPercent || 0,
      gstPercentage: r.gstPercentage,
      quantity: r.quantity,
    }));

  const completeSale = async (autoPrint = false, method?: PosPaymentMethod) => {
    const lines = toCartLines();
    if (!lines.length) {
      toast.error("Add at least one item");
      return;
    }
    const pay = method ?? paymentMethod;
    if (pay === "credit" && !customerMobile.trim()) {
      toast.error("Enter customer mobile for credit sale");
      setCheckoutStep("payment");
      setSaveBillHighlight(false);
      return;
    }
    setProcessing(true);
    try {
      const sale = await posService.createSale({
        lines,
        paymentMethod: pay,
        customerId: selectedCustomer?.id,
        customerName: customerName.trim() || undefined,
        customerMobile: customerMobile.trim() || undefined,
        discount,
        loyaltyPointsRedeemed: loyaltyEnabled && loyaltyRedeem > 0 ? loyaltyRedeem : undefined,
        notes: billNotes.trim() || undefined,
      });
      setLastSale(sale);
      if (autoPrint) autoPrintSaleIdRef.current = sale.id;
      const custMobile = customerMobile.trim() || selectedCustomer?.mobile;
      toast.success(`Invoice ${sale.bill_number} saved`, {
        action: custMobile
          ? {
              label: "WhatsApp Bill",
              onClick: () =>
                openWhatsAppShare(
                  posBillWhatsAppMessage({
                    billNumber: sale.bill_number,
                    totalAmount: sale.total_amount,
                    customerName: sale.customer_name,
                    paymentMethod: sale.payment_method,
                    itemsCount: sale.pos_sale_items?.length ?? lines.length,
                    discount: sale.discount,
                  }),
                  custMobile
                ),
            }
          : undefined,
      });
      resetInvoice();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sale failed");
      setCheckoutStep("idle");
      setSaveBillHighlight(false);
    } finally {
      setProcessing(false);
    }
  };

  completeSaleRef.current = completeSale;

  const promptCheckout = () => {
    if (!filledLines.length) {
      toast.error("Add at least one item");
      return;
    }
    if (processing) return;
    setPayOptionIndex(0);
    setCheckoutStep("payment");
    setSaveBillHighlight(false);
  };

  promptCheckoutRef.current = promptCheckout;

  const confirmPayment = (index = payOptionIndex) => {
    const option = CHECKOUT_PAY_OPTIONS[index] ?? CHECKOUT_PAY_OPTIONS[0];
    setPaymentMethod(option.id);
    setPayOptionIndex(index);
    if (option.id === "credit" && !customerMobile.trim()) {
      toast.error("Enter customer mobile for credit sale");
      return;
    }
    setCheckoutStep("save");
    setSaveBillHighlight(true);
    if (savePrintTimerRef.current) window.clearTimeout(savePrintTimerRef.current);
    savePrintTimerRef.current = window.setTimeout(() => {
      void completeSaleRef.current(true, option.id);
    }, 400);
  };

  confirmPaymentRef.current = confirmPayment;

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

  const handleRowQtyKeyDown = (row: InvoiceRow, e: KeyboardEvent<HTMLInputElement>) => {
    setActiveRowId(row.id);
    if (e.key === "ArrowUp" || e.key === "+") {
      e.preventDefault();
      updateRow(row.id, { quantity: (row.quantity || 0) + 1 });
      return;
    }
    if (e.key === "ArrowDown" || e.key === "-") {
      e.preventDefault();
      updateRow(row.id, { quantity: Math.max(1, (row.quantity || 1) - 1) });
      return;
    }
    if ((e.key === "p" || e.key === "P") && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      switchRowUnit(row.id, "pcs");
      toast.info("Switched to Pcs (1 pc)");
      return;
    }
    if ((e.key === "k" || e.key === "K") && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      switchRowUnit(row.id, "pkt");
      toast.info("Switched to Packet");
      return;
    }
    if ((e.key === "b" || e.key === "B") && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      switchRowUnit(row.id, "box");
      toast.info("Switched to Box");
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      focusCell(`rate-${row.id}`);
    }
  };

  const handleItemKey = (row: InvoiceRow, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (!showSuggest || !suggestions.length || activeRowId !== row.id)) {
      e.preventDefault();
      const typed = row.name.trim();
      if (!typed) {
        if (filledLines.length) promptCheckoutRef.current();
        return;
      }
      if (/^[0-9A-Za-z._-]{6,}$/.test(typed)) {
        void addProductFromScan(typed, { clearRowId: row.id, exactBarcodeOnly: true }).then(
          () => focusCell(`qty-${row.id}`)
        );
      } else {
        focusCell(`qty-${row.id}`);
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
        let multiplier = 1;
        let targetUnit: "pcs" | "pkt" | "box" = "pcs";
        const starMatch = row.name.match(/^(\d+)([pkb])?\s*\*\s*(.+)$/i);
        if (starMatch) {
          multiplier = parseInt(starMatch[1], 10) || 1;
          if (starMatch[2]) {
            const u = starMatch[2].toLowerCase();
            if (u === "p") targetUnit = "pcs";
            else if (u === "k") targetUnit = "pkt";
            else if (u === "b") targetUnit = "box";
          }
        }
        applyProduct(row.id, pick, targetUnit, multiplier);
        requestAnimationFrame(() => focusCell(`qty-${row.id}`));
      }
    } else if (e.key === "Escape") {
      setShowSuggest(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-700 bg-white shadow-sm lg:min-h-[calc(100vh-8rem)]">
      <header className="flex flex-wrap items-center justify-between gap-2 bg-[#1a365d] px-4 py-2.5 text-white">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-wide">Sales Invoice</h1>
            <p className="text-[11px] text-slate-300">
              F2 Scan · F3 Details · F4 New · Alt+P/K/B Unit · +/- Qty · F6 Hold · F8 Pay · F9 Pay &amp; Print
            </p>
          </div>
          <OfflineStatusBanner compact />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowProductLookup(true)}
            className="border-amber-400 bg-amber-400/20 text-amber-200 hover:bg-amber-400/30 hover:text-white font-semibold text-xs gap-1"
          >
            <Tag className="h-3.5 w-3.5 text-amber-300" />
            Check Details (F3)
          </Button>
          <div className="flex items-center gap-1.5 rounded bg-slate-800/90 px-2 py-1 border border-slate-600">
            <span className="text-[11px] font-medium text-slate-300">Roll:</span>
            <select
              value={printWidth}
              onChange={(e) => {
                const next = e.target.value as ReceiptWidth;
                setPrintWidth(next);
                setLocalReceiptWidth(next);
              }}
              className="h-6 rounded border border-slate-500 bg-slate-900 px-1.5 text-xs font-semibold text-white focus:border-amber-400 focus:outline-none"
              aria-label="Thermal roll paper width"
            >
              {RECEIPT_WIDTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.shortLabel}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-300">Invoice No.</p>
            <div className="flex items-center gap-1.5">
              <p className="font-mono font-semibold">{lastSale?.bill_number ?? "Auto"}</p>
              {lastSale && (
                <button
                  type="button"
                  title="WhatsApp Bill to Customer"
                  onClick={() =>
                    openWhatsAppShare(
                      posBillWhatsAppMessage({
                        billNumber: lastSale.bill_number,
                        totalAmount: lastSale.total_amount,
                        customerName: lastSale.customer_name,
                        paymentMethod: lastSale.payment_method,
                        itemsCount: lastSale.pos_sale_items?.length,
                        discount: lastSale.discount,
                      }),
                      lastSale.customer_mobile ?? undefined
                    )
                  }
                  className="rounded p-1 text-green-300 hover:bg-green-800/50 hover:text-white transition"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
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
                const code = scanCode.trim() || e.currentTarget.value.trim();
                if (code) {
                  setScanCode("");
                  void addProductFromScan(code, { keepScanFocus: true });
                  return;
                }
                if (filledLines.length) promptCheckoutRef.current();
              }}
              placeholder="Scan barcode or type & Enter (Enter on empty to save bill)"
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
      {selectedCustomer ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
          <div>
            Linked: <strong>{selectedCustomer.name}</strong> · Points {selectedCustomer.loyalty_points}
            {selectedCustomer.credit_balance > 0
              ? ` · Credit due ${formatPrice(selectedCustomer.credit_balance)}`
              : ""}
          </div>
          <div className="flex items-center gap-2">
            {selectedCustomer.user_id ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                🟢 Online Store Member
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowOnlineAccountModal(true)}
                className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-300 hover:bg-emerald-50"
              >
                <Globe className="h-3 w-3" />
                + Create Online Account
              </button>
            )}
          </div>
        </div>
      ) : customerMobile.trim().length === 10 ? (
        <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-1 text-xs text-slate-600">
          <span>Party mobile entered</span>
          <button
            type="button"
            onClick={() => setShowOnlineAccountModal(true)}
            className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-300 hover:bg-emerald-50"
          >
            <Globe className="h-3 w-3" />
            + Create Online Account
          </button>
        </div>
      ) : null}

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
                    type="text"
                    inputMode="numeric"
                    value={row.quantity}
                    onFocus={() => setActiveRowId(row.id)}
                    onChange={(e) => handleRowQtyInput(row.id, e.target.value)}
                    onKeyDown={(e) => handleRowQtyKeyDown(row, e)}
                    className={cellClass("text-right font-semibold")}
                    title="Qty (type 5, or 12p / 2k / 1b). Keys: +/- or Up/Down, P/K/B"
                  />
                </td>
                <td className="px-1 py-0.5">
                  {row.productId ? (
                    <select
                      value={row.unit || "pcs"}
                      onChange={(e) => switchRowUnit(row.id, e.target.value as any)}
                      onFocus={() => setActiveRowId(row.id)}
                      className="h-7 w-full rounded border border-slate-300 bg-white px-1 text-xs font-semibold text-slate-700 focus:border-amber-500 focus:outline-none"
                    >
                      <option value="pcs">Pcs (1 pc)</option>
                      <option value="pkt">Pkt ({row.piecesPerPacket || 12} pcs)</option>
                      <option value="box">Box ({(row.piecesPerPacket || 12) * (row.packetsPerBox || 12)} pcs)</option>
                    </select>
                  ) : (
                    <span className="text-xs text-slate-400">{row.unit || "pcs"}</span>
                  )}
                  {row.unit && row.unit !== "pcs" && (
                    <div className="text-[10px] text-amber-700 font-medium whitespace-nowrap">
                      ={row.quantity * (row.packMultiplier || 1)} pcs
                    </div>
                  )}
                </td>
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
                        if (filledLines.length) {
                          promptCheckoutRef.current();
                          return;
                        }
                        const next = rows[idx + 1];
                        if (next) itemInputRefs.current[next.id]?.focus();
                      }
                    }}
                    className={cellClass("text-right font-medium")}
                  />
                </td>
                <td className="px-0 py-0.5">
                  <input
                    id={`disc-${row.id}`}
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (filledLines.length) promptCheckoutRef.current();
                      }
                    }}
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
              onClick={() => promptCheckout()}
              disabled={processing || !filledLines.length}
              className="bg-[#1a365d] hover:bg-[#153054]"
            >
              Save Invoice
              <span className="ml-1 text-[10px] opacity-70">F8</span>
            </Button>
            <Button
              onClick={() => promptCheckout()}
              disabled={processing || !filledLines.length}
              className={
                saveBillHighlight || checkoutStep === "save"
                  ? "scale-105 bg-green-600 text-white ring-4 ring-amber-400 ring-offset-2"
                  : undefined
              }
            >
              <Printer className="mr-1 h-4 w-4" />
              Save Bill
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
            <span className="tabular-nums">{grossSubtotal.toFixed(2)}</span>
          </div>
          {totalItemDiscount > 0 && (
            <div className="flex justify-between py-0.5 text-xs font-medium text-emerald-700">
              <span>Item Discounts</span>
              <span className="tabular-nums">- {formatPrice(totalItemDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between py-0.5 text-slate-500">
            <span>GST (incl.)</span>
            <span className="tabular-nums">{gstTotal.toFixed(2)}</span>
          </div>
          {loyaltyEnabled && selectedCustomer && selectedCustomer.loyalty_points > 0 && (
            <div className="my-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2 text-xs">
              <div className="flex items-center justify-between text-amber-900 font-medium">
                <span>Loyalty Points ({selectedCustomer.loyalty_points} pts)</span>
                <span className="font-bold">{formatPrice(selectedCustomer.loyalty_points * pointValue)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const maxPoints = Math.min(
                      selectedCustomer.loyalty_points,
                      Math.floor((grossSubtotal - totalItemDiscount - discount) / pointValue)
                    );
                    setLoyaltyRedeem(loyaltyRedeem > 0 ? 0 : Math.max(0, maxPoints));
                  }}
                  className={`rounded px-2 py-1 text-[11px] font-semibold transition ${
                    loyaltyRedeem > 0
                      ? "bg-amber-600 text-white"
                      : "bg-white text-amber-800 border border-amber-300 hover:bg-amber-100"
                  }`}
                >
                  {loyaltyRedeem > 0 ? "Remove Points" : "Use Points"}
                </button>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500 text-[11px]">Pts:</span>
                  <input
                    type="number"
                    min={0}
                    max={selectedCustomer.loyalty_points}
                    value={loyaltyRedeem || ""}
                    onChange={(e) => {
                      const val = Math.min(
                        selectedCustomer.loyalty_points,
                        Math.max(0, Number(e.target.value) || 0)
                      );
                      setLoyaltyRedeem(val);
                    }}
                    placeholder="0"
                    className="h-6 w-16 rounded border border-amber-300 bg-white px-1 text-right text-xs font-bold text-amber-900 focus:outline-none"
                  />
                </div>
              </div>
              {loyaltyDiscountAmount > 0 && (
                <p className="mt-1 text-right text-[11px] font-semibold text-emerald-700">
                  Discount: -{formatPrice(loyaltyDiscountAmount)}
                </p>
              )}
            </div>
          )}
          <label className="mt-2 flex items-center justify-between gap-2">
            <span className="text-slate-600 font-medium">Bill discount</span>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={discount || ""}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              className="h-8 w-28 rounded border border-slate-300 px-2 text-right text-sm font-semibold text-green-700 focus:border-amber-400 focus:outline-none"
            />
          </label>
          {totalAllDiscounts > 0 && (
            <div className="flex justify-between py-0.5 text-xs font-semibold text-green-600">
              <span>Total Savings</span>
              <span className="tabular-nums">- {formatPrice(totalAllDiscounts)}</span>
            </div>
          )}
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
      {checkoutStep === "payment" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-labelledby="pos-pay-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
          >
            <h2 id="pos-pay-title" className="text-lg font-bold text-slate-900">
              Make payment
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Total <span className="font-semibold text-slate-900">{formatPrice(total)}</span>
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {CHECKOUT_PAY_OPTIONS.map((opt, i) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => confirmPayment(i)}
                  className={`rounded-lg px-3 py-6 text-center text-sm font-semibold ${
                    i === payOptionIndex
                      ? "bg-[#1a365d] text-white ring-4 ring-amber-400"
                      : "border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {opt.label}
                  <span className="mt-1 block text-xs font-normal opacity-80">
                    {opt.key}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Arrow keys to change · Enter to confirm · Esc to cancel
            </p>
          </div>
        </div>
      )}

      <PosCreateOnlineAccountModal
        open={showOnlineAccountModal}
        onClose={() => setShowOnlineAccountModal(false)}
        customer={selectedCustomer}
        draftName={customerName}
        draftMobile={customerMobile}
        onAccountCreated={(updated) => {
          setSelectedCustomer(updated);
          setCustomerName(updated.name);
          setCustomerMobile(updated.mobile);
        }}
      />

      <ProductDetailsLookupModal
        open={showProductLookup}
        onClose={() => setShowProductLookup(false)}
        onAddToCart={(p) => {
          const emptyTarget = rows.find((r) => !r.productId)?.id;
          if (emptyTarget) {
            applyProduct(emptyTarget, p);
          } else {
            const nextR = newRow();
            setRows((prev) => [...prev, nextR]);
            applyProduct(nextR.id, p);
          }
        }}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  Minus,
  Trash2,
  Pause,
  Play,
  MessageCircle,
  ShoppingCart,
  Search,
  Printer,
  Tag,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/components/erp/barcode-scanner";
import { ReceiptActions } from "@/components/erp/receipt-actions";
import { printReceipt } from "@/components/erp/receipt-print";
import { ProductDetailsLookupModal } from "@/components/erp/product-details-lookup-modal";
import { PosCreateOnlineAccountModal } from "@/components/erp/pos-create-online-account-modal";
import { OfflineStatusBanner } from "@/components/erp/offline-status-banner";
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
  getAutoPrintPreference,
  RECEIPT_WIDTH_OPTIONS,
  type ReceiptWidth,
} from "@/utils/printer-prefs";
import { openWhatsAppShare, invoiceShareMessage, posBillWhatsAppMessage } from "@/utils/whatsapp";

function cartLineKey(line: PosCartLine) {
  return `${line.productId}-${line.lotId ?? "default"}`;
}

function focusField(id: string, delay = 40) {
  setTimeout(() => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLButtonElement | null;
    if (el) {
      el.focus();
      if ("select" in el && typeof el.select === "function") {
        el.select();
      }
    }
  }, delay);
}

export function PosQuickBilling() {
  const { settings } = useStoreSettings();
  const { profile } = useAuth();
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [heldBills, setHeldBills] = useState<PosSale[]>([]);
  const [lastSale, setLastSale] = useState<PosSale | null>(null);
  const [lastSaleCreditBalance, setLastSaleCreditBalance] = useState<number | null>(
    null
  );
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerLookupLoading, setCustomerLookupLoading] = useState(false);
  const [showOnlineAccountModal, setShowOnlineAccountModal] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [loyaltyRedeem, setLoyaltyRedeem] = useState(0);
  const [billNotes, setBillNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [printWidth, setPrintWidth] = useState<ReceiptWidth>("80mm");
  const [showScanner, setShowScanner] = useState(false);
  const [showProductLookup, setShowProductLookup] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ErpProduct[]>([]);
  const [searchSelectIndex, setSearchSelectIndex] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [splitPayment, setSplitPayment] = useState(false);
  const [splitCash, setSplitCash] = useState(0);
  const [splitUpi, setSplitUpi] = useState(0);
  const [splitCard, setSplitCard] = useState(0);
  const completeSaleRef = useRef<(autoPrint?: boolean) => Promise<void>>(async () => {});
  const holdBillRef = useRef<() => Promise<void>>(async () => {});
  const autoPrintSaleIdRef = useRef<string | null>(null);
  const activeLineIndexRef = useRef<number>(-1);

  const loadHeld = useCallback(() => {
    posService.getHeldBills().then(setHeldBills);
  }, []);

  useEffect(() => {
    loadHeld();
    settingsService.get().then((s) => setPrintWidth(resolveReceiptWidth(s.receipt_width)));

    const onPrinterChange = () => {
      settingsService.get().then((s) => setPrintWidth(resolveReceiptWidth(s.receipt_width)));
    };
    window.addEventListener("ogs-printer-settings-changed", onPrinterChange);
    return () => window.removeEventListener("ogs-printer-settings-changed", onPrinterChange);
  }, [loadHeld]);

  // Autofocus search on initial mount
  useEffect(() => {
    focusField("pos-quick-search", 150);
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Unit shortcuts: Alt+P (Pcs), Alt+K (Pkt), Alt+B (Box), Alt+U (Cycle), Alt+Q (Focus Qty)
      if (cart.length > 0) {
        const activeIdx =
          activeLineIndexRef.current >= 0 && activeLineIndexRef.current < cart.length
            ? activeLineIndexRef.current
            : cart.length - 1;
        const targetLine = cart[activeIdx];
        const lineKey = cartLineKey(targetLine);

        if (e.altKey && (e.key === "p" || e.key === "P" || e.key === "1")) {
          e.preventDefault();
          setLineUnit(lineKey, "pcs");
          toast.info(`Switched to Pcs (1 pc): ${targetLine.name}`);
          return;
        }
        if (e.altKey && (e.key === "k" || e.key === "K" || e.key === "2")) {
          e.preventDefault();
          setLineUnit(lineKey, "pkt");
          toast.info(`Switched to Packet (${targetLine.piecesPerPacket || 12} pcs): ${targetLine.name}`);
          return;
        }
        if (e.altKey && (e.key === "b" || e.key === "B" || e.key === "3")) {
          e.preventDefault();
          setLineUnit(lineKey, "box");
          toast.info(
            `Switched to Box (${(targetLine.piecesPerPacket || 12) * (targetLine.packetsPerBox || 12)} pcs): ${targetLine.name}`
          );
          return;
        }
        if (e.altKey && (e.key === "u" || e.key === "U")) {
          e.preventDefault();
          cycleLineUnit(lineKey);
          return;
        }
        if (e.altKey && (e.key === "q" || e.key === "Q")) {
          e.preventDefault();
          focusField(`quick-qty-${activeIdx}`);
          return;
        }
      }

      if (e.key === "F2") {
        e.preventDefault();
        focusField("pos-quick-search");
      }
      if (e.key === "F3") {
        e.preventDefault();
        setShowProductLookup((prev) => !prev);
      }
      if (e.key === "F4") {
        e.preventDefault();
        setCart([]);
        clearCustomer();
        setDiscount(0);
        setLoyaltyRedeem(0);
        toast.message("New sale — cart cleared");
        focusField("pos-quick-search", 60);
      }
      if (e.key === "Enter" && cart.length && !typing) {
        e.preventDefault();
        void completeSaleRef.current(false);
      }
      if (e.key === "F6" && cart.length) {
        e.preventDefault();
        void holdBillRef.current();
      }
      if (e.key === "F8" && cart.length) {
        e.preventDefault();
        void completeSaleRef.current(false);
      }
      if (e.key === "F9" && cart.length) {
        e.preventDefault();
        void completeSaleRef.current(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart]);

  useEffect(() => {
    let query = productSearch.trim();
    if (!query) {
      setSearchResults([]);
      setSearchSelectIndex(0);
      return;
    }
    const starMatch = query.match(/^(\d+)([pkb])?\s*\*\s*(.+)$/i);
    if (starMatch) {
      query = starMatch[3].trim();
    }
    if (!query) {
      setSearchResults([]);
      setSearchSelectIndex(0);
      return;
    }
    const t = setTimeout(() => {
      setSearchLoading(true);
      inventoryService
        .listProducts({ search: query })
        .then((res) => {
          setSearchResults(res);
          setSearchSelectIndex(0);
        })
        .finally(() => setSearchLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [productSearch]);

  const setLineQty = (key: string, nextQty: number) => {
    setCart((prev) =>
      prev.map((l) =>
        cartLineKey(l) === key
          ? { ...l, quantity: Math.max(1, nextQty) }
          : l
      )
    );
  };

  const setLineUnit = (key: string, nextUnit: "pcs" | "pkt" | "box") => {
    setCart((prev) =>
      prev.map((l) => {
        if (cartLineKey(l) !== key) return l;
        const piecesPerPkt = l.piecesPerPacket || 12;
        const pktsPerBox = l.packetsPerBox || 12;
        const totalPcsInBox = piecesPerPkt * pktsPerBox;
        const baseRate = Number((l as any).baseRate ?? l.rate);

        let packMultiplier = 1;
        let rate = baseRate;

        if (nextUnit === "pkt") {
          packMultiplier = piecesPerPkt;
          rate = Number(l.packetSellingPrice) || (baseRate * piecesPerPkt);
        } else if (nextUnit === "box") {
          packMultiplier = totalPcsInBox;
          rate = Number(l.boxSellingPrice) || (baseRate * totalPcsInBox);
        }

        return {
          ...l,
          unit: nextUnit,
          packMultiplier,
          rate: Math.round(rate * 100) / 100,
        };
      })
    );
  };

  const cycleLineUnit = (key: string) => {
    setCart((prev) => {
      const target = prev.find((l) => cartLineKey(l) === key);
      if (!target) return prev;
      const current = target.unit || "pcs";
      const next: "pcs" | "pkt" | "box" =
        current === "pcs" ? "pkt" : current === "pkt" ? "box" : "pcs";

      const piecesPerPkt = target.piecesPerPacket || 12;
      const pktsPerBox = target.packetsPerBox || 12;
      const totalPcsInBox = piecesPerPkt * pktsPerBox;
      const baseRate = Number((target as any).baseRate ?? target.rate);

      let packMultiplier = 1;
      let rate = baseRate;

      if (next === "pkt") {
        packMultiplier = piecesPerPkt;
        rate = Number(target.packetSellingPrice) || (baseRate * piecesPerPkt);
      } else if (next === "box") {
        packMultiplier = totalPcsInBox;
        rate = Number(target.boxSellingPrice) || (baseRate * totalPcsInBox);
      }

      toast.info(`Unit set to ${next.toUpperCase()} for ${target.name}`);
      return prev.map((l) =>
        cartLineKey(l) === key
          ? { ...l, unit: next, packMultiplier, rate: Math.round(rate * 100) / 100 }
          : l
      );
    });
  };

  const handleQtyInput = (key: string, val: string) => {
    const trimmed = val.trim().toLowerCase();
    const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
    if (match) {
      const num = parseFloat(match[1]) || 1;
      const unitPart = match[2];
      if (unitPart) {
        if (unitPart.startsWith("p")) {
          setLineUnit(key, "pcs");
        } else if (unitPart.startsWith("k")) {
          setLineUnit(key, "pkt");
        } else if (unitPart.startsWith("b")) {
          setLineUnit(key, "box");
        }
        setLineQty(key, num);
      } else {
        // Automatically calculate box or packets based on quantity entered in pieces
        setCart((prev) =>
          prev.map((l) => {
            if (cartLineKey(l) !== key) return l;
            const piecesPerPkt = l.piecesPerPacket || 12;
            const pktsPerBox = l.packetsPerBox || 12;
            const totalPcsInBox = piecesPerPkt * pktsPerBox;
            const baseRate = Number((l as any).baseRate ?? l.rate);

            // If line is already set to packet or box unit, treat number as pack count
            if (l.unit === "pkt") {
              return { ...l, quantity: Math.max(1, num) };
            }
            if (l.unit === "box") {
              return { ...l, quantity: Math.max(1, num) };
            }

            // In pcs mode: auto-calculate boxes or packets
            if (num >= totalPcsInBox && num % totalPcsInBox === 0) {
              const boxes = num / totalPcsInBox;
              const rate = Number(l.boxSellingPrice) || (baseRate * totalPcsInBox);
              toast.info(`Auto-calculated: ${num} pcs = ${boxes} Box`);
              return {
                ...l,
                unit: "box",
                packMultiplier: totalPcsInBox,
                rate: Math.round(rate * 100) / 100,
                quantity: boxes,
              };
            }
            if (num >= piecesPerPkt && num % piecesPerPkt === 0) {
              const pkts = num / piecesPerPkt;
              const rate = Number(l.packetSellingPrice) || (baseRate * piecesPerPkt);
              toast.info(`Auto-calculated: ${num} pcs = ${pkts} Packet`);
              return {
                ...l,
                unit: "pkt",
                packMultiplier: piecesPerPkt,
                rate: Math.round(rate * 100) / 100,
                quantity: pkts,
              };
            }

            return { ...l, quantity: Math.max(1, num) };
          })
        );
      }
    } else {
      const num = parseFloat(val) || 1;
      setLineQty(key, num);
    }
  };

  const setLineRate = (key: string, nextRate: number) => {
    setCart((prev) =>
      prev.map((l) =>
        cartLineKey(l) === key
          ? { ...l, rate: Math.max(0, Math.round(nextRate * 100) / 100) }
          : l
      )
    );
  };

  const updateLineDiscount = (key: string, nextPercent: number) => {
    setCart((prev) =>
      prev.map((l) =>
        cartLineKey(l) === key
          ? {
              ...l,
              discountPercent: Math.max(0, Math.min(100, nextPercent)),
            }
          : l
      )
    );
  };

  const updateLineAmount = (key: string, targetAmount: number) => {
    setCart((prev) =>
      prev.map((l) => {
        if (cartLineKey(l) !== key) return l;
        const amt = Math.max(0, Math.round(targetAmount * 100) / 100);
        const qty = Math.max(1, l.quantity);
        const gross = l.rate * qty;
        if (gross > 0 && amt <= gross) {
          const discAmount = gross - amt;
          const discPercent = Math.round((discAmount / gross) * 100 * 100) / 100;
          return { ...l, discountPercent: discPercent };
        } else {
          const newRate = Math.round((amt / qty) * 100) / 100;
          return { ...l, rate: newRate, discountPercent: 0 };
        }
      })
    );
  };

  const addLineToCart = useCallback(
    (
      product: ErpProduct,
      lot?: { id: string; barcode: string; current_stock: number; selling_price: number | null } | null,
      initialUnit: "pcs" | "pkt" | "box" = "pcs",
      initialQty = 1
    ) => {
      const stock = lot ? lot.current_stock : product.stock;
      if (stock <= 0) {
        toast.error(`${product.name} is out of stock`);
        return;
      }

      const piecesPerPkt = Number(product.pieces_per_packet) || 12;
      const pktsPerBox = Number(product.packets_per_box) || 12;
      const totalPcsInBox = piecesPerPkt * pktsPerBox;

      const baseRate = Number(
        lot?.selling_price ?? product.selling_price ?? product.price
      );

      let unit: "pcs" | "pkt" | "box" = initialUnit;
      let packMultiplier = 1;
      let rate = baseRate;

      // Auto-calculate packet or box from initial piece quantity
      if (initialUnit === "pcs") {
        if (initialQty >= totalPcsInBox && initialQty % totalPcsInBox === 0) {
          unit = "box";
          packMultiplier = totalPcsInBox;
          rate = Number(product.box_selling_price) || (baseRate * totalPcsInBox);
          initialQty = initialQty / totalPcsInBox;
          toast.info(`Auto-calculated: ${initialQty} Box`);
        } else if (initialQty >= piecesPerPkt && initialQty % piecesPerPkt === 0) {
          unit = "pkt";
          packMultiplier = piecesPerPkt;
          rate = Number(product.packet_selling_price) || (baseRate * piecesPerPkt);
          initialQty = initialQty / piecesPerPkt;
          toast.info(`Auto-calculated: ${initialQty} Packet`);
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
      const discountPercent = Number(product.discount_percent ?? 0);
      const key = `${product.id}-${lotId ?? "default"}`;

      setCart((prev) => {
        const existingIdx = prev.findIndex((l) => cartLineKey(l) === key);
        const targetIdx = existingIdx >= 0 ? existingIdx : prev.length;
        activeLineIndexRef.current = targetIdx;
        focusField(`quick-qty-${targetIdx}`, 60);

        if (existingIdx >= 0) {
          const existing = prev[existingIdx];
          const totalExistingPieces = existing.quantity * (existing.packMultiplier || 1);
          const newTotalPieces = totalExistingPieces + (initialQty * packMultiplier);
          if (newTotalPieces > stock) {
            toast.error("Not enough stock available");
            return prev;
          }

          // If current line is in loose pcs, check if repeated scanning reaches packet or box
          if ((existing.unit || "pcs") === "pcs") {
            if (newTotalPieces >= totalPcsInBox && newTotalPieces % totalPcsInBox === 0) {
              const boxes = newTotalPieces / totalPcsInBox;
              const boxRate = Number(existing.boxSellingPrice) || (baseRate * totalPcsInBox);
              toast.info(`Auto-calculated: ${newTotalPieces} pcs = ${boxes} Box`);
              return prev.map((l, i) =>
                i === existingIdx
                  ? {
                      ...l,
                      unit: "box",
                      packMultiplier: totalPcsInBox,
                      rate: Math.round(boxRate * 100) / 100,
                      quantity: boxes,
                    }
                  : l
              );
            }
            if (newTotalPieces >= piecesPerPkt && newTotalPieces % piecesPerPkt === 0) {
              const pkts = newTotalPieces / piecesPerPkt;
              const pktRate = Number(existing.packetSellingPrice) || (baseRate * piecesPerPkt);
              toast.info(`Auto-calculated: ${newTotalPieces} pcs = ${pkts} Packet`);
              return prev.map((l, i) =>
                i === existingIdx
                  ? {
                      ...l,
                      unit: "pkt",
                      packMultiplier: piecesPerPkt,
                      rate: Math.round(pktRate * 100) / 100,
                      quantity: pkts,
                    }
                  : l
              );
            }
          }

          return prev.map((l, i) =>
            i === existingIdx ? { ...l, quantity: l.quantity + initialQty } : l
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            lotId,
            name: product.name,
            barcode,
            rate,
            unit,
            packMultiplier,
            piecesPerPacket: piecesPerPkt,
            packetsPerBox: pktsPerBox,
            packetSellingPrice: product.packet_selling_price ?? null,
            boxSellingPrice: product.box_selling_price ?? null,
            baseRate,
            discountPercent,
            gstPercentage: Number(product.gst_percentage ?? 0),
            quantity: initialQty,
          } as PosCartLine & { baseRate?: number },
        ];
      });
      const unitLabel = unit === "pcs" ? "" : ` [${unit.toUpperCase()}]`;
      toast.success(`Added: ${product.name}${unitLabel}`, { id: "pos-scan-added" });
      setShowProductPicker(false);
      setProductSearch("");
      setSearchResults([]);
    },
    []
  );

  const addProductToCart = useCallback(
    async (rawBarcode: string) => {
      let barcode = rawBarcode.trim();
      let multiplier = 1;
      let targetUnit: "pcs" | "pkt" | "box" | undefined = undefined;

      const starMatch = barcode.match(/^(\d+)([pkb])?\s*\*\s*(.+)$/i);
      if (starMatch) {
        multiplier = parseInt(starMatch[1], 10) || 1;
        if (starMatch[2]) {
          const u = starMatch[2].toLowerCase();
          if (u === "p") targetUnit = "pcs";
          else if (u === "k") targetUnit = "pkt";
          else if (u === "b") targetUnit = "box";
        }
        barcode = starMatch[3].trim();
      }

      const resolved = await inventoryService.resolveByBarcode(barcode);
      if (resolved) {
        addLineToCart(
          resolved.product,
          resolved.lot
            ? {
                id: resolved.lot.id,
                barcode: resolved.lot.barcode,
                current_stock: resolved.lot.current_stock,
                selling_price: resolved.lot.selling_price,
              }
            : null,
          targetUnit || (resolved as any).unit || "pcs",
          multiplier
        );
        return;
      }
      const products = await inventoryService.listProducts({ search: barcode });
      if (products[0]) {
        addLineToCart(products[0], null, targetUnit || "pcs", multiplier);
        return;
      }
      toast.error("Product not found");
    },
    [addLineToCart]
  );

  const handleQtyKeyDown = (
    idx: number,
    key: string,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    activeLineIndexRef.current = idx;

    if (e.key === "ArrowUp" || e.key === "+") {
      e.preventDefault();
      updateQty(key, 1);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "-") {
      e.preventDefault();
      updateQty(key, -1);
      return;
    }
    if ((e.key === "p" || e.key === "P") && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setLineUnit(key, "pcs");
      toast.info("Switched to Pcs (1 pc)");
      return;
    }
    if ((e.key === "k" || e.key === "K") && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setLineUnit(key, "pkt");
      toast.info("Switched to Packet (Pkt)");
      return;
    }
    if ((e.key === "b" || e.key === "B") && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setLineUnit(key, "box");
      toast.info("Switched to Box");
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        if (idx > 0) {
          focusField(`quick-amt-${idx - 1}`);
        } else {
          focusField("pos-quick-search");
        }
        return;
      }
      const val = (e.currentTarget.value || "").trim();
      if (/^[0-9A-Za-z._-]{6,}$/.test(val)) {
        setLineQty(key, 1);
        void addProductToCart(val);
        return;
      }
      focusField(`quick-rate-${idx}`);
    }
  };

  const handleRateKeyDown = (
    idx: number,
    key: string,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        focusField(`quick-qty-${idx}`);
        return;
      }
      const val = (e.currentTarget.value || "").trim();
      if (/^[0-9A-Za-z._-]{6,}$/.test(val)) {
        void addProductToCart(val);
        return;
      }
      focusField(`quick-disc-${idx}`);
    }
  };

  const handleDiscKeyDown = (
    idx: number,
    key: string,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        focusField(`quick-rate-${idx}`);
        return;
      }
      focusField(`quick-amt-${idx}`);
    }
  };

  const handleAmtKeyDown = (
    idx: number,
    key: string,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        focusField(`quick-disc-${idx}`);
        return;
      }
      if (idx + 1 < cart.length) {
        focusField(`quick-qty-${idx + 1}`);
      } else {
        focusField("pos-quick-search");
      }
    }
  };

  const handleSearchKeyDown = async (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSearchSelectIndex((i) => Math.min(searchResults.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSearchSelectIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setSearchResults([]);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const query = productSearch.trim();
      if (!query) {
        if (cart.length > 0) {
          focusField("quick-cust-mobile");
        } else {
          toast.message("Scan or type an item to start billing");
        }
        return;
      }

      if (searchResults.length > 0 && searchResults[searchSelectIndex]) {
        let multiplier = 1;
        let targetUnit: "pcs" | "pkt" | "box" = "pcs";
        const starMatch = query.match(/^(\d+)([pkb])?\s*\*\s*(.+)$/i);
        if (starMatch) {
          multiplier = parseInt(starMatch[1], 10) || 1;
          if (starMatch[2]) {
            const u = starMatch[2].toLowerCase();
            if (u === "p") targetUnit = "pcs";
            else if (u === "k") targetUnit = "pkt";
            else if (u === "b") targetUnit = "box";
          }
        }
        addLineToCart(searchResults[searchSelectIndex], null, targetUnit, multiplier);
        return;
      }

      await addProductToCart(query);
    }
  };

  const grossSubtotal = cart.reduce((s, l) => s + l.rate * l.quantity, 0);
  const itemDiscounts = cart.reduce((s, l) => {
    const discPercent = l.discountPercent ?? 0;
    const unitDiscount = Math.round(l.rate * (discPercent / 100) * 100) / 100;
    return s + unitDiscount * l.quantity;
  }, 0);
  const netItemsSubtotal = grossSubtotal - itemDiscounts;
  const computedBillDiscount =
    discountMode === "percent"
      ? Math.round((netItemsSubtotal * discountPercent) / 100)
      : discount;
  const totalDiscount = itemDiscounts + computedBillDiscount;
  const loyaltyEnabled = settings?.enable_loyalty_points !== false;
  const pointValue = Number(settings?.loyalty_point_value ?? 1.0);
  const loyaltyPointsRate = Number(settings?.loyalty_points_per_100 ?? 1.0);
  const loyaltyDiscountAmount = loyaltyEnabled ? Math.round(loyaltyRedeem * pointValue * 100) / 100 : 0;
  const total = Math.max(0, grossSubtotal - totalDiscount - loyaltyDiscountAmount);
  const pointsToEarn =
    selectedCustomer && total > 0 && loyaltyEnabled
      ? Math.floor(total / 100) * loyaltyPointsRate
      : 0;

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerMobile("");
    setCustomerName("");
    setLoyaltyRedeem(0);
  };

  const lookupCustomer = useCallback(async () => {
    const mobile = customerMobile.trim();
    const name = customerName.trim();
    if (!mobile && !name) {
      setSelectedCustomer(null);
      return;
    }
    if (mobile && !isValidMobile(mobile)) {
      toast.error("Enter a valid 10-digit mobile number");
      setSelectedCustomer(null);
      return;
    }
    setCustomerLookupLoading(true);
    try {
      const found = await customerService.findForPos({ mobile, name });
      if (found) {
        setSelectedCustomer(found);
        setCustomerName(found.name);
        setCustomerMobile(found.mobile);
        const creditMsg =
          found.credit_balance > 0
            ? ` · Credit due ${formatPrice(found.credit_balance)}`
            : "";
        toast.success(
          `Customer linked — ${found.loyalty_points} points${creditMsg}`
        );
      } else if (mobile && isValidMobile(mobile)) {
        setSelectedCustomer(null);
        toast.message("New customer — will be saved when you complete the bill");
      } else {
        setSelectedCustomer(null);
        toast.error("No matching customer found");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Customer lookup failed");
    } finally {
      setCustomerLookupLoading(false);
    }
  }, [customerMobile, customerName]);

  const saleCustomerParams = () => ({
    customerId: selectedCustomer?.id,
    customerName: customerName.trim() || undefined,
    customerMobile: customerMobile.trim() || undefined,
  });

  const updateQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) =>
          cartLineKey(l) === key
            ? { ...l, quantity: Math.max(1, l.quantity + delta) }
            : l
        )
        .filter((l) => l.quantity > 0)
    );
  };

  const completeSale = async (autoPrint = false) => {
    if (!cart.length) {
      toast.error("Cart is empty");
      return;
    }
    if (loyaltyRedeem > 0 && !customerMobile.trim()) {
      toast.error("Enter customer mobile to redeem loyalty points");
      return;
    }
    if (paymentMethod === "credit" && !customerMobile.trim()) {
      toast.error("Enter customer mobile for credit sale");
      return;
    }
    if (
      loyaltyRedeem > 0 &&
      selectedCustomer &&
      loyaltyRedeem > selectedCustomer.loyalty_points
    ) {
      toast.error(`Only ${selectedCustomer.loyalty_points} points available`);
      return;
    }

    if (splitPayment) {
      const splitTotal = splitCash + splitUpi + splitCard;
      if (Math.abs(splitTotal - total) > 0.01) {
        toast.error(`Split total ${formatPrice(splitTotal)} must equal ${formatPrice(total)}`);
        return;
      }
    }

    setProcessing(true);
    try {
      const splits = splitPayment
        ? ([
            splitCash > 0 ? { method: "cash" as const, amount: splitCash } : null,
            splitUpi > 0 ? { method: "upi" as const, amount: splitUpi } : null,
            splitCard > 0 ? { method: "card" as const, amount: splitCard } : null,
          ].filter(Boolean) as { method: PosPaymentMethod; amount: number }[])
        : undefined;

      const sale = await posService.createSale({
        lines: cart,
        paymentMethod: splits?.[0]?.method ?? paymentMethod,
        splitPayments: splits,
        ...saleCustomerParams(),
        discount: computedBillDiscount,
        loyaltyPointsRedeemed: loyaltyRedeem,
        notes: billNotes.trim() || undefined,
      });
      setLastSale(sale);
      if (autoPrint && getAutoPrintPreference()) autoPrintSaleIdRef.current = sale.id;
      setCart([]);
      setDiscount(0);
      setLoyaltyRedeem(0);
      setSplitCash(0);
      setSplitUpi(0);
      setSplitCard(0);
      const lastCustomerCredit =
        sale.customer_id && sale.payment_method === "credit"
          ? (await customerService.getByMobile(sale.customer_mobile ?? ""))
              ?.credit_balance
          : undefined;
      if (lastCustomerCredit !== undefined) {
        setLastSaleCreditBalance(lastCustomerCredit);
      } else {
        setLastSaleCreditBalance(null);
      }
      clearCustomer();
      const earned =
        sale.customer_id && sale.sale_status === "completed"
          ? Math.floor(Number(sale.total_amount) / 100) * LOYALTY_POINTS_PER_100
          : 0;
      const custMobile = sale.customer_mobile;
      toast.success(
        earned > 0
          ? `Bill ${sale.bill_number} — +${earned} loyalty points`
          : `Bill ${sale.bill_number} completed`,
        {
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
                      itemsCount: sale.pos_sale_items?.length ?? 1,
                      discount: sale.discount,
                    }),
                    custMobile
                  ),
              }
            : undefined,
        }
      );
    } catch (e) {
      if (!navigator.onLine) {
        const { queueOfflinePosSale } = await import("@/lib/offline/pos-queue");
        queueOfflinePosSale({
          lines: cart,
          paymentMethod,
          customerName: customerName.trim() || undefined,
          customerMobile: customerMobile.trim() || undefined,
          discount: totalDiscount,
        });
        toast.message("Offline — sale queued for sync");
      } else {
        toast.error(e instanceof Error ? e.message : "Sale failed");
      }
    } finally {
      setProcessing(false);
    }
  };

  completeSaleRef.current = completeSale;

  useEffect(() => {
    if (!lastSale || lastSale.id !== autoPrintSaleIdRef.current) return;

    autoPrintSaleIdRef.current = null;
    const timer = window.setTimeout(() => {
      const printed = printReceipt("pos-thermal-receipt", printWidth);
      if (!printed) {
        toast.error("Could not print — use Print on Last Bill below");
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [lastSale, printWidth]);

  const holdBill = async () => {
    if (!cart.length) return;
    setProcessing(true);
    try {
      await posService.holdBill({
        lines: cart,
        ...saleCustomerParams(),
        customerName: customerName || "Held Bill",
        notes: "Held at counter",
      });
      setCart([]);
      toast.success("Bill held");
      loadHeld();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to hold");
    } finally {
      setProcessing(false);
    }
  };

  holdBillRef.current = holdBill;

  const resumeHeld = async (saleId: string) => {
    try {
      const sale = await posService.getById(saleId);
      if (!sale?.pos_sale_items) return;
      setCart(
        sale.pos_sale_items.map((i) => ({
          productId: i.product_id,
          lotId: (i as { lot_id?: string }).lot_id ?? null,
          name: i.product_name,
          barcode: i.barcode,
          rate: Number(i.rate),
          gstPercentage: Number(i.gst_percentage),
          quantity: i.quantity,
        }))
      );
      await posService.resumeBill(saleId);
      loadHeld();
      toast.success("Bill resumed");
    } catch {
      toast.error("Could not resume bill");
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:min-h-[calc(100vh-4rem)] lg:flex-row">
      {/* Left: cart + scanner */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-white lg:max-w-[55%]">
        <div className="border-b p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-green-900 sm:text-xl">POS Billing</h1>
              <OfflineStatusBanner compact />
            </div>
            <p className="text-xs text-gray-500">
              F2 Search · F3 Details · F4 New · F6 Hold · F8 Pay · F9 Pay &amp; Print
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowProductLookup(true)}
                className="border-blue-300 bg-blue-50/80 text-blue-900 hover:bg-blue-100 font-semibold text-xs gap-1 shrink-0"
              >
                <Tag className="h-3.5 w-3.5 text-blue-600" />
                Check Details (F3)
              </Button>
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
                <Printer className="h-3.5 w-3.5 text-gray-500" />
                <select
                  value={printWidth}
                  onChange={(e) => {
                    const next = e.target.value as ReceiptWidth;
                    setPrintWidth(next);
                    setLocalReceiptWidth(next);
                  }}
                  className="bg-transparent text-xs font-medium text-gray-700 focus:outline-none"
                  aria-label="Thermal print size"
                >
                  {RECEIPT_WIDTH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.shortLabel}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => setShowProductPicker(true)}
                className="shrink-0"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Product
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowScanner((s) => !s)}
              >
                {showScanner ? "Hide" : "Scan"}
              </Button>
            </div>
          </div>

          {/* Always-visible Barcode & Product Search Bar */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              id="pos-quick-search"
              placeholder="Scan barcode or type name & hit Enter... (Enter on empty moves to Customer)"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="h-10 pl-9 pr-9 text-sm font-medium border-gray-300 bg-gray-50/60 focus:bg-white focus:border-green-600 focus:ring-1 focus:ring-green-600"
            />
            {productSearch && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  setProductSearch("");
                  setSearchResults([]);
                  focusField("pos-quick-search");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick billing keyboard shortcuts hint bar */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
            <span className="font-semibold text-slate-800">⚡ Shortcuts:</span>
            <span><kbd className="rounded bg-white px-1 py-0.5 font-mono text-[10px] shadow-sm border">Alt+P</kbd> Pcs</span>
            <span><kbd className="rounded bg-white px-1 py-0.5 font-mono text-[10px] shadow-sm border">Alt+K</kbd> Packet</span>
            <span><kbd className="rounded bg-white px-1 py-0.5 font-mono text-[10px] shadow-sm border">Alt+B</kbd> Box</span>
            <span><kbd className="rounded bg-white px-1 py-0.5 font-mono text-[10px] shadow-sm border">Alt+U</kbd> Cycle Unit</span>
            <span><kbd className="rounded bg-white px-1 py-0.5 font-mono text-[10px] shadow-sm border">+/-</kbd> Qty</span>
            <span><kbd className="rounded bg-white px-1 py-0.5 font-mono text-[10px] shadow-sm border">5*barcode</kbd> Multi-scan</span>
            <span><kbd className="rounded bg-white px-1 py-0.5 font-mono text-[10px] shadow-sm border">F4</kbd> Clear</span>
            <span><kbd className="rounded bg-white px-1 py-0.5 font-mono text-[10px] shadow-sm border">F8</kbd> Save</span>
            <span><kbd className="rounded bg-white px-1 py-0.5 font-mono text-[10px] shadow-sm border">F9</kbd> Print</span>
          </div>

          {searchLoading && (
            <p className="mt-1 text-xs text-gray-500">Searching products...</p>
          )}

          {searchResults.length > 0 && (
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border bg-white p-1 shadow-lg z-20 relative">
              {searchResults.map((p, idx) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addLineToCart(p)}
                    className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors ${
                      idx === searchSelectIndex ? "bg-green-100 font-semibold text-green-900" : "hover:bg-green-50"
                    }`}
                  >
                    <span className="min-w-0 truncate">{p.name}</span>
                    <span className="ml-2 shrink-0 text-gray-600 font-medium">
                      {formatPrice(p.selling_price ?? p.price)} · {p.stock} in stock
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {productSearch && !searchLoading && searchResults.length === 0 && (
            <p className="mt-1 text-xs text-gray-500">No matching products found. Hit Enter to try exact barcode.</p>
          )}

          {showScanner && (
            <div className="mt-3">
              <BarcodeScanner onScan={addProductToCart} defaultMode="camera" />
            </div>
          )}
        </div>

        <div className="min-h-[12rem] flex-1 overflow-y-auto p-3 sm:p-4">
          {cart.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <ShoppingCart className="mx-auto mb-2 h-10 w-10 opacity-40" />
              <p className="font-medium text-gray-600">Cart is empty</p>
              <p className="text-xs text-gray-400 mt-1">
                Scan barcode or search above to add items. Hit Enter to navigate Qty → Rate → Disc → Amount.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {cart.map((line, idx) => {
                const key = cartLineKey(line);
                const discPercent = line.discountPercent ?? 0;
                const unitDiscount =
                  Math.round(line.rate * (discPercent / 100) * 100) / 100;
                const effectiveRate = Math.max(0, line.rate - unitDiscount);
                const lineTotal = effectiveRate * line.quantity;

                return (
                  <li
                    key={key}
                    className="rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm hover:border-gray-300 transition-colors"
                  >
                    {/* Item header line */}
                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-gray-100">
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-[11px] font-bold text-green-800">
                          {idx + 1}
                        </span>
                        <p className="truncate font-semibold text-gray-900 text-sm">
                          {line.name}
                        </p>
                        {discPercent > 0 && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0">
                            {discPercent}% OFF
                          </span>
                        )}
                        {line.barcode && (
                          <span className="hidden sm:inline text-[11px] text-gray-400 font-mono shrink-0">
                            ({line.barcode})
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() =>
                          setCart((c) => c.filter((l) => cartLineKey(l) !== key))
                        }
                        className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Packaging Unit Pills (Pcs / Packet / Box) */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-gray-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Unit:</span>
                      <button
                        type="button"
                        onClick={() => {
                          activeLineIndexRef.current = idx;
                          setLineUnit(key, "pcs");
                        }}
                        className={`rounded px-2 py-0.5 text-xs font-semibold transition-all ${
                          (line.unit || "pcs") === "pcs"
                            ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                        title="Sell loose pieces (Shortcut: Alt+P or P)"
                      >
                        Pcs (1 pc)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          activeLineIndexRef.current = idx;
                          setLineUnit(key, "pkt");
                        }}
                        className={`rounded px-2 py-0.5 text-xs font-semibold transition-all ${
                          line.unit === "pkt"
                            ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                        title={`Sell 1 packet = ${line.piecesPerPacket || 12} pcs (Shortcut: Alt+K or K)`}
                      >
                        Pkt ({line.piecesPerPacket || 12} pcs)
                        {line.packetSellingPrice ? ` · ₹${line.packetSellingPrice}` : ""}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          activeLineIndexRef.current = idx;
                          setLineUnit(key, "box");
                        }}
                        className={`rounded px-2 py-0.5 text-xs font-semibold transition-all ${
                          line.unit === "box"
                            ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                        title={`Sell 1 box = ${(line.piecesPerPacket || 12) * (line.packetsPerBox || 12)} pcs (Shortcut: Alt+B or B)`}
                      >
                        Box ({(line.piecesPerPacket || 12) * (line.packetsPerBox || 12)} pcs)
                        {line.boxSellingPrice ? ` · ₹${line.boxSellingPrice}` : ""}
                      </button>

                      {line.unit && line.unit !== "pcs" && (
                        <span className="ml-auto text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                          Deducts {line.quantity * (line.packMultiplier || 1)} base pcs
                        </span>
                      )}
                    </div>

                    {/* 4 Keyboard-navigable inputs: Qty, Rate, Disc %, Amount */}
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs">
                      {/* Qty field */}
                      <div>
                        <label
                          htmlFor={`quick-qty-${idx}`}
                          className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5"
                        >
                          Qty
                        </label>
                        <div className="flex items-center rounded border border-gray-300 bg-white focus-within:border-green-600 focus-within:ring-1 focus-within:ring-green-600">
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => updateQty(key, -1)}
                            className="px-1.5 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                            title="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            id={`quick-qty-${idx}`}
                            type="text"
                            inputMode="numeric"
                            value={line.quantity}
                            onFocus={() => {
                              activeLineIndexRef.current = idx;
                            }}
                            onChange={(e) =>
                              handleQtyInput(key, e.target.value)
                            }
                            onKeyDown={(e) => handleQtyKeyDown(idx, key, e)}
                            className="w-full bg-transparent text-center font-bold text-gray-900 text-sm focus:outline-none"
                            title="Type qty (e.g. 5, or 12p / 2k / 1b). Press Up/Down or +/- to change qty, P/K/B to change unit"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => updateQty(key, 1)}
                            className="px-1.5 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                            title="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Rate field */}
                      <div>
                        <label
                          htmlFor={`quick-rate-${idx}`}
                          className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5"
                        >
                          Rate (₹)
                        </label>
                        <div className="flex items-center rounded border border-gray-300 bg-white px-1.5 py-1 focus-within:border-green-600 focus-within:ring-1 focus-within:ring-green-600">
                          <span className="text-gray-400 mr-0.5">₹</span>
                          <input
                            id={`quick-rate-${idx}`}
                            type="number"
                            step="0.01"
                            min={0}
                            value={line.rate}
                            onChange={(e) =>
                              setLineRate(key, Number(e.target.value) || 0)
                            }
                            onKeyDown={(e) => handleRateKeyDown(idx, key, e)}
                            className="w-full bg-transparent text-right font-semibold text-gray-900 text-sm focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Disc % field */}
                      <div>
                        <label
                          htmlFor={`quick-disc-${idx}`}
                          className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5"
                        >
                          Disc (%)
                        </label>
                        <div className="flex items-center rounded border border-gray-300 bg-white px-1.5 py-1 focus-within:border-green-600 focus-within:ring-1 focus-within:ring-green-600">
                          <input
                            id={`quick-disc-${idx}`}
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            placeholder="0"
                            value={discPercent || ""}
                            onChange={(e) =>
                              updateLineDiscount(key, Number(e.target.value) || 0)
                            }
                            onKeyDown={(e) => handleDiscKeyDown(idx, key, e)}
                            className="w-full bg-transparent text-right font-semibold text-emerald-700 text-sm focus:outline-none"
                          />
                          <span className="text-gray-400 ml-0.5">%</span>
                        </div>
                      </div>

                      {/* Amount field */}
                      <div>
                        <label
                          htmlFor={`quick-amt-${idx}`}
                          className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5"
                        >
                          Amount (₹)
                        </label>
                        <div className="flex items-center rounded border border-green-200 bg-green-50/50 px-1.5 py-1 focus-within:border-green-600 focus-within:ring-1 focus-within:ring-green-600">
                          <span className="text-gray-400 mr-0.5">₹</span>
                          <input
                            id={`quick-amt-${idx}`}
                            type="number"
                            step="0.01"
                            min={0}
                            value={lineTotal ? lineTotal.toFixed(2) : ""}
                            onChange={(e) =>
                              updateLineAmount(key, Number(e.target.value) || 0)
                            }
                            onKeyDown={(e) => handleAmtKeyDown(idx, key, e)}
                            className="w-full bg-transparent text-right font-bold text-green-900 text-sm focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Right: payment panel */}
      <div className="flex w-full shrink-0 flex-col rounded-xl border bg-white p-3 sm:p-4 lg:w-[45%]">
        <div className="mb-4 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              id="quick-cust-mobile"
              placeholder="Customer mobile [Enter]"
              value={customerMobile}
              onChange={(e) => {
                setCustomerMobile(e.target.value);
                setSelectedCustomer(null);
              }}
              onBlur={() => void lookupCustomer()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) {
                    if (cart.length > 0) {
                      focusField(`quick-amt-${cart.length - 1}`);
                    } else {
                      focusField("pos-quick-search");
                    }
                    return;
                  }
                  void lookupCustomer();
                  focusField("quick-cust-name");
                }
              }}
            />
            <Input
              id="quick-cust-name"
              placeholder="Customer name [Enter]"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setSelectedCustomer(null);
              }}
              onBlur={() => void lookupCustomer()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) {
                    focusField("quick-cust-mobile");
                    return;
                  }
                  void lookupCustomer();
                  if (splitPayment) {
                    focusField("quick-split-cash");
                  } else {
                    focusField("quick-bill-discount");
                  }
                }
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={customerLookupLoading}
              onClick={() => void lookupCustomer()}
            >
              Find customer
            </Button>
            {customerMobile.trim().length === 10 && !selectedCustomer?.user_id && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1"
                onClick={() => setShowOnlineAccountModal(true)}
              >
                <Globe className="h-3.5 w-3.5" />
                + Online Account
              </Button>
            )}
            {selectedCustomer && (
              <Button type="button" size="sm" variant="ghost" onClick={clearCustomer}>
                Clear
              </Button>
            )}
          </div>
          {selectedCustomer && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-green-900">{selectedCustomer.name}</p>
                {selectedCustomer.user_id ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    🟢 Online Member
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
              <p className="text-green-800 mt-1">
                {selectedCustomer.loyalty_points} points available
                {selectedCustomer.credit_balance > 0 && (
                  <span className="ml-2 text-amber-700">
                    · Credit due {formatPrice(selectedCustomer.credit_balance)}
                  </span>
                )}
              </p>
            </div>
          )}
          {paymentMethod === "credit" && !customerMobile.trim() && (
            <p className="text-sm text-amber-700">
              Customer mobile is required for credit billing
            </p>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={splitPayment}
              onChange={(e) => setSplitPayment(e.target.checked)}
            />
            Split Payment (Cash + UPI + Card)
          </label>
          {splitPayment ? (
            <div className="grid grid-cols-3 gap-2">
              <Input
                id="quick-split-cash"
                type="number"
                placeholder="Cash ₹ [Enter]"
                value={splitCash || ""}
                onChange={(e) => setSplitCash(Number(e.target.value) || 0)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    focusField("quick-split-upi");
                  }
                }}
              />
              <Input
                id="quick-split-upi"
                type="number"
                placeholder="UPI ₹ [Enter]"
                value={splitUpi || ""}
                onChange={(e) => setSplitUpi(Number(e.target.value) || 0)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    focusField("quick-split-card");
                  }
                }}
              />
              <Input
                id="quick-split-card"
                type="number"
                placeholder="Card ₹ [Enter]"
                value={splitCard || ""}
                onChange={(e) => setSplitCard(Number(e.target.value) || 0)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    focusField("quick-bill-discount");
                  }
                }}
              />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(["cash", "upi", "card", "credit"] as PosPaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    paymentMethod === m
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {POS_PAYMENT_LABELS[m]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="col-span-2 flex gap-2">
            <button
              type="button"
              onClick={() => setDiscountMode("amount")}
              className={`rounded px-2 py-1 text-xs ${
                discountMode === "amount" ? "bg-green-600 text-white" : "bg-gray-100"
              }`}
            >
              ₹ Discount
            </button>
            <button
              type="button"
              onClick={() => setDiscountMode("percent")}
              className={`rounded px-2 py-1 text-xs ${
                discountMode === "percent" ? "bg-green-600 text-white" : "bg-gray-100"
              }`}
            >
              % Discount
            </button>
          </div>
          {discountMode === "amount" ? (
            <Input
              id="quick-bill-discount"
              type="number"
              placeholder="Discount ₹ [Enter]"
              value={discount || ""}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) {
                    focusField("quick-cust-name");
                    return;
                  }
                  if (selectedCustomer && selectedCustomer.loyalty_points > 0) {
                    focusField("quick-loyalty-redeem");
                  } else {
                    focusField("quick-bill-notes");
                  }
                }
              }}
            />
          ) : (
            <Input
              id="quick-bill-discount"
              type="number"
              min={0}
              max={100}
              placeholder="Discount % [Enter]"
              value={discountPercent || ""}
              onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) {
                    focusField("quick-cust-name");
                    return;
                  }
                  if (selectedCustomer && selectedCustomer.loyalty_points > 0) {
                    focusField("quick-loyalty-redeem");
                  } else {
                    focusField("quick-bill-notes");
                  }
                }
              }}
            />
          )}
          {loyaltyEnabled && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <Input
                  id="quick-loyalty-redeem"
                  type="number"
                  min={0}
                  max={selectedCustomer?.loyalty_points ?? 0}
                  placeholder="Redeem points [Enter]"
                  value={loyaltyRedeem || ""}
                  onChange={(e) => {
                    const maxPts = selectedCustomer?.loyalty_points ?? 0;
                    const val = Math.min(maxPts, Math.max(0, Number(e.target.value) || 0));
                    setLoyaltyRedeem(val);
                  }}
                  disabled={!selectedCustomer || (selectedCustomer?.loyalty_points ?? 0) <= 0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (e.shiftKey) {
                        focusField("quick-bill-discount");
                        return;
                      }
                      focusField("quick-bill-notes");
                    }
                  }}
                />
                {selectedCustomer && selectedCustomer.loyalty_points > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 shrink-0 text-xs text-amber-800 border-amber-300 hover:bg-amber-50"
                    onClick={() => {
                      if (loyaltyRedeem > 0) {
                        setLoyaltyRedeem(0);
                      } else {
                        const maxRedeemable = Math.min(
                          selectedCustomer.loyalty_points,
                          Math.floor((grossSubtotal - totalDiscount) / pointValue)
                        );
                        setLoyaltyRedeem(Math.max(0, maxRedeemable));
                      }
                    }}
                  >
                    {loyaltyRedeem > 0 ? "Clear" : "Max Pts"}
                  </Button>
                )}
              </div>
              {selectedCustomer && (
                <div className="flex items-center justify-between px-1 text-[11px] text-gray-500">
                  <span>
                    Avail: {selectedCustomer.loyalty_points} pts ({formatPrice(selectedCustomer.loyalty_points * pointValue)})
                  </span>
                  {loyaltyDiscountAmount > 0 && (
                    <span className="font-semibold text-emerald-700">
                      -{formatPrice(loyaltyDiscountAmount)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <Input
          id="quick-bill-notes"
          placeholder="Bill notes (optional) [Enter to Pay]"
          value={billNotes}
          onChange={(e) => setBillNotes(e.target.value)}
          className="mb-4"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) {
                focusField("quick-bill-discount");
                return;
              }
              focusField("quick-btn-pay-print");
            }
          }}
        />

        <div className="mb-4 rounded-lg bg-green-50 p-4">
          <div className="flex justify-between text-sm">
            <span>Gross Subtotal</span>
            <span>{formatPrice(grossSubtotal)}</span>
          </div>
          {itemDiscounts > 0 && (
            <div className="mt-1 flex justify-between text-sm font-semibold text-emerald-700">
              <span>Item Discounts</span>
              <span>- {formatPrice(itemDiscounts)}</span>
            </div>
          )}
          {computedBillDiscount > 0 && (
            <div className="mt-1 flex justify-between text-sm font-semibold text-emerald-700">
              <span>Bill Discount</span>
              <span>- {formatPrice(computedBillDiscount)}</span>
            </div>
          )}
          {totalDiscount > 0 && itemDiscounts > 0 && computedBillDiscount > 0 && (
            <div className="mt-1 flex justify-between text-sm font-bold text-emerald-800 border-t border-emerald-200 pt-1">
              <span>Total Savings</span>
              <span>- {formatPrice(totalDiscount)}</span>
            </div>
          )}
          {loyaltyDiscountAmount > 0 && (
            <div className="mt-1 flex justify-between text-sm text-emerald-700">
              <span>Loyalty Points ({loyaltyRedeem} pts)</span>
              <span>- {formatPrice(loyaltyDiscountAmount)}</span>
            </div>
          )}
          <p className="mt-1 text-xs italic text-gray-600">(Inclusive of GST)</p>
          <div className="mt-2 flex justify-between text-xl font-bold text-green-900 border-t border-green-200 pt-2">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>

        <div className="sticky bottom-0 grid grid-cols-2 gap-2 bg-white pt-2 lg:static">
          <Button
            variant="outline"
            onClick={holdBill}
            disabled={processing || !cart.length}
          >
            <Pause className="mr-1 h-4 w-4" />
            Hold
            <span className="ml-1 text-[10px] opacity-60">F6</span>
          </Button>
          <Button
            id="quick-btn-pay"
            variant="outline"
            onClick={() => void completeSale(false)}
            disabled={processing || !cart.length}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void completeSale(false);
              } else if (e.key === "ArrowRight") {
                focusField("quick-btn-pay-print");
              }
            }}
          >
            <ShoppingCart className="mr-1 h-4 w-4" />
            Pay
            <span className="ml-1 text-[10px] opacity-60">F8</span>
          </Button>
          <Button
            id="quick-btn-pay-print"
            className="col-span-2 focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
            onClick={() => void completeSale(true)}
            disabled={processing || !cart.length}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void completeSale(true);
              } else if (e.key === "ArrowLeft") {
                focusField("quick-btn-pay");
              }
            }}
          >
            <Printer className="mr-1 h-4 w-4" />
            Pay &amp; Print
            <span className="ml-1 text-[10px] opacity-70">F9</span>
          </Button>
        </div>

        {heldBills.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <p className="mb-2 text-sm font-medium">Held Bills</p>
            {heldBills.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => resumeHeld(b.id)}
                className="mb-1 flex w-full items-center justify-between rounded border px-3 py-2 text-sm hover:bg-gray-50"
              >
                <span>{b.bill_number}</span>
                <Play className="h-4 w-4 text-green-600" />
              </button>
            ))}
          </div>
        )}

        {lastSale && (
          <div className="mt-4 border-t pt-4">
            <p className="mb-2 text-sm font-medium">Last Bill: {lastSale.bill_number}</p>
            <ReceiptActions
              data={{
                ...receiptFromPosSale(lastSale),
                cashierName: profile?.name ?? null,
                discountPercent:
                  discountMode === "percent" ? discountPercent : undefined,
                creditBalance: lastSaleCreditBalance ?? undefined,
              }}
              settings={settings}
              defaultWidth={printWidth}
              receiptId="pos-thermal-receipt"
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-2 text-green-700 hover:bg-green-50 border-green-200"
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
            >
              <MessageCircle className="mr-1 h-4 w-4 text-green-600" />
              WhatsApp Bill to Customer
            </Button>
          </div>
        )}
      </div>

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
        onAddToCart={addLineToCart}
      />
    </div>
  );
}

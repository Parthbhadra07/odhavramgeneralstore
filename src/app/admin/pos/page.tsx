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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/components/erp/barcode-scanner";
import { ReceiptActions } from "@/components/erp/receipt-actions";
import { customerService, inventoryService, posService, settingsService } from "@/services/erp";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { useAuth } from "@/hooks/use-auth";
import type { Customer, ErpProduct, PosCartLine, PosSale } from "@/types/erp";
import type { PosPaymentMethod } from "@/lib/erp/constants";
import { LOYALTY_POINTS_PER_100, POS_PAYMENT_LABELS } from "@/lib/erp/constants";
import { isValidMobile } from "@/utils/phone";
import { formatPrice } from "@/utils/format";
import { receiptFromPosSale } from "@/utils/receipt";
import { openWhatsAppShare, invoiceShareMessage } from "@/utils/whatsapp";

function cartLineKey(line: PosCartLine) {
  return `${line.productId}-${line.lotId ?? "default"}`;
}

export default function PosPage() {
  const { settings } = useStoreSettings();
  const { profile } = useAuth();
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [heldBills, setHeldBills] = useState<PosSale[]>([]);
  const [lastSale, setLastSale] = useState<PosSale | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerLookupLoading, setCustomerLookupLoading] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [loyaltyRedeem, setLoyaltyRedeem] = useState(0);
  const [billNotes, setBillNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [printWidth, setPrintWidth] = useState<"58mm" | "80mm">("80mm");
  const [showScanner, setShowScanner] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ErpProduct[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [splitPayment, setSplitPayment] = useState(false);
  const [splitCash, setSplitCash] = useState(0);
  const [splitUpi, setSplitUpi] = useState(0);
  const [splitCard, setSplitCard] = useState(0);
  const completeSaleRef = useRef<() => Promise<void>>(async () => {});

  const loadHeld = useCallback(() => {
    posService.getHeldBills().then(setHeldBills);
  }, []);

  useEffect(() => {
    loadHeld();
    settingsService.get().then((s) => setPrintWidth(s.receipt_width));
  }, [loadHeld]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setShowProductPicker(true);
      }
      if (e.key === "F4") {
        e.preventDefault();
        setCart([]);
        clearCustomer();
        setDiscount(0);
        setLoyaltyRedeem(0);
        toast.message("New sale — cart cleared");
      }
      if (e.key === "F8" && cart.length) {
        e.preventDefault();
        void completeSaleRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart.length]);

  useEffect(() => {
    if (!productSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      setSearchLoading(true);
      inventoryService
        .listProducts({ search: productSearch.trim() })
        .then(setSearchResults)
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  const addLineToCart = useCallback(
    (
      product: ErpProduct,
      lot?: { id: string; barcode: string; current_stock: number; selling_price: number | null } | null
    ) => {
      const stock = lot ? lot.current_stock : product.stock;
      if (stock <= 0) {
        toast.error(`${product.name} is out of stock`);
        return;
      }
      const rate = Number(
        lot?.selling_price ?? product.selling_price ?? product.price
      );
      const lotId = lot?.id ?? null;
      const barcode = lot?.barcode ?? product.barcode;

      setCart((prev) => {
        const key = `${product.id}-${lotId ?? "default"}`;
        const existing = prev.find((l) => cartLineKey(l) === key);
        if (existing) {
          if (existing.quantity >= stock) {
            toast.error("Not enough stock");
            return prev;
          }
          return prev.map((l) =>
            cartLineKey(l) === key ? { ...l, quantity: l.quantity + 1 } : l
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
            gstPercentage: Number(product.gst_percentage ?? 0),
            quantity: 1,
          },
        ];
      });
      toast.success(`Added: ${product.name}`);
      setShowProductPicker(false);
      setProductSearch("");
    },
    []
  );

  const addProductToCart = useCallback(
    async (barcode: string) => {
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
            : null
        );
        return;
      }
      const products = await inventoryService.listProducts({ search: barcode });
      if (products[0]) {
        addLineToCart(products[0]);
        return;
      }
      toast.error("Product not found");
    },
    [addLineToCart]
  );

  const subtotal = cart.reduce((s, l) => s + l.rate * l.quantity, 0);
  const computedDiscount =
    discountMode === "percent"
      ? Math.round((subtotal * discountPercent) / 100)
      : discount;
  const total = Math.max(0, subtotal - computedDiscount - loyaltyRedeem);
  const pointsToEarn =
    selectedCustomer && total > 0
      ? Math.floor(total / 100) * LOYALTY_POINTS_PER_100
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
        toast.success(`Customer linked — ${found.loyalty_points} points available`);
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

  const completeSale = async () => {
    if (!cart.length) {
      toast.error("Cart is empty");
      return;
    }
    if (loyaltyRedeem > 0 && !customerMobile.trim()) {
      toast.error("Enter customer mobile to redeem loyalty points");
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
        discount: computedDiscount,
        loyaltyPointsRedeemed: loyaltyRedeem,
        notes: billNotes.trim() || undefined,
      });
      setLastSale(sale);
      setCart([]);
      setDiscount(0);
      setLoyaltyRedeem(0);
      setSplitCash(0);
      setSplitUpi(0);
      setSplitCard(0);
      clearCustomer();
      const earned =
        sale.customer_id && sale.sale_status === "completed"
          ? Math.floor(Number(sale.total_amount) / 100) * LOYALTY_POINTS_PER_100
          : 0;
      toast.success(
        earned > 0
          ? `Bill ${sale.bill_number} — +${earned} loyalty points`
          : `Bill ${sale.bill_number} completed`
      );
    } catch (e) {
      if (!navigator.onLine) {
        const { queueOfflinePosSale } = await import("@/lib/offline/pos-queue");
        queueOfflinePosSale({
          lines: cart,
          paymentMethod,
          customerName: customerName.trim() || undefined,
          customerMobile: customerMobile.trim() || undefined,
          discount: computedDiscount,
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
            <h1 className="text-lg font-bold text-green-900 sm:text-xl">POS Billing</h1>
            <p className="text-xs text-gray-500">F2 Search · F4 New · F8 Save</p>
            <div className="flex gap-2">
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

          {showProductPicker && (
            <div className="mt-3 rounded-lg border bg-gray-50 p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  autoFocus
                  placeholder="Search product name, SKU, barcode..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {searchLoading && (
                <p className="mt-2 text-xs text-gray-500">Searching...</p>
              )}
              {searchResults.length > 0 && (
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {searchResults.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addLineToCart(p)}
                        className="flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-left text-sm hover:bg-green-50"
                      >
                        <span className="min-w-0 truncate font-medium">{p.name}</span>
                        <span className="ml-2 shrink-0 text-gray-600">
                          {formatPrice(p.selling_price ?? p.price)} · {p.stock} left
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {productSearch && !searchLoading && searchResults.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">No products found</p>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-2 w-full"
                onClick={() => {
                  setShowProductPicker(false);
                  setProductSearch("");
                }}
              >
                Close
              </Button>
            </div>
          )}

          {showScanner && (
            <div className="mt-3">
              <BarcodeScanner onScan={addProductToCart} defaultMode="camera" />
            </div>
          )}
        </div>

        <div className="min-h-[12rem] flex-1 overflow-y-auto p-3 sm:p-4">
          {cart.length === 0 ? (
            <p className="py-8 text-center text-gray-500">
              Scan barcode or tap Add Product to start billing
            </p>
          ) : (
            <ul className="space-y-2">
              {cart.map((line) => {
                const key = cartLineKey(line);
                return (
                  <li
                    key={key}
                    className="flex items-center gap-2 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{line.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatPrice(line.rate)} × {line.quantity} ={" "}
                        {formatPrice(line.rate * line.quantity)}
                      </p>
                      {line.lotId && (
                        <p className="text-xs text-gray-400">Lot barcode: {line.barcode}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQty(key, -1)}
                        className="rounded p-1.5 hover:bg-gray-100"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center text-sm">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(key, 1)}
                        className="rounded p-1.5 hover:bg-gray-100"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCart((c) => c.filter((l) => cartLineKey(l) !== key))
                        }
                        className="rounded p-1.5 text-red-600 hover:bg-red-50"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
              placeholder="Customer mobile"
              value={customerMobile}
              onChange={(e) => {
                setCustomerMobile(e.target.value);
                setSelectedCustomer(null);
              }}
              onBlur={() => void lookupCustomer()}
            />
            <Input
              placeholder="Customer name"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setSelectedCustomer(null);
              }}
              onBlur={() => void lookupCustomer()}
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
            {selectedCustomer && (
              <Button type="button" size="sm" variant="ghost" onClick={clearCustomer}>
                Clear
              </Button>
            )}
          </div>
          {selectedCustomer && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm">
              <p className="font-medium text-green-900">{selectedCustomer.name}</p>
              <p className="text-green-800">
                {selectedCustomer.loyalty_points} points available
              </p>
            </div>
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
              <Input type="number" placeholder="Cash ₹" value={splitCash || ""} onChange={(e) => setSplitCash(Number(e.target.value) || 0)} />
              <Input type="number" placeholder="UPI ₹" value={splitUpi || ""} onChange={(e) => setSplitUpi(Number(e.target.value) || 0)} />
              <Input type="number" placeholder="Card ₹" value={splitCard || ""} onChange={(e) => setSplitCard(Number(e.target.value) || 0)} />
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
              type="number"
              placeholder="Discount ₹"
              value={discount || ""}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            />
          ) : (
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="Discount %"
              value={discountPercent || ""}
              onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
            />
          )}
          <Input
            type="number"
            min={0}
            placeholder="Redeem points"
            value={loyaltyRedeem || ""}
            onChange={(e) => setLoyaltyRedeem(Number(e.target.value) || 0)}
            disabled={!selectedCustomer}
          />
        </div>
        <Input
          placeholder="Bill notes (optional)"
          value={billNotes}
          onChange={(e) => setBillNotes(e.target.value)}
          className="mb-4"
        />

        <div className="mb-4 rounded-lg bg-green-50 p-4">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="mt-2 flex justify-between text-xl font-bold text-green-900">
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
          </Button>
          <Button onClick={completeSale} disabled={processing || !cart.length}>
            <ShoppingCart className="mr-1 h-4 w-4" />
            Pay & Print
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
              }}
              settings={settings}
              defaultWidth={printWidth}
              receiptId="pos-thermal-receipt"
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() =>
                openWhatsAppShare(
                  invoiceShareMessage(
                    lastSale.bill_number,
                    formatPrice(lastSale.total_amount)
                  )
                )
              }
            >
              <MessageCircle className="mr-1 h-4 w-4" />
              WhatsApp
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

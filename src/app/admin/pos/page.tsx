"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Minus,
  Trash2,
  Pause,
  Play,
  Printer,
  MessageCircle,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/components/erp/barcode-scanner";
import { PosThermalReceipt, printPosThermalReceipt } from "@/components/erp/pos-thermal-receipt";
import { inventoryService, posService } from "@/services/erp";
import type { PosCartLine, PosSale } from "@/types/erp";
import type { PosPaymentMethod } from "@/lib/erp/constants";
import { POS_PAYMENT_LABELS } from "@/lib/erp/constants";
import { formatPrice } from "@/utils/format";
import { openWhatsAppShare, invoiceShareMessage } from "@/utils/whatsapp";

export default function PosPage() {
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [heldBills, setHeldBills] = useState<PosSale[]>([]);
  const [lastSale, setLastSale] = useState<PosSale | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [discount, setDiscount] = useState(0);
  const [loyaltyRedeem, setLoyaltyRedeem] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [printWidth, setPrintWidth] = useState<"58mm" | "80mm">("80mm");
  const [showScanner, setShowScanner] = useState(true);

  const loadHeld = useCallback(() => {
    posService.getHeldBills().then(setHeldBills);
  }, []);

  useEffect(() => {
    loadHeld();
  }, [loadHeld]);

  const addProductToCart = useCallback(async (barcode: string) => {
    const product =
      (await inventoryService.getByBarcode(barcode)) ??
      (await inventoryService.listProducts({ search: barcode }))[0];
    if (!product) {
      toast.error("Product not found");
      return;
    }
    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    const rate = Number(product.selling_price ?? product.price);
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error("Not enough stock");
          return prev;
        }
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          barcode: product.barcode,
          rate,
          gstPercentage: Number(product.gst_percentage ?? 0),
          quantity: 1,
        },
      ];
    });
    toast.success(`Added: ${product.name}`);
  }, []);

  const subtotal = cart.reduce((s, l) => s + l.rate * l.quantity, 0);
  const total = Math.max(0, subtotal - discount - loyaltyRedeem);

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.productId === productId
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
    setProcessing(true);
    try {
      const sale = await posService.createSale({
        lines: cart,
        paymentMethod,
        customerName: customerName || undefined,
        customerMobile: customerMobile || undefined,
        discount,
        loyaltyPointsRedeemed: loyaltyRedeem,
      });
      setLastSale(sale);
      setCart([]);
      setDiscount(0);
      setLoyaltyRedeem(0);
      toast.success(`Bill ${sale.bill_number} completed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sale failed");
    } finally {
      setProcessing(false);
    }
  };

  const holdBill = async () => {
    if (!cart.length) return;
    setProcessing(true);
    try {
      await posService.holdBill({
        lines: cart,
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
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row lg:gap-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-white lg:max-w-[55%]">
        <div className="border-b p-4">
          <h1 className="text-xl font-bold text-green-900">POS Billing</h1>
          <button
            type="button"
            className="mt-2 text-sm text-green-700 underline"
            onClick={() => setShowScanner((s) => !s)}
          >
            {showScanner ? "Hide" : "Show"} barcode scanner
          </button>
          {showScanner && (
            <div className="mt-3">
              <BarcodeScanner onScan={addProductToCart} />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <p className="text-center text-gray-500">Scan or search products to add</p>
          ) : (
            <ul className="space-y-2">
              {cart.map((line) => (
                <li
                  key={line.productId}
                  className="flex items-center gap-2 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{line.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatPrice(line.rate)} × {line.quantity} ={" "}
                      {formatPrice(line.rate * line.quantity)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQty(line.productId, -1)}
                      className="rounded p-1 hover:bg-gray-100"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(line.productId, 1)}
                      className="rounded p-1 hover:bg-gray-100"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCart((c) => c.filter((l) => l.productId !== line.productId))
                      }
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 flex w-full flex-col rounded-xl border bg-white p-4 lg:mt-0 lg:w-[45%]">
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Customer mobile"
            value={customerMobile}
            onChange={(e) => setCustomerMobile(e.target.value)}
          />
          <Input
            placeholder="Customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
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

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Discount ₹"
            value={discount || ""}
            onChange={(e) => setDiscount(Number(e.target.value) || 0)}
          />
          <Input
            type="number"
            placeholder="Loyalty points"
            value={loyaltyRedeem || ""}
            onChange={(e) => setLoyaltyRedeem(Number(e.target.value) || 0)}
          />
        </div>

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

        <div className="grid grid-cols-2 gap-2">
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
            <div className="flex flex-wrap gap-2">
              <select
                value={printWidth}
                onChange={(e) => setPrintWidth(e.target.value as "58mm" | "80mm")}
                className="rounded border px-2 py-1 text-sm"
              >
                <option value="58mm">58mm</option>
                <option value="80mm">80mm</option>
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => printPosThermalReceipt(printWidth)}
              >
                <Printer className="mr-1 h-4 w-4" />
                Reprint
              </Button>
              <Button
                size="sm"
                variant="outline"
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
          </div>
        )}
      </div>

      {lastSale && (
        <div className="pointer-events-none fixed -left-[9999px] top-0 opacity-0">
          <PosThermalReceipt sale={lastSale} width={printWidth} />
        </div>
      )}
    </div>
  );
}

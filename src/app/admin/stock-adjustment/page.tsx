"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { inventoryService } from "@/services/erp";
import type { ErpProduct } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const REASONS = [
  { value: "adjustment", label: "General Adjustment", sign: "both" as const },
  { value: "damaged", label: "Damaged Stock", sign: "decrease" as const },
  { value: "expired", label: "Expired Stock", sign: "decrease" as const },
];

export default function StockAdjustmentPage() {
  const [products, setProducts] = useState<ErpProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [direction, setDirection] = useState<"increase" | "decrease">("increase");
  const [reason, setReason] = useState("adjustment");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    inventoryService.listProducts().then(setProducts);
  }, []);

  const selected = products.find((p) => p.id === productId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || qty < 1) {
      toast.error("Select product and quantity");
      return;
    }
    setSaving(true);
    try {
      const reasonCfg = REASONS.find((r) => r.value === reason);
      const delta = direction === "increase" ? qty : -qty;
      const movementType = reason === "damaged" ? "damaged" : reason === "expired" ? "expired" : "adjustment";
      await inventoryService.adjustStock(
        productId,
        delta,
        notes || `${reasonCfg?.label ?? "Adjustment"} — ${direction}`,
        movementType as "adjustment" | "damaged" | "expired"
      );
      toast.success("Stock adjusted — ledger updated");
      setQty(1);
      setNotes("");
      inventoryService.listProducts().then(setProducts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="admin-page-title mb-1">Stock Adjustment</h1>
      <p className="mb-6 text-sm text-gray-600">Increase, decrease, or mark damaged/expired stock</p>

      <form onSubmit={handleSubmit} className="admin-card space-y-4 p-4 sm:p-6">
        <div>
          <label className="mb-1 block text-sm font-medium">Product</label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            required
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — Stock: {p.stock}
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
            Current stock: <strong>{selected.stock}</strong>
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Direction</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={direction}
              onChange={(e) => setDirection(e.target.value as "increase" | "decrease")}
            >
              <option value="increase">Increase Stock</option>
              <option value="decrease">Decrease Stock</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Quantity</label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Reason</label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              const r = REASONS.find((x) => x.value === e.target.value);
              if (r?.sign === "decrease") setDirection("decrease");
            }}
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Adjustment reason details" />
        </div>

        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          Apply Adjustment
        </Button>
      </form>
    </div>
  );
}

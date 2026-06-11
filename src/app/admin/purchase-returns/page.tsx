"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  purchaseReturnService,
  purchaseService,
  supplierService,
  lotService,
} from "@/services/erp";
import type { PurchaseBill, PurchaseReturn, Supplier, PurchaseReturnReason } from "@/types/erp";
import type { ProductLot } from "@/types/erp";
import {
  PURCHASE_RETURN_REASONS,
  PURCHASE_RETURN_REASON_LABELS,
} from "@/lib/erp/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/admin/modal";
import { ActionButton } from "@/components/admin/action-button";
import { formatPrice, formatDate } from "@/utils/format";

const emptyForm = {
  supplierId: "",
  purchaseBillId: "",
  returnDate: new Date().toISOString().slice(0, 10),
  reason: "damage" as PurchaseReturnReason,
  reasonNotes: "",
  productId: "",
  lotId: "",
  quantity: 1,
  purchaseRate: 0,
  productName: "",
  barcode: "",
  lotNumber: "",
  batchNumber: "",
};

export default function PurchaseReturnsPage() {
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [lots, setLots] = useState<ProductLot[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editReturn, setEditReturn] = useState<PurchaseReturn | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editItemId, setEditItemId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    purchaseReturnService.list().then(setReturns);
    supplierService.list().then(setSuppliers);
    purchaseService.list().then(setBills);
    lotService.listAll().then(setLots);
  };

  useEffect(() => {
    load();
  }, []);

  const selectedBill = bills.find((b) => b.id === form.purchaseBillId);
  const billItems = selectedBill?.purchase_items ?? [];
  const supplierLots = lots.filter(
    (l) => !form.supplierId || l.products?.name
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplierId || !form.productId || !form.quantity) {
      toast.error("Fill required fields");
      return;
    }
    setSaving(true);
    try {
      await purchaseReturnService.create({
        supplierId: form.supplierId,
        purchaseBillId: form.purchaseBillId || undefined,
        returnDate: form.returnDate,
        reason: form.reason,
        reasonNotes: form.reasonNotes || undefined,
        items: [
          {
            productId: form.productId,
            productName: form.productName,
            lotId: form.lotId || undefined,
            barcode: form.barcode || undefined,
            lotNumber: form.lotNumber || undefined,
            batchNumber: form.batchNumber || undefined,
            quantity: form.quantity,
            purchaseRate: form.purchaseRate,
          },
        ],
      });
      toast.success("Purchase return saved — stock reduced");
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (ret: PurchaseReturn) => {
    const item = ret.purchase_return_items?.[0];
    if (!item) {
      toast.error("No return items to edit");
      return;
    }
    setEditReturn(ret);
    setEditItemId(item.id);
    setEditForm({
      supplierId: ret.supplier_id,
      purchaseBillId: ret.purchase_bill_id ?? "",
      returnDate: ret.return_date,
      reason: ret.reason,
      reasonNotes: ret.reason_notes ?? "",
      productId: item.product_id,
      lotId: item.lot_id ?? "",
      quantity: item.quantity,
      purchaseRate: Number(item.purchase_rate),
      productName: item.product_name,
      barcode: item.barcode ?? "",
      lotNumber: item.lot_number ?? "",
      batchNumber: item.batch_number ?? "",
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editReturn || !editForm.supplierId || !editForm.productId || !editForm.quantity) {
      toast.error("Fill required fields");
      return;
    }
    setSaving(true);
    try {
      await purchaseReturnService.update({
        returnId: editReturn.id,
        itemId: editItemId,
        supplierId: editForm.supplierId,
        purchaseBillId: editForm.purchaseBillId || null,
        returnDate: editForm.returnDate,
        reason: editForm.reason,
        reasonNotes: editForm.reasonNotes || null,
        productId: editForm.productId,
        productName: editForm.productName,
        lotId: editForm.lotId || null,
        barcode: editForm.barcode || null,
        lotNumber: editForm.lotNumber || null,
        batchNumber: editForm.batchNumber || null,
        quantity: editForm.quantity,
        purchaseRate: editForm.purchaseRate,
      });
      toast.success("Purchase return updated — stock adjusted");
      setEditReturn(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Purchase Returns</h1>
          <p className="text-sm text-gray-600">Return goods back to supplier</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-4 w-4" />
          Create Return
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <select
            className="rounded-lg border px-3 py-2"
            value={form.supplierId}
            onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
            required
          >
            <option value="">Select supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border px-3 py-2"
            value={form.purchaseBillId}
            onChange={(e) => setForm({ ...form, purchaseBillId: e.target.value })}
          >
            <option value="">Original purchase bill (optional)</option>
            {bills
              .filter((b) => !form.supplierId || b.supplier_id === form.supplierId)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bill_number} — {formatDate(b.invoice_date)}
                </option>
              ))}
          </select>
          <Input
            type="date"
            value={form.returnDate}
            onChange={(e) => setForm({ ...form, returnDate: e.target.value })}
          />
          <select
            className="rounded-lg border px-3 py-2"
            value={form.reason}
            onChange={(e) =>
              setForm({ ...form, reason: e.target.value as typeof form.reason })
            }
          >
            {PURCHASE_RETURN_REASONS.map((r) => (
              <option key={r} value={r}>
                {PURCHASE_RETURN_REASON_LABELS[r]}
              </option>
            ))}
          </select>
          <Input
            placeholder="Reason notes"
            value={form.reasonNotes}
            onChange={(e) => setForm({ ...form, reasonNotes: e.target.value })}
          />
          <select
            className="rounded-lg border px-3 py-2 sm:col-span-2"
            value={form.productId}
            onChange={(e) => {
              const item = billItems.find((i) => i.product_id === e.target.value);
              const lot = lots.find((l) => l.product_id === e.target.value);
              setForm({
                ...form,
                productId: e.target.value,
                productName: item?.products?.name ?? lot?.products?.name ?? "",
                purchaseRate: Number(item?.purchase_rate ?? lot?.purchase_price ?? 0),
                lotId: lot?.id ?? "",
                barcode: lot?.barcode ?? item?.barcode ?? "",
                lotNumber: lot?.lot_number ?? "",
                batchNumber: lot?.batch_number ?? item?.batch_number ?? "",
              });
            }}
            required
          >
            <option value="">Select product</option>
            {billItems.map((i) => (
              <option key={i.id} value={i.product_id}>
                {i.products?.name ?? "Product"} — qty {i.quantity}
              </option>
            ))}
            {supplierLots.map((l) => (
              <option key={l.id} value={l.product_id}>
                {l.products?.name} — Lot {l.lot_number} ({l.current_stock})
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border px-3 py-2"
            value={form.lotId}
            onChange={(e) => {
              const lot = lots.find((l) => l.id === e.target.value);
              setForm({
                ...form,
                lotId: e.target.value,
                barcode: lot?.barcode ?? form.barcode,
                lotNumber: lot?.lot_number ?? "",
                batchNumber: lot?.batch_number ?? "",
              });
            }}
          >
            <option value="">Select lot (optional)</option>
            {lots
              .filter((l) => !form.productId || l.product_id === form.productId)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.barcode} — {l.current_stock} left
                </option>
              ))}
          </select>
          <Input
            type="number"
            min={1}
            placeholder="Qty to return"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
          />
          <Input
            type="number"
            placeholder="Purchase rate"
            value={form.purchaseRate}
            onChange={(e) => setForm({ ...form, purchaseRate: Number(e.target.value) })}
          />
          <Button type="submit" disabled={saving} className="sm:col-span-2 lg:col-span-1">
            Save Return
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Return #</th>
              <th>Date</th>
              <th>Supplier</th>
              <th>Reason</th>
              <th>Amount</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-mono">{r.return_number}</td>
                <td className="p-3">{formatDate(r.return_date)}</td>
                <td className="p-3">{r.suppliers?.name ?? "—"}</td>
                <td className="p-3">
                  {PURCHASE_RETURN_REASON_LABELS[r.reason] ?? r.reason}
                </td>
                <td className="p-3 font-medium">{formatPrice(r.total_amount)}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <ActionButton
                      label="Edit return"
                      icon={Pencil}
                      onClick={() => openEdit(r)}
                    />
                    <ActionButton
                      label="Print"
                      icon={Printer}
                      onClick={() => window.print()}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {returns.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  No purchase returns yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editReturn}
        onClose={() => setEditReturn(null)}
        title={`Edit Return ${editReturn?.return_number ?? ""}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setEditReturn(null)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-purchase-return-form" disabled={saving}>
              Save Changes
            </Button>
          </div>
        }
      >
        <form id="edit-purchase-return-form" onSubmit={handleEdit} className="grid gap-3 sm:grid-cols-2">
          <select
            className="rounded-lg border px-3 py-2 sm:col-span-2"
            value={editForm.supplierId}
            onChange={(e) => setEditForm({ ...editForm, supplierId: e.target.value })}
            required
          >
            <option value="">Select supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Input
            type="date"
            value={editForm.returnDate}
            onChange={(e) => setEditForm({ ...editForm, returnDate: e.target.value })}
          />
          <select
            className="rounded-lg border px-3 py-2"
            value={editForm.reason}
            onChange={(e) =>
              setEditForm({ ...editForm, reason: e.target.value as typeof editForm.reason })
            }
          >
            {PURCHASE_RETURN_REASONS.map((r) => (
              <option key={r} value={r}>
                {PURCHASE_RETURN_REASON_LABELS[r]}
              </option>
            ))}
          </select>
          <Input
            placeholder="Reason notes"
            value={editForm.reasonNotes}
            onChange={(e) => setEditForm({ ...editForm, reasonNotes: e.target.value })}
            className="sm:col-span-2"
          />
          <Input
            placeholder="Product name"
            value={editForm.productName}
            onChange={(e) => setEditForm({ ...editForm, productName: e.target.value })}
            className="sm:col-span-2"
          />
          <select
            className="rounded-lg border px-3 py-2"
            value={editForm.lotId}
            onChange={(e) => {
              const lot = lots.find((l) => l.id === e.target.value);
              setEditForm({
                ...editForm,
                lotId: e.target.value,
                barcode: lot?.barcode ?? editForm.barcode,
                lotNumber: lot?.lot_number ?? "",
                batchNumber: lot?.batch_number ?? "",
              });
            }}
          >
            <option value="">Select lot (optional)</option>
            {lots
              .filter((l) => !editForm.productId || l.product_id === editForm.productId)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.barcode} — {l.current_stock} left
                </option>
              ))}
          </select>
          <Input
            type="number"
            min={1}
            placeholder="Qty to return"
            value={editForm.quantity}
            onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
          />
          <Input
            type="number"
            placeholder="Purchase rate"
            value={editForm.purchaseRate}
            onChange={(e) => setEditForm({ ...editForm, purchaseRate: Number(e.target.value) })}
          />
        </form>
      </Modal>
    </div>
  );
}

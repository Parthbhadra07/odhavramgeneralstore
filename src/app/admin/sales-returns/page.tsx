"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  salesReturnService,
  posService,
  customerService,
} from "@/services/erp";
import type { SalesReturn, Customer, PosSale, SalesReturnReason, SalesReturnType } from "@/types/erp";
import {
  SALES_RETURN_REASONS,
  SALES_RETURN_REASON_LABELS,
  SALES_RETURN_TYPES,
  SALES_RETURN_TYPE_LABELS,
} from "@/lib/erp/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/admin/modal";
import { ActionButton } from "@/components/admin/action-button";
import { formatPrice, formatDate } from "@/utils/format";

const emptyForm = {
  sourceType: "pos" as "pos" | "order",
  posSaleId: "",
  orderId: "",
  customerId: "",
  customerName: "",
  customerMobile: "",
  returnDate: new Date().toISOString().slice(0, 10),
  reason: "customer_return" as SalesReturnReason,
  returnType: "refund" as SalesReturnType,
  reasonNotes: "",
  productId: "",
  productName: "",
  quantity: 1,
  rate: 0,
  createRefund: true,
  refundMethod: "cash" as const,
};

export default function SalesReturnsPage() {
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [posSales, setPosSales] = useState<PosSale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editReturn, setEditReturn] = useState<SalesReturn | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editItemId, setEditItemId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    salesReturnService.list().then(setReturns);
    posService.list({ limit: 50 }).then(setPosSales);
    customerService.list().then(setCustomers);
  };

  useEffect(() => {
    load();
  }, []);

  const selectedPos = posSales.find((s) => s.id === form.posSaleId);
  const posItems = selectedPos?.pos_sale_items ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productId || !form.quantity) {
      toast.error("Select product and quantity");
      return;
    }
    setSaving(true);
    try {
      await salesReturnService.create({
        customerId: form.customerId || undefined,
        customerName: form.customerName || undefined,
        customerMobile: form.customerMobile || undefined,
        orderId: form.sourceType === "order" ? form.orderId : undefined,
        posSaleId: form.sourceType === "pos" ? form.posSaleId : undefined,
        returnDate: form.returnDate,
        reason: form.reason,
        returnType: form.returnType,
        reasonNotes: form.reasonNotes || undefined,
        createRefund: form.returnType === "refund",
        refundMethod: form.refundMethod,
        items: [
          {
            productId: form.productId,
            productName: form.productName,
            quantity: form.quantity,
            rate: form.rate,
          },
        ],
      });
      toast.success("Sales return saved — stock restored");
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (ret: SalesReturn) => {
    const item = ret.sales_return_items?.[0];
    if (!item) {
      toast.error("No return items to edit");
      return;
    }
    setEditReturn(ret);
    setEditItemId(item.id);
    setEditForm({
      sourceType: ret.pos_sale_id ? "pos" : "order",
      posSaleId: ret.pos_sale_id ?? "",
      orderId: ret.order_id ?? "",
      customerId: ret.customer_id ?? "",
      customerName: ret.customer_name ?? "",
      customerMobile: ret.customer_mobile ?? "",
      returnDate: ret.return_date,
      reason: ret.reason,
      returnType: ret.return_type,
      reasonNotes: ret.reason_notes ?? "",
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      rate: Number(item.rate),
      createRefund: ret.return_type === "refund",
      refundMethod: "cash",
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editReturn || !editForm.productId || !editForm.quantity) {
      toast.error("Select product and quantity");
      return;
    }
    setSaving(true);
    try {
      await salesReturnService.update({
        returnId: editReturn.id,
        itemId: editItemId,
        customerId: editForm.customerId || null,
        customerName: editForm.customerName || null,
        customerMobile: editForm.customerMobile || null,
        returnDate: editForm.returnDate,
        reason: editForm.reason,
        returnType: editForm.returnType,
        reasonNotes: editForm.reasonNotes || null,
        productId: editForm.productId,
        productName: editForm.productName,
        quantity: editForm.quantity,
        rate: editForm.rate,
      });
      toast.success("Sales return updated — stock adjusted");
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
          <h1 className="text-2xl font-bold">Sales Returns</h1>
          <p className="text-sm text-gray-600">Customer returns and refunds</p>
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
            value={form.sourceType}
            onChange={(e) =>
              setForm({ ...form, sourceType: e.target.value as "pos" | "order" })
            }
          >
            <option value="pos">POS Bill</option>
            <option value="order">Online Order</option>
          </select>
          {form.sourceType === "pos" ? (
            <select
              className="rounded-lg border px-3 py-2 sm:col-span-2"
              value={form.posSaleId}
              onChange={(e) => {
                const sale = posSales.find((s) => s.id === e.target.value);
                setForm({
                  ...form,
                  posSaleId: e.target.value,
                  customerName: sale?.customer_name ?? "",
                  customerMobile: sale?.customer_mobile ?? "",
                });
              }}
            >
              <option value="">Select POS bill</option>
              {posSales
                .filter((s) => s.sale_status === "completed")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.bill_number} — {formatPrice(s.total_amount)}
                  </option>
                ))}
            </select>
          ) : (
            <Input
              placeholder="Order ID"
              value={form.orderId}
              onChange={(e) => setForm({ ...form, orderId: e.target.value })}
              className="sm:col-span-2"
            />
          )}
          <Input
            placeholder="Customer name"
            value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })}
          />
          <Input
            placeholder="Customer mobile"
            value={form.customerMobile}
            onChange={(e) => setForm({ ...form, customerMobile: e.target.value })}
          />
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
            {SALES_RETURN_REASONS.map((r) => (
              <option key={r} value={r}>
                {SALES_RETURN_REASON_LABELS[r]}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border px-3 py-2"
            value={form.returnType}
            onChange={(e) =>
              setForm({ ...form, returnType: e.target.value as typeof form.returnType })
            }
          >
            {SALES_RETURN_TYPES.map((t) => (
              <option key={t} value={t}>
                {SALES_RETURN_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border px-3 py-2 sm:col-span-2"
            value={form.productId}
            onChange={(e) => {
              const item = posItems.find((i) => i.product_id === e.target.value);
              setForm({
                ...form,
                productId: e.target.value,
                productName: item?.product_name ?? "",
                rate: Number(item?.rate ?? 0),
              });
            }}
            required
          >
            <option value="">Select product</option>
            {posItems.map((i) => (
              <option key={i.id} value={i.product_id}>
                {i.product_name} — qty {i.quantity} @ {formatPrice(i.rate)}
              </option>
            ))}
          </select>
          <Input
            type="number"
            min={1}
            placeholder="Return qty"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
          />
          <Input
            type="number"
            placeholder="Rate"
            value={form.rate}
            onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })}
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
              <th>Customer</th>
              <th>Reason</th>
              <th>Type</th>
              <th>Amount</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-mono">{r.return_number}</td>
                <td className="p-3">{formatDate(r.return_date)}</td>
                <td className="p-3">{r.customer_name ?? r.customers?.name ?? "—"}</td>
                <td className="p-3">
                  {SALES_RETURN_REASON_LABELS[r.reason] ?? r.reason}
                </td>
                <td className="p-3">
                  {SALES_RETURN_TYPE_LABELS[r.return_type] ?? r.return_type}
                </td>
                <td className="p-3 font-medium">{formatPrice(r.total_amount)}</td>
                <td className="p-3 text-right">
                  <ActionButton
                    label="Edit return"
                    icon={Pencil}
                    onClick={() => openEdit(r)}
                  />
                </td>
              </tr>
            ))}
            {returns.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No sales returns yet
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
            <Button type="submit" form="edit-sales-return-form" disabled={saving}>
              Save Changes
            </Button>
          </div>
        }
      >
        <form id="edit-sales-return-form" onSubmit={handleEdit} className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Customer name"
            value={editForm.customerName}
            onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
          />
          <Input
            placeholder="Customer mobile"
            value={editForm.customerMobile}
            onChange={(e) => setEditForm({ ...editForm, customerMobile: e.target.value })}
          />
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
            {SALES_RETURN_REASONS.map((r) => (
              <option key={r} value={r}>
                {SALES_RETURN_REASON_LABELS[r]}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border px-3 py-2"
            value={editForm.returnType}
            onChange={(e) =>
              setEditForm({ ...editForm, returnType: e.target.value as typeof editForm.returnType })
            }
          >
            {SALES_RETURN_TYPES.map((t) => (
              <option key={t} value={t}>
                {SALES_RETURN_TYPE_LABELS[t]}
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
          <Input
            type="number"
            min={1}
            placeholder="Return qty"
            value={editForm.quantity}
            onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
          />
          <Input
            type="number"
            placeholder="Rate"
            value={editForm.rate}
            onChange={(e) => setEditForm({ ...editForm, rate: Number(e.target.value) })}
          />
        </form>
      </Modal>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { purchaseService, supplierService, inventoryService } from "@/services/erp";
import type { PurchaseBill, Supplier } from "@/types/erp";
import type { ErpProduct } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice, formatDate } from "@/utils/format";

export default function PurchasesPage() {
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ErpProduct[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    billNumber: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    supplierId: "",
    productId: "",
    quantity: 1,
    purchaseRate: 0,
    gstPercentage: 5,
  });

  const load = () => {
    purchaseService.list().then(setBills);
    supplierService.list().then(setSuppliers);
    inventoryService.listProducts().then(setProducts);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplierId || !form.productId) {
      toast.error("Select supplier and product");
      return;
    }
    try {
      await purchaseService.create({
        billNumber: form.billNumber || `PUR-${Date.now()}`,
        invoiceDate: form.invoiceDate,
        supplierId: form.supplierId,
        items: [
          {
            productId: form.productId,
            quantity: form.quantity,
            purchaseRate: form.purchaseRate,
            gstPercentage: form.gstPercentage,
          },
        ],
      });
      toast.success("Purchase recorded — stock updated");
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete purchase? Stock will be reversed.")) return;
    await purchaseService.delete(id);
    load();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Purchase Management</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-4 w-4" />
          Add Purchase
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Input
            placeholder="Bill number"
            value={form.billNumber}
            onChange={(e) => setForm({ ...form, billNumber: e.target.value })}
          />
          <Input
            type="date"
            value={form.invoiceDate}
            onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
          />
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
            value={form.productId}
            onChange={(e) => {
              const p = products.find((x) => x.id === e.target.value);
              setForm({
                ...form,
                productId: e.target.value,
                purchaseRate: Number(p?.purchase_price ?? 0),
                gstPercentage: Number(p?.gst_percentage ?? 5),
              });
            }}
            required
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Input
            type="number"
            placeholder="Quantity"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            min={1}
          />
          <Input
            type="number"
            placeholder="Purchase rate"
            value={form.purchaseRate}
            onChange={(e) => setForm({ ...form, purchaseRate: Number(e.target.value) })}
          />
          <Button type="submit" className="sm:col-span-2 lg:col-span-1">
            Save Purchase
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Bill #</th>
              <th>Date</th>
              <th>Supplier</th>
              <th>Total</th>
              <th>GST</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="p-3 font-mono">{b.bill_number}</td>
                <td className="p-3">{formatDate(b.invoice_date)}</td>
                <td className="p-3">{b.suppliers?.name ?? "—"}</td>
                <td className="p-3 font-medium">{formatPrice(b.total_amount)}</td>
                <td className="p-3">
                  {formatPrice(Number(b.cgst) + Number(b.sgst) + Number(b.igst))}
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="mr-2 text-gray-600"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(b.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

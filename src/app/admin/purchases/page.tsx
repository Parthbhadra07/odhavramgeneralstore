"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { purchaseService, supplierService, inventoryService } from "@/services/erp";
import type { PurchaseBill, Supplier } from "@/types/erp";
import type { ErpProduct } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/admin/form-field";
import { ResponsiveTable } from "@/components/admin/responsive-table";
import { ActionButton } from "@/components/admin/action-button";
import { AdminFab } from "@/components/admin/admin-fab";
import { Modal } from "@/components/admin/modal";
import { formatPrice, formatDate } from "@/utils/format";
import { printReceipt } from "@/components/erp/receipt-print";

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
  purchaseRate: 0,
  sellingPrice: 0,
  mrp: 0,
  gstPercentage: 5,
};

type FormErrors = Partial<Record<keyof typeof emptyForm, string>>;

function validateForm(form: typeof emptyForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.supplierId) errors.supplierId = "Select a supplier";
  if (!form.productId) errors.productId = "Select a product";
  if (!form.invoiceDate) errors.invoiceDate = "Purchase date is required";
  if (form.quantity < 1) errors.quantity = "Quantity must be at least 1";
  if (form.purchaseRate < 0) errors.purchaseRate = "Purchase rate cannot be negative";
  if (form.gstPercentage < 0 || form.gstPercentage > 100) {
    errors.gstPercentage = "GST must be between 0 and 100";
  }
  return errors;
}

export default function PurchasesPage() {
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ErpProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [viewBill, setViewBill] = useState<PurchaseBill | null>(null);
  const [editBill, setEditBill] = useState<PurchaseBill | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editItemId, setEditItemId] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

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
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleProductSelect = (productId: string, target: "create" | "edit") => {
    const p = products.find((x) => x.id === productId);
    const patch = {
      productId,
      barcode: p?.barcode ?? "",
      purchaseRate: Number(p?.purchase_price ?? 0),
      sellingPrice: Number(p?.selling_price ?? p?.price ?? 0),
      mrp: Number(p?.mrp ?? p?.price ?? 0),
      gstPercentage: Number(p?.gst_percentage ?? 5),
    };
    if (target === "create") setForm((f) => ({ ...f, ...patch }));
    else setEditForm((f) => ({ ...f, ...patch }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateForm(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      toast.error("Please fix form errors");
      return;
    }
    setSaving(true);
    try {
      await purchaseService.create({
        billNumber: form.billNumber.trim() || `PUR-${Date.now()}`,
        invoiceDate: form.invoiceDate,
        supplierId: form.supplierId,
        items: [
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
        ],
      });
      toast.success("Purchase recorded — stock updated");
      setShowForm(false);
      setForm(emptyForm);
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
      purchaseRate: Number(item.purchase_rate),
      sellingPrice: Number(item.selling_price ?? 0),
      mrp: Number(item.mrp ?? 0),
      gstPercentage: Number(item.gst_percentage),
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBill) return;
    const validation = validateForm(editForm);
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
      toast.success("Purchase updated — stock adjusted");
      setEditBill(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this purchase? Stock will be reversed.")) return;
    try {
      await purchaseService.delete(id);
      toast.success("Purchase deleted");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const printPurchase = (bill: PurchaseBill) => {
    const item = bill.purchase_items?.[0];
    const receiptHtml = document.createElement("div");
    receiptHtml.id = "purchase-print";
    receiptHtml.className = "thermal-receipt thermal-receipt-border mx-auto bg-white p-4 font-mono text-sm";
    receiptHtml.style.width = "80mm";
    receiptHtml.innerHTML = `
      <div style="text-align:center;font-weight:bold">PURCHASE INVOICE</div>
      <hr style="border-top:2px solid #000;margin:8px 0"/>
      <p><strong>Bill #:</strong> ${bill.bill_number}</p>
      <p><strong>Date:</strong> ${formatDate(bill.invoice_date)}</p>
      <p><strong>Supplier:</strong> ${bill.suppliers?.name ?? "—"}</p>
      <hr style="border-top:1px dashed #000;margin:8px 0"/>
      <p><strong>Product:</strong> ${item?.products?.name ?? "—"}</p>
      <p><strong>Barcode:</strong> ${item?.barcode ?? "—"}</p>
      <p><strong>Lot:</strong> ${item?.lot_number ?? "—"}</p>
      <p><strong>Batch:</strong> ${item?.batch_number ?? "—"}</p>
      <p><strong>Qty:</strong> ${item?.quantity ?? 0}</p>
      <p><strong>Rate:</strong> ${formatPrice(item?.purchase_rate ?? 0)}</p>
      <hr style="border-top:2px solid #000;margin:8px 0"/>
      <p style="display:flex;justify-content:space-between;font-weight:bold">
        <span>TOTAL</span><span>${formatPrice(bill.total_amount)}</span>
      </p>
    `;
    document.body.appendChild(receiptHtml);
    printReceipt("purchase-print", "80mm");
    document.body.removeChild(receiptHtml);
  };

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }));
  const productOptions = products.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="admin-page-title">Purchase Management</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Record purchases with lot/barcode tracking
          </p>
        </div>
        <Button onClick={openAddForm} className="hidden lg:inline-flex">
          <Plus className="mr-1 h-4 w-4" />
          Add Purchase
        </Button>
      </div>

      <AdminFab label="Add Purchase" icon={Plus} onClick={openAddForm} />

      {showForm && (
        <div ref={formRef} className="admin-card mb-6 p-4 sm:p-6">
          <h2 className="admin-section-title mb-4">New Purchase</h2>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Bill Number"
              placeholder="e.g. PUR-2026-001"
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
              label="Supplier"
              value={form.supplierId}
              onChange={(v) => setForm({ ...form, supplierId: v })}
              options={supplierOptions}
              placeholder="Select supplier"
              error={errors.supplierId}
              required
            />
            <SelectField
              label="Product"
              value={form.productId}
              onChange={(v) => handleProductSelect(v, "create")}
              options={productOptions}
              placeholder="Select product"
              error={errors.productId}
              required
            />
            <Input
              label="Barcode"
              placeholder="8901234567890"
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            />
            <Input
              label="Lot Number"
              placeholder="LOT-A"
              value={form.lotNumber}
              onChange={(e) => setForm({ ...form, lotNumber: e.target.value })}
            />
            <Input
              label="Batch Number"
              placeholder="BATCH-001"
              value={form.batchNumber}
              onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
            />
            <Input
              label="Expiry Date"
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
            />
            <Input
              label="Quantity"
              type="number"
              min={1}
              placeholder="1"
              value={form.quantity}
              error={errors.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
            <Input
              label="Purchase Rate"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={form.purchaseRate}
              error={errors.purchaseRate}
              onChange={(e) => setForm({ ...form, purchaseRate: Number(e.target.value) })}
            />
            <Input
              label="MRP"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={form.mrp}
              onChange={(e) => setForm({ ...form, mrp: Number(e.target.value) })}
            />
            <Input
              label="Selling Price"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={form.sellingPrice}
              onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
            />
            <Input
              label="GST %"
              type="number"
              min={0}
              max={100}
              placeholder="5"
              value={form.gstPercentage}
              error={errors.gstPercentage}
              onChange={(e) => setForm({ ...form, gstPercentage: Number(e.target.value) })}
            />
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" loading={saving}>
                Save Purchase
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

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
            cell: (b) => <span className="font-mono font-medium">{b.bill_number}</span>,
          },
          {
            key: "date",
            header: "Date",
            cell: (b) => formatDate(b.invoice_date),
          },
          {
            key: "supplier",
            header: "Supplier",
            cell: (b) => b.suppliers?.name ?? "—",
          },
          {
            key: "product",
            header: "Product",
            hideOnMobile: true,
            cell: (b) => b.purchase_items?.[0]?.products?.name ?? "—",
          },
          {
            key: "total",
            header: "Total",
            cell: (b) => (
              <span className="font-semibold text-green-800 dark:text-green-400">
                {formatPrice(b.total_amount)}
              </span>
            ),
          },
          {
            key: "gst",
            header: "GST",
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

      {/* View modal */}
      <Modal
        open={!!viewBill}
        onClose={() => setViewBill(null)}
        title={`Purchase — ${viewBill?.bill_number ?? ""}`}
      >
        {viewBill && (
          <div className="space-y-3 text-sm">
            <p><strong>Date:</strong> {formatDate(viewBill.invoice_date)}</p>
            <p><strong>Supplier:</strong> {viewBill.suppliers?.name ?? "—"}</p>
            <p><strong>Total:</strong> {formatPrice(viewBill.total_amount)}</p>
            {viewBill.purchase_items?.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 dark:border-gray-700">
                <p><strong>Product:</strong> {item.products?.name ?? "—"}</p>
                <p><strong>Barcode:</strong> {item.barcode ?? "—"}</p>
                <p><strong>Lot:</strong> {item.lot_number ?? "—"}</p>
                <p><strong>Batch:</strong> {item.batch_number ?? "—"}</p>
                <p><strong>Qty:</strong> {item.quantity}</p>
                <p><strong>Rate:</strong> {formatPrice(item.purchase_rate)}</p>
                <p><strong>Expiry:</strong> {item.expiry_date ? formatDate(item.expiry_date) : "—"}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editBill}
        onClose={() => setEditBill(null)}
        title="Edit Purchase"
        footer={
          <div className="flex gap-2">
            <Button onClick={handleEdit} loading={saving}>
              Update Purchase
            </Button>
            <Button variant="outline" onClick={() => setEditBill(null)}>
              Cancel
            </Button>
          </div>
        }
      >
        <form onSubmit={handleEdit} className="grid gap-4 sm:grid-cols-2">
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
          <Input
            label="Barcode"
            value={editForm.barcode}
            onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
          />
          <Input
            label="Lot Number"
            value={editForm.lotNumber}
            onChange={(e) => setEditForm({ ...editForm, lotNumber: e.target.value })}
          />
          <Input
            label="Batch Number"
            value={editForm.batchNumber}
            onChange={(e) => setEditForm({ ...editForm, batchNumber: e.target.value })}
          />
          <Input
            label="Expiry Date"
            type="date"
            value={editForm.expiryDate}
            onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
          />
          <Input
            label="Quantity"
            type="number"
            min={1}
            value={editForm.quantity}
            onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
          />
          <Input
            label="Purchase Rate"
            type="number"
            min={0}
            value={editForm.purchaseRate}
            onChange={(e) => setEditForm({ ...editForm, purchaseRate: Number(e.target.value) })}
          />
          <Input
            label="Selling Price"
            type="number"
            min={0}
            value={editForm.sellingPrice}
            onChange={(e) => setEditForm({ ...editForm, sellingPrice: Number(e.target.value) })}
          />
          <Input
            label="MRP"
            type="number"
            min={0}
            value={editForm.mrp}
            onChange={(e) => setEditForm({ ...editForm, mrp: Number(e.target.value) })}
          />
        </form>
      </Modal>
    </div>
  );
}

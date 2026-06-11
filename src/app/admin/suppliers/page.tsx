"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Plus } from "lucide-react";
import { toast } from "sonner";
import { supplierService } from "@/services/erp";
import type { SupplierWithStats } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveTable } from "@/components/admin/responsive-table";
import { ActionButton } from "@/components/admin/action-button";
import { AdminFab } from "@/components/admin/admin-fab";
import { Modal } from "@/components/admin/modal";
import { formatPrice, formatDate } from "@/utils/format";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [ledgerSupplier, setLedgerSupplier] = useState<SupplierWithStats | null>(null);
  const [ledger, setLedger] = useState<
    { date: string; type: string; reference: string; debit: number; credit: number }[]
  >([]);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    gst_number: "",
    address: "",
    email: "",
  });
  const [payForm, setPayForm] = useState({ supplierId: "", amount: 0 });
  const formRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    supplierService.listWithStats().then(setSuppliers).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openForm = () => {
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    try {
      await supplierService.upsert(form);
      toast.success("Supplier added");
      setForm({ name: "", mobile: "", gst_number: "", address: "", email: "" });
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm.supplierId || payForm.amount <= 0) {
      toast.error("Select supplier and enter amount");
      return;
    }
    try {
      await supplierService.recordPayment({
        supplierId: payForm.supplierId,
        amount: payForm.amount,
        paymentMethod: "cash",
      });
      toast.success("Payment recorded");
      setPayForm({ supplierId: "", amount: 0 });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const viewLedger = async (supplier: SupplierWithStats) => {
    setLedgerSupplier(supplier);
    const entries = await supplierService.getLedger(supplier.id);
    setLedger(entries);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="admin-page-title">Supplier Management</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Track suppliers, outstanding, and purchase history
          </p>
        </div>
        <Button onClick={openForm} className="hidden lg:inline-flex">
          <Plus className="mr-1 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      <AdminFab label="Add Supplier" icon={Plus} onClick={openForm} />

      {showForm && (
        <div ref={formRef} className="admin-card mb-6 p-4 sm:p-6">
          <h2 className="admin-section-title mb-4">Add Supplier</h2>
          <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Supplier Name"
              placeholder="Company name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Mobile"
              placeholder="Contact number"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            />
            <Input
              label="GST Number"
              placeholder="GSTIN"
              value={form.gst_number}
              onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              placeholder="email@supplier.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Address"
              placeholder="Full address"
              className="sm:col-span-2"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit">Add Supplier</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <form
        onSubmit={handlePayment}
        className="admin-card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-sm font-medium">Record Payment</label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            value={payForm.supplierId}
            onChange={(e) => setPayForm({ ...payForm, supplierId: e.target.value })}
            required
          >
            <option value="">Select supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Amount"
          type="number"
          min={0}
          placeholder="0.00"
          value={payForm.amount || ""}
          onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
          className="sm:w-40"
        />
        <Button type="submit" variant="outline">
          Record Payment
        </Button>
      </form>

      <ResponsiveTable
        loading={loading}
        data={suppliers}
        keyExtractor={(s) => s.id}
        emptyMessage="No suppliers added yet."
        columns={[
          {
            key: "name",
            header: "Name",
            mobilePrimary: true,
            cell: (s) => <span className="font-medium">{s.name}</span>,
          },
          { key: "mobile", header: "Mobile", cell: (s) => s.mobile ?? "—" },
          {
            key: "gst",
            header: "GST",
            hideOnMobile: true,
            cell: (s) => (
              <span className="font-mono text-xs">{s.gst_number ?? "—"}</span>
            ),
          },
          {
            key: "outstanding",
            header: "Outstanding",
            cell: (s) => (
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                {formatPrice(s.outstanding_amount)}
              </span>
            ),
          },
          {
            key: "purchases",
            header: "Total Purchases",
            cell: (s) => formatPrice(s.total_purchases),
          },
          {
            key: "count",
            header: "Purchase Count",
            hideOnMobile: true,
            cell: (s) => s.purchase_count,
          },
          {
            key: "last",
            header: "Last Purchase",
            cell: (s) =>
              s.last_purchase_date ? formatDate(s.last_purchase_date) : "—",
          },
        ]}
        actions={(s) => (
          <ActionButton
            icon={Eye}
            label="View Ledger"
            onClick={() => viewLedger(s)}
            variant="primary"
          />
        )}
      />

      <Modal
        open={!!ledgerSupplier}
        onClose={() => setLedgerSupplier(null)}
        title={`Ledger — ${ledgerSupplier?.name ?? ""}`}
        size="lg"
      >
        <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          Outstanding:{" "}
          <strong>{formatPrice(ledgerSupplier?.outstanding_amount ?? 0)}</strong>
        </div>
        <div className="space-y-2">
          {ledger.map((entry, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm dark:border-gray-700"
            >
              <div>
                <p className="font-medium capitalize">{entry.type}</p>
                <p className="text-gray-500">{formatDate(entry.date)} · {entry.reference}</p>
              </div>
              <div className="text-right">
                {entry.debit > 0 && (
                  <p className="text-red-600">+{formatPrice(entry.debit)}</p>
                )}
                {entry.credit > 0 && (
                  <p className="text-green-600">−{formatPrice(entry.credit)}</p>
                )}
              </div>
            </div>
          ))}
          {ledger.length === 0 && (
            <p className="text-center text-gray-500">No ledger entries yet.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

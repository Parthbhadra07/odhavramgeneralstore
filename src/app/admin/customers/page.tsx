"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Plus } from "lucide-react";
import { toast } from "sonner";
import { creditService, customerService } from "@/services/erp";
import type { CreditLedgerEntry, CustomerWithStats } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveTable } from "@/components/admin/responsive-table";
import { ActionButton } from "@/components/admin/action-button";
import { AdminFab } from "@/components/admin/admin-fab";
import { Modal } from "@/components/admin/modal";
import { formatPrice, formatDate } from "@/utils/format";
import { isValidMobile } from "@/utils/phone";
import { POS_PAYMENT_LABELS, type PosPaymentMethod } from "@/lib/erp/constants";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [ledgerCustomer, setLedgerCustomer] = useState<CustomerWithStats | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    email: "",
    address: "",
    gst_number: "",
  });
  const [payForm, setPayForm] = useState({
    customerId: "",
    amount: 0,
    paymentMethod: "cash" as PosPaymentMethod,
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    customerService
      .listWithStats(search || undefined)
      .then(setCustomers)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [search]);

  const openForm = () => {
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Name is required";
    if (!form.mobile.trim()) nextErrors.mobile = "Mobile is required";
    else if (!isValidMobile(form.mobile)) nextErrors.mobile = "Enter a valid 10-digit mobile";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await customerService.upsert({
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        gst_number: form.gst_number.trim() || null,
      });
      toast.success("Customer saved");
      setForm({ name: "", mobile: "", email: "", address: "", gst_number: "" });
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm.customerId || payForm.amount <= 0) {
      toast.error("Select customer and enter amount");
      return;
    }
    try {
      const customerId = payForm.customerId;
      await creditService.recordPayment(
        customerId,
        payForm.amount,
        POS_PAYMENT_LABELS[payForm.paymentMethod],
        payForm.notes.trim() || undefined
      );
      toast.success("Credit payment recorded");
      setPayForm({ customerId: "", amount: 0, paymentMethod: "cash", notes: "" });
      load();
      if (ledgerCustomer?.id === customerId) {
        const entries = await creditService.getLedger(customerId);
        setLedger(entries);
        const updated = customers.find((c) => c.id === customerId);
        if (updated) {
          setLedgerCustomer({
            ...updated,
            credit_balance: Math.max(0, updated.credit_balance - payForm.amount),
          });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const viewLedger = async (customer: CustomerWithStats) => {
    setLedgerCustomer(customer);
    const entries = await creditService.getLedger(customer.id);
    setLedger(entries);
  };

  const customersWithCredit = customers.filter((c) => c.credit_balance > 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="admin-page-title">Customer Management</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            CRM, loyalty points, and credit (udhaar) tracking
          </p>
        </div>
        <Button onClick={openForm} className="hidden lg:inline-flex">
          <Plus className="mr-1 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <AdminFab label="Add Customer" icon={Plus} onClick={openForm} />

      {showForm && (
        <div ref={formRef} className="admin-card mb-6 p-4 sm:p-6">
          <h2 className="admin-section-title mb-4">Add Customer</h2>
          <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Name"
              placeholder="Customer name"
              value={form.name}
              error={errors.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Mobile"
              placeholder="10-digit mobile"
              value={form.mobile}
              error={errors.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="email@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="GST Number (B2B)"
              placeholder="Optional"
              value={form.gst_number}
              onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
            />
            <Input
              label="Address"
              placeholder="Full address"
              className="sm:col-span-2"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit">Save Customer</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <form
        onSubmit={handlePayment}
        className="admin-card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
      >
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="mb-1 block text-sm font-medium">Record Credit Payment</label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            value={payForm.customerId}
            onChange={(e) => setPayForm({ ...payForm, customerId: e.target.value })}
            required
          >
            <option value="">Select customer</option>
            {(customersWithCredit.length ? customersWithCredit : customers).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {formatPrice(c.credit_balance)} due
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Amount"
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          value={payForm.amount || ""}
          onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
        />
        <div>
          <label className="mb-1 block text-sm font-medium">Payment Method</label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            value={payForm.paymentMethod}
            onChange={(e) =>
              setPayForm({
                ...payForm,
                paymentMethod: e.target.value as PosPaymentMethod,
              })
            }
          >
            {(["cash", "upi", "card"] as PosPaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {POS_PAYMENT_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Notes"
          placeholder="Optional"
          value={payForm.notes}
          onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
        />
        <Button type="submit" variant="outline" className="lg:mb-0.5">
          Record Payment
        </Button>
      </form>

      <Input
        label="Search"
        placeholder="Search by name or mobile..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-md"
      />

      <ResponsiveTable
        loading={loading}
        data={customers}
        keyExtractor={(c) => c.id}
        emptyMessage="No customers found."
        columns={[
          {
            key: "name",
            header: "Name",
            mobilePrimary: true,
            cell: (c) => <span className="font-medium">{c.name}</span>,
          },
          { key: "mobile", header: "Mobile", cell: (c) => c.mobile },
          {
            key: "credit",
            header: "Credit Due",
            cell: (c) => (
              <span
                className={
                  c.credit_balance > 0
                    ? "font-semibold text-amber-700 dark:text-amber-400"
                    : "text-gray-500"
                }
              >
                {formatPrice(c.credit_balance)}
              </span>
            ),
          },
          {
            key: "email",
            header: "Email",
            hideOnMobile: true,
            cell: (c) => c.email ?? "—",
          },
          {
            key: "since",
            header: "Customer Since",
            hideOnMobile: true,
            cell: (c) => formatDate(c.created_at),
          },
          {
            key: "last",
            header: "Last Order",
            hideOnMobile: true,
            cell: (c) => (c.last_order_date ? formatDate(c.last_order_date) : "—"),
          },
          {
            key: "orders",
            header: "Orders",
            hideOnMobile: true,
            cell: (c) => c.total_orders,
          },
          {
            key: "value",
            header: "Lifetime Value",
            cell: (c) => (
              <span className="font-semibold text-green-800 dark:text-green-400">
                {formatPrice(c.total_purchase_amount)}
              </span>
            ),
          },
          {
            key: "loyalty",
            header: "Loyalty",
            hideOnMobile: true,
            cell: (c) => c.loyalty_points,
          },
        ]}
        actions={(c) => (
          <ActionButton
            icon={Eye}
            label="Credit Ledger"
            onClick={() => viewLedger(c)}
            variant="primary"
          />
        )}
      />

      <Modal
        open={!!ledgerCustomer}
        onClose={() => setLedgerCustomer(null)}
        title={`Credit Ledger — ${ledgerCustomer?.name ?? ""}`}
        size="lg"
      >
        <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          Credit Due:{" "}
          <strong>{formatPrice(ledgerCustomer?.credit_balance ?? 0)}</strong>
        </div>
        <div className="space-y-2">
          {ledger.map((entry, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm dark:border-gray-700"
            >
              <div>
                <p className="font-medium capitalize">{entry.type}</p>
                <p className="text-gray-500">
                  {formatDate(entry.date)} · {entry.description}
                </p>
                {entry.notes && (
                  <p className="text-xs text-gray-500">{entry.notes}</p>
                )}
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
            <p className="text-center text-gray-500">No credit entries yet.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

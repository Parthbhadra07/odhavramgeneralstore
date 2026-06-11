"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { customerService } from "@/services/erp";
import type { CustomerWithStats } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveTable } from "@/components/admin/responsive-table";
import { AdminFab } from "@/components/admin/admin-fab";
import { formatPrice, formatDate } from "@/utils/format";
import { isValidMobile } from "@/utils/phone";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    email: "",
    address: "",
    gst_number: "",
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

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="admin-page-title">Customer Management</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            CRM records auto-created on signup and orders
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
            key: "email",
            header: "Email",
            hideOnMobile: true,
            cell: (c) => c.email ?? "—",
          },
          {
            key: "since",
            header: "Customer Since",
            cell: (c) => formatDate(c.created_at),
          },
          {
            key: "last",
            header: "Last Order",
            cell: (c) => (c.last_order_date ? formatDate(c.last_order_date) : "—"),
          },
          {
            key: "orders",
            header: "Total Orders",
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
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { supplierService } from "@/services/erp";
import type { Supplier } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/utils/format";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    gst_number: "",
    address: "",
    email: "",
  });
  const [payForm, setPayForm] = useState({ supplierId: "", amount: 0 });

  const load = () => supplierService.list().then(setSuppliers);

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await supplierService.upsert(form);
    setForm({ name: "", mobile: "", gst_number: "", address: "", email: "" });
    load();
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    await supplierService.recordPayment({
      supplierId: payForm.supplierId,
      amount: payForm.amount,
      paymentMethod: "cash",
    });
    setPayForm({ supplierId: "", amount: 0 });
    load();
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Supplier Management</h1>

      <form onSubmit={handleSave} className="mb-6 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
        <Input
          placeholder="Supplier name *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          placeholder="Mobile"
          value={form.mobile}
          onChange={(e) => setForm({ ...form, mobile: e.target.value })}
        />
        <Input
          placeholder="GST number"
          value={form.gst_number}
          onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
        />
        <Input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          placeholder="Address"
          className="sm:col-span-2"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <Button type="submit">Add Supplier</Button>
      </form>

      <form onSubmit={handlePayment} className="mb-6 flex flex-wrap gap-2 rounded-xl border bg-green-50 p-4">
        <select
          className="rounded-lg border px-3 py-2"
          value={payForm.supplierId}
          onChange={(e) => setPayForm({ ...payForm, supplierId: e.target.value })}
          required
        >
          <option value="">Pay supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Input
          type="number"
          placeholder="Amount"
          value={payForm.amount || ""}
          onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
        />
        <Button type="submit" variant="outline">
          Record Payment
        </Button>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th>Mobile</th>
              <th>GST</th>
              <th>Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3">{s.mobile ?? "—"}</td>
                <td className="p-3 font-mono text-xs">{s.gst_number ?? "—"}</td>
                <td className="p-3 text-amber-700">{formatPrice(s.outstanding_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

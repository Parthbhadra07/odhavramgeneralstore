"use client";

import { useEffect, useState } from "react";
import { customerService } from "@/services/erp";
import type { Customer } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    address: "",
    gst_number: "",
  });

  const load = () => customerService.list(search || undefined).then(setCustomers);

  useEffect(() => {
    load();
  }, [search]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await customerService.upsert(form);
    setForm({ name: "", mobile: "", address: "", gst_number: "" });
    load();
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Customer Management</h1>

      <form onSubmit={handleSave} className="mb-6 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
        <Input
          placeholder="Name *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          placeholder="Mobile *"
          value={form.mobile}
          onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          required
        />
        <Input
          placeholder="Address"
          className="sm:col-span-2"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <Input
          placeholder="GST number (B2B)"
          value={form.gst_number}
          onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
        />
        <Button type="submit">Save Customer</Button>
      </form>

      <Input
        placeholder="Search customers..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-md"
      />

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th>Mobile</th>
              <th>Loyalty Points</th>
              <th>Credit Balance</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.mobile}</td>
                <td className="p-3 text-green-700">{c.loyalty_points}</td>
                <td className="p-3">₹{Number(c.credit_balance).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

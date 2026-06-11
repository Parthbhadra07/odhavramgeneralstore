"use client";

import { useEffect, useState } from "react";
import { Save, Settings } from "lucide-react";
import { toast } from "sonner";
import { settingsService } from "@/services/erp";
import type { StoreSettings } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    store_name: "",
    store_mobile: "",
    store_address: "",
    store_logo_url: "",
    upi_id: "",
    upi_merchant_name: "",
    enable_upi_qr: false,
    receipt_header_text: "",
    receipt_footer_text: "",
    receipt_width: "80mm" as "58mm" | "80mm",
  });

  useEffect(() => {
    settingsService.get().then((s: StoreSettings) => {
      setForm({
        store_name: s.store_name,
        store_mobile: s.store_mobile,
        store_address: s.store_address ?? "",
        store_logo_url: s.store_logo_url ?? "",
        upi_id: s.upi_id ?? "",
        upi_merchant_name: s.upi_merchant_name ?? "",
        enable_upi_qr: s.enable_upi_qr,
        receipt_header_text: s.receipt_header_text ?? "",
        receipt_footer_text: s.receipt_footer_text ?? "",
        receipt_width: s.receipt_width,
      });
      setLoading(false);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsService.update({
        store_name: form.store_name.trim(),
        store_mobile: form.store_mobile.trim(),
        store_address: form.store_address.trim() || null,
        store_logo_url: form.store_logo_url.trim() || null,
        upi_id: form.upi_id.trim() || null,
        upi_merchant_name: form.upi_merchant_name.trim() || null,
        enable_upi_qr: form.enable_upi_qr,
        receipt_header_text: form.receipt_header_text.trim() || null,
        receipt_footer_text: form.receipt_footer_text.trim() || null,
        receipt_width: form.receipt_width,
      });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="p-8">Loading settings...</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Store Settings</h1>
          <p className="text-sm text-gray-600">
            Configure store details, receipts, and UPI payments
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">Store Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Store Name</label>
              <Input
                value={form.store_name}
                onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Mobile Number</label>
              <Input
                value={form.store_mobile}
                onChange={(e) => setForm({ ...form, store_mobile: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Logo URL</label>
              <Input
                placeholder="https://..."
                value={form.store_logo_url}
                onChange={(e) => setForm({ ...form, store_logo_url: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Store Address</label>
              <textarea
                value={form.store_address}
                onChange={(e) => setForm({ ...form, store_address: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                rows={3}
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">UPI Payment</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">UPI ID</label>
              <Input
                placeholder="merchant@upi"
                value={form.upi_id}
                onChange={(e) => setForm({ ...form, upi_id: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Merchant Name</label>
              <Input
                placeholder="Odhavram General Store"
                value={form.upi_merchant_name}
                onChange={(e) =>
                  setForm({ ...form, upi_merchant_name: e.target.value })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.enable_upi_qr}
                  onChange={(e) =>
                    setForm({ ...form, enable_upi_qr: e.target.checked })
                  }
                  className="rounded"
                />
                Enable UPI QR on receipts
              </label>
              <p className="mt-1 text-xs text-gray-500">
                Generates QR from upi://pay?pa=...&pn=...&am=... when enabled
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">Receipt Settings</h2>
          <div className="grid gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Header Text</label>
              <Input
                placeholder="Thank You! Visit Again"
                value={form.receipt_header_text}
                onChange={(e) =>
                  setForm({ ...form, receipt_header_text: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Footer Text</label>
              <Input
                placeholder="Store name and contact"
                value={form.receipt_footer_text}
                onChange={(e) =>
                  setForm({ ...form, receipt_footer_text: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Default Printer Width</label>
              <select
                value={form.receipt_width}
                onChange={(e) =>
                  setForm({
                    ...form,
                    receipt_width: e.target.value as "58mm" | "80mm",
                  })
                }
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="58mm">58mm (small thermal)</option>
                <option value="80mm">80mm (standard thermal)</option>
              </select>
            </div>
          </div>
        </section>

        <Button type="submit" loading={saving} className="w-full sm:w-auto">
          <Save className="mr-1 h-4 w-4" />
          Save Settings
        </Button>
      </form>
    </div>
  );
}

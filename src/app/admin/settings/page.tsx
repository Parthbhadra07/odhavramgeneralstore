"use client";

import { useEffect, useState } from "react";
import {
  Save,
  Settings,
  Printer,
  Calendar,
  Award,
} from "lucide-react";
import {
  getFinancialYearList,
  getFinancialYear,
  setActiveFinancialYearCode,
  formatFiscalBillNumber,
} from "@/utils/financial-year";
import {
  getAutoPrintPreference,
  getPrinterName,
  setAutoPrintPreference,
  setLocalReceiptWidth,
  setPrinterName,
  RECEIPT_WIDTH_OPTIONS,
  type ReceiptWidth,
} from "@/utils/printer-prefs";
import {
  BARCODE_FONT_OPTIONS,
  BARCODE_PAPER_OPTIONS,
  getBarcodePrinterPrefs,
  PRINT_DENSITY_OPTIONS,
  setBarcodePrinterPrefs,
} from "@/utils/barcode-printer-prefs";
import { toast } from "sonner";
import { settingsService } from "@/services/erp";
import type {
  BarcodeFontFamily,
  BarcodePaperType,
  PrintDensity,
  StoreSettings,
} from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BluetoothPrinterPanel } from "@/components/admin/bluetooth-printer-panel";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    store_name: "",
    store_mobile: "",
    store_address: "",
    store_logo_url: "",
    gst_number: "",
    currency: "INR",
    default_gst_percentage: 5,
    upi_id: "",
    upi_merchant_name: "",
    enable_upi_qr: false,
    receipt_header_text: "",
    receipt_footer_text: "",
    receipt_width: "80mm" as ReceiptWidth,
    printer_name: "",
    auto_print: true,
    barcode_paper: "roll58" as BarcodePaperType,
    barcode_density: "normal" as PrintDensity,
    barcode_font: "courier" as BarcodeFontFamily,
    barcode_font_size: 10,
    receipt_font_size: 11,
    active_financial_year: "auto",
    enable_loyalty_points: true,
    loyalty_point_value: 1,
    loyalty_points_per_100: 1,
    loyalty_min_points_redeem: 0,
  });

  useEffect(() => {
    settingsService.get().then((s: StoreSettings) => {
      setForm({
        store_name: s.store_name,
        store_mobile: s.store_mobile,
        store_address: s.store_address ?? "",
        store_logo_url: s.store_logo_url ?? "",
        gst_number: s.gst_number ?? "",
        currency: s.currency ?? "INR",
        default_gst_percentage: Number(s.default_gst_percentage ?? 5),
        upi_id: s.upi_id ?? "",
        upi_merchant_name: s.upi_merchant_name ?? "",
        enable_upi_qr: s.enable_upi_qr,
        receipt_header_text: s.receipt_header_text ?? "",
        receipt_footer_text: s.receipt_footer_text ?? "",
        receipt_width: s.receipt_width,
        printer_name: getPrinterName(),
        auto_print: getAutoPrintPreference(),
        barcode_paper: getBarcodePrinterPrefs().paperType,
        barcode_density: getBarcodePrinterPrefs().printDensity,
        barcode_font: getBarcodePrinterPrefs().fontFamily,
        barcode_font_size: getBarcodePrinterPrefs().fontSize,
        receipt_font_size: getBarcodePrinterPrefs().receiptFontSize,
        active_financial_year: s.active_financial_year ?? "auto",
        enable_loyalty_points: s.enable_loyalty_points ?? true,
        loyalty_point_value: Number(s.loyalty_point_value ?? 1),
        loyalty_points_per_100: Number(s.loyalty_points_per_100 ?? 1),
        loyalty_min_points_redeem: Number(s.loyalty_min_points_redeem ?? 0),
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
        gst_number: form.gst_number.trim() || null,
        currency: form.currency.trim() || "INR",
        default_gst_percentage: form.default_gst_percentage,
        upi_id: form.upi_id.trim() || null,
        upi_merchant_name: form.upi_merchant_name.trim() || null,
        enable_upi_qr: form.enable_upi_qr,
        receipt_header_text: form.receipt_header_text.trim() || null,
        receipt_footer_text: form.receipt_footer_text.trim() || null,
        receipt_width: form.receipt_width,
        active_financial_year: form.active_financial_year,
        enable_loyalty_points: form.enable_loyalty_points,
        loyalty_point_value: form.loyalty_point_value,
        loyalty_points_per_100: form.loyalty_points_per_100,
        loyalty_min_points_redeem: form.loyalty_min_points_redeem,
      });
      setActiveFinancialYearCode(form.active_financial_year);
      setLocalReceiptWidth(form.receipt_width);
      setPrinterName(form.printer_name);
      setAutoPrintPreference(form.auto_print);
      setBarcodePrinterPrefs({
        paperType: form.barcode_paper,
        printDensity: form.barcode_density,
        fontFamily: form.barcode_font,
        fontSize: form.barcode_font_size,
        receiptFontSize: form.receipt_font_size,
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
              <label className="mb-1 block text-sm font-medium">GST Number</label>
              <Input
                placeholder="22AAAAA0000A1Z5"
                value={form.gst_number}
                onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Default GST %</label>
              <Input
                type="number"
                min={0}
                max={28}
                value={form.default_gst_percentage}
                onChange={(e) => setForm({ ...form, default_gst_percentage: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Currency</label>
              <Input
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
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
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-green-700" />
            <div>
              <h2 className="font-semibold text-gray-900">Financial Year & Billing Configuration</h2>
              <p className="text-xs text-gray-500">
                Indian Financial Year (April 1 to March 31) controls invoice numbering and sequence resets
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Active Financial Year</label>
              <select
                value={form.active_financial_year}
                onChange={(e) => setForm({ ...form, active_financial_year: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
              >
                <option value="auto">Auto / System (Current: FY {getFinancialYear().code})</option>
                {getFinancialYearList(2, 1).map((fy) => (
                  <option key={fy.code} value={fy.code}>
                    {fy.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-gray-500">
                Select a specific financial year or keep Auto to calculate automatically.
              </p>
            </div>

            <div className="rounded-lg border bg-green-50/50 p-3.5 space-y-1.5 text-xs">
              <p className="font-semibold text-green-900 flex items-center justify-between">
                <span>Active Period: {getFinancialYear(form.active_financial_year !== "auto" ? form.active_financial_year : undefined).label}</span>
                <span className="rounded bg-green-200 px-1.5 py-0.5 text-[10px] text-green-900 font-bold">
                  {getFinancialYear(form.active_financial_year !== "auto" ? form.active_financial_year : undefined).quarterLabel}
                </span>
              </p>
              <p className="text-gray-600">
                Dates: <span className="font-medium text-gray-900">01-Apr-{getFinancialYear(form.active_financial_year !== "auto" ? form.active_financial_year : undefined).startYear}</span> to <span className="font-medium text-gray-900">31-Mar-{getFinancialYear(form.active_financial_year !== "auto" ? form.active_financial_year : undefined).endYear}</span>
              </p>
              <p className="text-gray-600">
                Invoice Number Preview:{" "}
                <span className="font-mono font-bold text-green-800">
                  {formatFiscalBillNumber(1, form.active_financial_year !== "auto" ? form.active_financial_year : undefined)}
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* LOYALTY PROGRAM CONFIGURATION */}
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-5 w-5 text-green-700" />
            <div>
              <h2 className="font-semibold text-gray-900">Loyalty Points & Rewards Program</h2>
              <p className="text-xs text-gray-500">
                Reward repeat customers on both in-store POS billing and online web purchases
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-slate-50 p-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Enable Customer Loyalty Program</p>
                <p className="text-xs text-gray-500">
                  When enabled, customers accumulate points on purchases and can redeem them for bill discounts.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={form.enable_loyalty_points}
                  onChange={(e) => setForm({ ...form, enable_loyalty_points: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
              </label>
            </div>

            {form.enable_loyalty_points && (
              <div className="grid gap-4 sm:grid-cols-3 pt-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Point Value (₹ discount per 1 point)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min={0.1}
                    placeholder="1.00"
                    value={form.loyalty_point_value}
                    onChange={(e) =>
                      setForm({ ...form, loyalty_point_value: Number(e.target.value) || 1 })
                    }
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    e.g. 1 point = ₹{form.loyalty_point_value.toFixed(2)} off on the bill
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Points Earned per ₹100 spent
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    min={0}
                    placeholder="1"
                    value={form.loyalty_points_per_100}
                    onChange={(e) =>
                      setForm({ ...form, loyalty_points_per_100: Number(e.target.value) || 0 })
                    }
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    A ₹1,000 bill awards {Math.floor(1000 / 100 * form.loyalty_points_per_100)} points
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Min Points to Redeem
                  </label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={form.loyalty_min_points_redeem}
                    onChange={(e) =>
                      setForm({ ...form, loyalty_min_points_redeem: Number(e.target.value) || 0 })
                    }
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Minimum points a customer must have before redeeming
                  </p>
                </div>
              </div>
            )}
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
                Shows on all bills (except COD). Configure UPI ID above and enable this option.
              </p>
            </div>
          </div>
        </section>

        <section id="printer" className="rounded-xl border bg-white p-6 shadow-sm scroll-mt-20">
          <div className="mb-4 flex items-center gap-2">
            <Printer className="h-5 w-5 text-green-700" />
            <h2 className="font-semibold">Printer Settings</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Thermal Paper Width</label>
              <select
                value={form.receipt_width}
                onChange={(e) =>
                  setForm({
                    ...form,
                    receipt_width: e.target.value as ReceiptWidth,
                  })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                {RECEIPT_WIDTH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Used for POS receipts, order bills, and sales history reprints.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Printer Name (optional)</label>
              <Input
                placeholder="e.g. TVS RP 3200, Epson TM-T82"
                value={form.printer_name}
                onChange={(e) => setForm({ ...form, printer_name: e.target.value })}
              />
              <p className="mt-1 text-xs text-gray-500">
                Select this printer in the browser print dialog when printing receipts.
              </p>
            </div>
            <div className="sm:col-span-2">
              <BluetoothPrinterPanel />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.auto_print}
                  onChange={(e) => setForm({ ...form, auto_print: e.target.checked })}
                  className="rounded"
                />
                Auto-print when using Pay &amp; Print (F9) on POS
              </label>
            </div>
          </div>

          <div className="mt-6 border-t pt-6">
            <h3 className="mb-1 text-sm font-semibold text-gray-800">
              All Prints — Density &amp; Font
            </h3>
            <p className="mb-3 text-xs text-gray-500">
              Applies to POS receipts, order bills, and barcode labels. Thermal roll only — not A4.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Print Density</label>
                <select
                  value={form.barcode_density}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      barcode_density: e.target.value as PrintDensity,
                    })
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {PRINT_DENSITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Font Family</label>
                <select
                  value={form.barcode_font}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      barcode_font: e.target.value as BarcodeFontFamily,
                    })
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {BARCODE_FONT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Receipt Font Size (80mm, px)</label>
                <Input
                  type="number"
                  min={8}
                  max={16}
                  value={form.receipt_font_size}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      receipt_font_size: Number(e.target.value) || 11,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="mt-6 border-t pt-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">
              Barcode Label Paper
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Paper / Roll</label>
                <select
                  value={form.barcode_paper}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      barcode_paper: e.target.value as BarcodePaperType,
                    })
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {BARCODE_PAPER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Label Font Size (px)</label>
                <Input
                  type="number"
                  min={6}
                  max={18}
                  value={form.barcode_font_size}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      barcode_font_size: Number(e.target.value) || 10,
                    })
                  }
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Barcode labels print on thermal roll (58mm/80mm) or exact label size — not A4 paper.
            </p>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">Receipt Text</h2>
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

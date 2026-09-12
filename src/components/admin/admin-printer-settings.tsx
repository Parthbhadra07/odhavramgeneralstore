"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Printer, Settings, X } from "lucide-react";
import { toast } from "sonner";
import { settingsService } from "@/services/erp";
import type { BarcodeFontFamily, BarcodePaperType, PrintDensity } from "@/types/erp";
import {
  getAutoPrintPreference,
  getPrinterName,
  resolveReceiptWidth,
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
import { BluetoothPrinterPanel } from "@/components/admin/bluetooth-printer-panel";
import { printReceipt } from "@/components/erp/receipt-print";
import { Button } from "@/components/ui/button";

interface AdminPrinterSettingsProps {
  className?: string;
}

export function AdminPrinterSettings({ className }: AdminPrinterSettingsProps) {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState<ReceiptWidth>("80mm");
  const [autoPrint, setAutoPrint] = useState(true);
  const [printerName, setPrinterNameState] = useState("");
  const [paperType, setPaperType] = useState<BarcodePaperType>("roll58");
  const [density, setDensity] = useState<PrintDensity>("normal");
  const [font, setFont] = useState<BarcodeFontFamily>("courier");
  const [saving, setSaving] = useState(false);

  const loadPrefs = useCallback(async () => {
    const settings = await settingsService.get();
    const barcode = getBarcodePrinterPrefs();
    setWidth(resolveReceiptWidth(settings.receipt_width));
    setAutoPrint(getAutoPrintPreference());
    setPrinterNameState(getPrinterName());
    setPaperType(barcode.paperType);
    setDensity(barcode.printDensity);
    setFont(barcode.fontFamily);
  }, []);

  useEffect(() => {
    if (open) void loadPrefs();
  }, [open, loadPrefs]);

  const saveWidth = async (next: ReceiptWidth) => {
    setWidth(next);
    setLocalReceiptWidth(next);
    setSaving(true);
    try {
      await settingsService.update({ receipt_width: next });
      settingsService.clearCache();
      toast.success(`Receipt width set to ${next}`);
    } catch {
      toast.message("Width saved on this device");
    } finally {
      setSaving(false);
    }
  };

  const savePrintPrefs = (patch: {
    paperType?: BarcodePaperType;
    printDensity?: PrintDensity;
    fontFamily?: BarcodeFontFamily;
  }) => {
    if (patch.paperType) setPaperType(patch.paperType);
    if (patch.printDensity) setDensity(patch.printDensity);
    if (patch.fontFamily) setFont(patch.fontFamily);
    setBarcodePrinterPrefs(patch);
    toast.success("Print settings updated");
  };

  const handleAutoPrintChange = (enabled: boolean) => {
    setAutoPrint(enabled);
    setAutoPrintPreference(enabled);
    toast.success(enabled ? "Pay & Print will auto-print" : "Pay only — no auto-print");
  };

  const handlePrinterNameBlur = () => {
    setPrinterName(printerName);
  };

  const testPrint = () => {
    const el = document.getElementById("pos-thermal-receipt");
    if (el) {
      printReceipt("pos-thermal-receipt", width);
      return;
    }
    toast.message("Complete a sale first, or open a bill to test print");
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-2 text-green-800 hover:bg-green-100"
        aria-label="Printer settings"
        aria-expanded={open}
      >
        <Printer className="h-4 w-4" />
        <span className="hidden text-xs font-medium sm:inline">Printer</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/30 lg:hidden"
            aria-label="Close printer settings"
            onClick={() => setOpen(false)}
          />
          <div className="fixed left-0 right-0 top-14 z-[70] max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-gray-200 bg-white p-4 shadow-lg lg:absolute lg:left-auto lg:right-0 lg:top-full lg:mt-2 lg:max-h-[80vh] lg:w-96 lg:rounded-xl lg:border">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Printer Settings</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="mb-1 block font-medium text-gray-700">
                  Receipt paper width
                </label>
                <select
                  value={width}
                  disabled={saving}
                  onChange={(e) => void saveWidth(e.target.value as ReceiptWidth)}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  {RECEIPT_WIDTH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-gray-700">
                  Barcode paper / roll
                </label>
                <select
                  value={paperType}
                  onChange={(e) =>
                    savePrintPrefs({ paperType: e.target.value as BarcodePaperType })
                  }
                  className="w-full rounded-lg border px-3 py-2"
                >
                  {BARCODE_PAPER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-medium text-gray-700">Density</label>
                  <select
                    value={density}
                    onChange={(e) =>
                      savePrintPrefs({ printDensity: e.target.value as PrintDensity })
                    }
                    className="w-full rounded-lg border px-3 py-2"
                  >
                    {PRINT_DENSITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-gray-700">Font</label>
                  <select
                    value={font}
                    onChange={(e) =>
                      savePrintPrefs({ fontFamily: e.target.value as BarcodeFontFamily })
                    }
                    className="w-full rounded-lg border px-3 py-2 text-xs"
                  >
                    {BARCODE_FONT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-gray-700">
                  Printer name (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. TVS RP 3200"
                  value={printerName}
                  onChange={(e) => setPrinterNameState(e.target.value)}
                  onBlur={handlePrinterNameBlur}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <BluetoothPrinterPanel />

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(e) => handleAutoPrintChange(e.target.checked)}
                  className="rounded"
                />
                <span>Auto-print on Pay &amp; Print (F9)</span>
              </label>

              <p className="text-xs text-gray-500">
                All prints use thermal roll sizes — select your thermal printer in the print
                dialog, not A4 paper.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={testPrint}>
                  Test receipt
                </Button>
                <Link
                  href="/admin/settings#printer"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="h-3.5 w-3.5" />
                  More settings
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

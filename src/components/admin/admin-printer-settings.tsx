"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  Laptop,
  Loader2,
  Printer,
  RefreshCw,
  Settings,
  Sliders,
  Sparkles,
  X,
} from "lucide-react";
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
import type { ElectronPrinter } from "@/types/electron";

interface AdminPrinterSettingsProps {
  className?: string;
  triggerButton?: React.ReactNode;
}

export function AdminPrinterSettings({
  className,
  triggerButton,
}: AdminPrinterSettingsProps) {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState<ReceiptWidth>("80mm");
  const [autoPrint, setAutoPrint] = useState(true);
  const [printerName, setPrinterNameState] = useState("");
  const [paperType, setPaperType] = useState<BarcodePaperType>("roll58");
  const [density, setDensity] = useState<PrintDensity>("normal");
  const [font, setFont] = useState<BarcodeFontFamily>("courier");
  const [saving, setSaving] = useState(false);

  // Installed desktop printers (Electron)
  const [desktopPrinters, setDesktopPrinters] = useState<ElectronPrinter[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const isElectron =
    typeof window !== "undefined" && Boolean(window.electronAPI?.isElectron);

  const loadPrefs = useCallback(async () => {
    try {
      const settings = await settingsService.get();
      const barcode = getBarcodePrinterPrefs();
      setWidth(resolveReceiptWidth(settings.receipt_width));
      setAutoPrint(getAutoPrintPreference());
      setPrinterNameState(getPrinterName());
      setPaperType(barcode.paperType);
      setDensity(barcode.printDensity);
      setFont(barcode.fontFamily);
    } catch {
      // ignore
    }

    // If on Electron desktop app, load installed Windows printers
    if (typeof window !== "undefined" && window.electronAPI?.getPrinters) {
      setLoadingPrinters(true);
      try {
        const printers = await window.electronAPI.getPrinters();
        setDesktopPrinters(printers);
        // If no printer saved yet, default to default system printer
        const saved = getPrinterName();
        if (!saved && printers.length > 0) {
          const def = printers.find((p) => p.isDefault) || printers[0];
          if (def) {
            setPrinterNameState(def.name);
            setPrinterName(def.name);
          }
        }
      } catch (err) {
        console.warn("Could not fetch desktop printers:", err);
      } finally {
        setLoadingPrinters(false);
      }
    }
  }, []);

  useEffect(() => {
    if (open) void loadPrefs();
  }, [open, loadPrefs]);

  // Global listeners (custom event + Electron menu)
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-printer-settings", handleOpen);

    const unsubscribeMenu = window.electronAPI?.onOpenPrinterSettings?.(() => {
      setOpen(true);
    });

    return () => {
      window.removeEventListener("open-printer-settings", handleOpen);
      if (typeof unsubscribeMenu === "function") unsubscribeMenu();
    };
  }, []);

  const refreshPrinters = async () => {
    if (!window.electronAPI?.getPrinters) return;
    setLoadingPrinters(true);
    try {
      const printers = await window.electronAPI.getPrinters();
      setDesktopPrinters(printers);
      toast.success(`Found ${printers.length} installed printers`);
    } catch {
      toast.error("Could not refresh printers");
    } finally {
      setLoadingPrinters(false);
    }
  };

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
    toast.success(
      enabled ? "Pay & Print will auto-print" : "Pay only — no auto-print"
    );
  };

  const handleSelectPrinter = (name: string) => {
    setPrinterNameState(name);
    setPrinterName(name);
    toast.success(`Selected printer: ${name || "System Default"}`);
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

    // If no active receipt element, create a sample receipt temporarily
    const dummy = document.createElement("div");
    dummy.id = "dummy-test-receipt";
    dummy.className = "receipt-container";
    dummy.style.cssText =
      "width:80mm;padding:8px;font-family:monospace;font-size:12px;background:#fff;color:#000;";
    dummy.innerHTML = `
      <div style="text-align:center;font-weight:bold;font-size:14px;border-bottom:1px dashed #000;padding-bottom:4px;margin-bottom:6px;">
        ODHAVRAM GENERAL STORE
      </div>
      <div style="text-align:center;font-size:10px;margin-bottom:6px;">
        *** TEST RECEIPT PRINT ***<br/>
        Thermal Printer Test OK<br/>
        Width: ${width} | Density: ${density}
      </div>
      <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 0;margin:6px 0;font-size:11px;">
        <div style="display:flex;justify-content:space-between;">
          <span>Item 1 (Test Sample)</span>
          <span>Rs 100.00</span>
        </div>
      </div>
      <div style="text-align:right;font-weight:bold;margin-bottom:6px;">
        Total: Rs 100.00
      </div>
      <div style="text-align:center;font-size:10px;border-top:1px dashed #000;padding-top:4px;">
        Thank You! Visit Again
      </div>
    `;
    document.body.appendChild(dummy);
    printReceipt("dummy-test-receipt", width);
    setTimeout(() => {
      if (dummy.parentNode) dummy.parentNode.removeChild(dummy);
    }, 2000);
  };

  return (
    <div className={className}>
      {triggerButton ? (
        <div onClick={() => setOpen(true)}>{triggerButton}</div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-green-800 hover:bg-green-100 transition shadow-sm"
          aria-label="Printer settings"
        >
          <Printer className="h-4 w-4 text-green-700" />
          <span className="text-xs font-semibold">Printer</span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white shadow-md shadow-green-600/20">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    Printer &amp; POS Settings
                    {isElectron && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800 border border-green-200">
                        Desktop App
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Configure thermal receipts, Bluetooth printer &amp; barcode labels
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200/60 hover:text-gray-700 transition"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
              {/* Desktop Installed Printers (if Electron) */}
              {isElectron && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold text-emerald-900 text-xs">
                      <Laptop className="h-4 w-4 text-emerald-700" />
                      Installed Windows Printers
                    </div>
                    <button
                      type="button"
                      onClick={refreshPrinters}
                      disabled={loadingPrinters}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-900 transition"
                      title="Refresh printer list"
                    >
                      <RefreshCw
                        className={`h-3 w-3 ${loadingPrinters ? "animate-spin" : ""}`}
                      />
                      Refresh
                    </button>
                  </div>

                  {desktopPrinters.length > 0 ? (
                    <div>
                      <select
                        value={printerName}
                        onChange={(e) => handleSelectPrinter(e.target.value)}
                        className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                      >
                        <option value="">System Default Printer</option>
                        {desktopPrinters.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name} {p.isDefault ? "(Default)" : ""}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-emerald-800">
                        Select your USB or Bluetooth thermal printer from the list.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-800">
                      Scanning installed printers... or enter name manually below.
                    </p>
                  )}
                </div>
              )}

              {/* Bluetooth Thermal Printer Section */}
              <BluetoothPrinterPanel />

              {/* Receipt Paper Width */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Receipt Paper Width
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {RECEIPT_WIDTH_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={saving}
                      onClick={() => void saveWidth(opt.value)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition ${
                        width === opt.value
                          ? "border-green-600 bg-green-50 text-green-900 ring-2 ring-green-600/30 shadow-sm"
                          : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <span className="text-sm font-bold">{opt.shortLabel}</span>
                      <span className="text-[10px] text-gray-500 font-normal">
                        {opt.label.split("—")[1]?.trim() || opt.value}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Barcode Paper & Typography */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-gray-800 text-xs">
                  <Sliders className="h-4 w-4 text-gray-600" />
                  Barcode Label &amp; Font Preferences
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-600">
                      Roll / Sheet
                    </label>
                    <select
                      value={paperType}
                      onChange={(e) =>
                        savePrintPrefs({
                          paperType: e.target.value as BarcodePaperType,
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800"
                    >
                      {BARCODE_PAPER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-600">
                      Density
                    </label>
                    <select
                      value={density}
                      onChange={(e) =>
                        savePrintPrefs({
                          printDensity: e.target.value as PrintDensity,
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800"
                    >
                      {PRINT_DENSITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-600">
                      Font
                    </label>
                    <select
                      value={font}
                      onChange={(e) =>
                        savePrintPrefs({
                          fontFamily: e.target.value as BarcodeFontFamily,
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800"
                    >
                      {BARCODE_FONT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Custom Printer Name (Fallback for web/custom spoolers) */}
              {!isElectron && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Printer Name (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TVS RP 3200, POS-80"
                    value={printerName}
                    onChange={(e) => setPrinterNameState(e.target.value)}
                    onBlur={handlePrinterNameBlur}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                  />
                </div>
              )}

              {/* Auto-print toggle */}
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-gray-50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(e) => handleAutoPrintChange(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <div>
                  <span className="font-semibold text-xs text-gray-900 block">
                    Auto-print on Pay &amp; Print (F9)
                  </span>
                  <span className="text-[11px] text-gray-500 block">
                    Immediately send receipt to thermal printer when bill is paid
                  </span>
                </div>
              </label>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/90 px-5 py-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={testPrint}
                  className="gap-1.5 text-xs font-semibold border-gray-300 hover:bg-white"
                >
                  <Sparkles className="h-3.5 w-3.5 text-green-600" />
                  Test Print
                </Button>
                <Link
                  href="/admin/settings#printer"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Store Settings
                </Link>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={() => setOpen(false)}
                className="bg-green-700 hover:bg-green-800 text-white font-semibold text-xs px-4"
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

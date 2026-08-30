import type {
  BarcodeFontFamily,
  BarcodeLabelConfig,
  BarcodePaperType,
  PrintDensity,
} from "@/types/erp";
import { DEFAULT_LABEL_CONFIG } from "@/services/erp/barcode-label.service";

const BARCODE_PREFS_KEY = "ogs_barcode_printer_prefs";

export type BarcodePrinterPrefs = Pick<
  BarcodeLabelConfig,
  "paperType" | "printDensity" | "fontFamily" | "printerType" | "fontSize"
> & {
  receiptFontSize: number;
};

const DEFAULT_BARCODE_PREFS: BarcodePrinterPrefs = {
  paperType: "roll58",
  printDensity: "normal",
  fontFamily: "courier",
  printerType: DEFAULT_LABEL_CONFIG.printerType,
  fontSize: DEFAULT_LABEL_CONFIG.fontSize,
  receiptFontSize: 11,
};

export const BARCODE_PAPER_OPTIONS: { value: BarcodePaperType; label: string }[] = [
  { value: "roll58", label: "58mm thermal roll (not A4)" },
  { value: "roll80", label: "80mm thermal roll (not A4)" },
  { value: "label", label: "Single label (exact mm size)" },
];

export const PRINT_DENSITY_OPTIONS: { value: PrintDensity; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "normal", label: "Normal" },
  { value: "dark", label: "Dark (bold)" },
];

export const BARCODE_FONT_OPTIONS: { value: BarcodeFontFamily; label: string }[] = [
  { value: "courier", label: "Courier New (monospace)" },
  { value: "arial", label: "Arial" },
  { value: "helvetica", label: "Helvetica" },
  { value: "verdana", label: "Verdana" },
];

export function getBarcodePrinterPrefs(): BarcodePrinterPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_BARCODE_PREFS };
  try {
    const raw = localStorage.getItem(BARCODE_PREFS_KEY);
    if (!raw) return { ...DEFAULT_BARCODE_PREFS };
    const parsed = JSON.parse(raw) as Partial<BarcodePrinterPrefs>;
    return { ...DEFAULT_BARCODE_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_BARCODE_PREFS };
  }
}

export function setBarcodePrinterPrefs(prefs: Partial<BarcodePrinterPrefs>) {
  const next = { ...getBarcodePrinterPrefs(), ...prefs };
  localStorage.setItem(BARCODE_PREFS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("ogs-barcode-printer-changed"));
  window.dispatchEvent(new CustomEvent("ogs-printer-settings-changed"));
  return next;
}

/** Shared density + font for receipts and barcode labels. */
export function getSharedPrintPrefs() {
  const p = getBarcodePrinterPrefs();
  return {
    printDensity: p.printDensity,
    fontFamily: p.fontFamily,
    receiptFontSize: p.receiptFontSize,
    barcodeFontSize: p.fontSize,
    paperType: p.paperType,
    printerType: p.printerType,
  };
}

export function mergeBarcodeConfig(
  config: BarcodeLabelConfig
): BarcodeLabelConfig {
  const prefs = getBarcodePrinterPrefs();
  return {
    ...config,
    paperType: prefs.paperType ?? config.paperType,
    printDensity: prefs.printDensity ?? config.printDensity,
    fontFamily: prefs.fontFamily ?? config.fontFamily,
    printerType: prefs.printerType ?? config.printerType,
    fontSize: prefs.fontSize ?? config.fontSize,
  };
}

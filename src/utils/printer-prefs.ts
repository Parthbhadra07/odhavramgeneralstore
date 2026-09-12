export type ReceiptWidth = "52mm" | "58mm" | "64mm" | "80mm" | "88mm";

export interface ReceiptWidthOption {
  value: ReceiptWidth;
  label: string;
  shortLabel: string;
  description: string;
  widthMm: number;
}

export const RECEIPT_WIDTH_OPTIONS: ReceiptWidthOption[] = [
  {
    value: "52mm",
    label: "52mm (2\" Mini / Compact)",
    shortLabel: "52mm (2\")",
    description: "2-inch mini portable / Bluetooth roll & label",
    widthMm: 52,
  },
  {
    value: "58mm",
    label: "58mm (2\" Standard Thermal)",
    shortLabel: "58mm (2\")",
    description: "Standard 2-inch thermal receipt & label printer",
    widthMm: 58,
  },
  {
    value: "64mm",
    label: "64mm (2.5\" Roll / Label)",
    shortLabel: "64mm (2.5\")",
    description: "2.5-inch thermal roll & barcode label",
    widthMm: 64,
  },
  {
    value: "80mm",
    label: "80mm (3\" Standard POS)",
    shortLabel: "80mm (3\")",
    description: "Standard 3-inch counter POS thermal printer",
    widthMm: 80,
  },
  {
    value: "88mm",
    label: "88mm (3.5\" Wide POS)",
    shortLabel: "88mm (3.5\")",
    description: "3.5-inch wide POS roll & bill printer",
    widthMm: 88,
  },
];

const VALID_RECEIPT_WIDTHS = new Set<ReceiptWidth>([
  "52mm",
  "58mm",
  "64mm",
  "80mm",
  "88mm",
]);

const WIDTH_KEY = "ogs_receipt_width";
const AUTO_PRINT_KEY = "ogs_pos_auto_print";
const PRINTER_NAME_KEY = "ogs_printer_name";

export function getLocalReceiptWidth(): ReceiptWidth | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(WIDTH_KEY);
  return v && VALID_RECEIPT_WIDTHS.has(v as ReceiptWidth)
    ? (v as ReceiptWidth)
    : null;
}

export function setLocalReceiptWidth(width: ReceiptWidth) {
  localStorage.setItem(WIDTH_KEY, width);
  window.dispatchEvent(new CustomEvent("ogs-printer-settings-changed"));
}

export function getAutoPrintPreference(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(AUTO_PRINT_KEY) !== "0";
}

export function setAutoPrintPreference(enabled: boolean) {
  localStorage.setItem(AUTO_PRINT_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new CustomEvent("ogs-printer-settings-changed"));
}

export function getPrinterName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(PRINTER_NAME_KEY) ?? "";
}

export function setPrinterName(name: string) {
  localStorage.setItem(PRINTER_NAME_KEY, name.trim());
}

export function resolveReceiptWidth(
  storeWidth?: ReceiptWidth | null
): ReceiptWidth {
  return getLocalReceiptWidth() ?? storeWidth ?? "80mm";
}


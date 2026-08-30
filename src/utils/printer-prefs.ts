export type ReceiptWidth = "58mm" | "80mm";

const WIDTH_KEY = "ogs_receipt_width";
const AUTO_PRINT_KEY = "ogs_pos_auto_print";
const PRINTER_NAME_KEY = "ogs_printer_name";

export function getLocalReceiptWidth(): ReceiptWidth | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(WIDTH_KEY);
  return v === "58mm" || v === "80mm" ? v : null;
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

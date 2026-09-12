import { Html5QrcodeSupportedFormats } from "html5-qrcode";

/** Formats on packaged grocery / retail products (not app-generated labels only). */
export const RETAIL_BARCODE_FORMATS: Html5QrcodeSupportedFormats[] = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
];

export function normalizeScannedBarcode(raw: string): string {
  return raw.trim().replace(/\s/g, "");
}

/** Typical packaged-goods / lot barcodes — skip slow fuzzy name search. */
export function isLikelyExactBarcode(code: string): boolean {
  const c = normalizeScannedBarcode(code);
  return c.length >= 8 && c.length <= 32 && /^[0-9A-Za-z._-]+$/.test(c);
}

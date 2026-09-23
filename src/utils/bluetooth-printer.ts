/// <reference types="web-bluetooth" />

import { Capacitor } from "@capacitor/core";
import {
  canvasToEscPosRaster,
  concatBytes,
  escAlign,
  escBold,
  escCut,
  escFeed,
  escInit,
  escText,
  escTextSize,
  scaleCanvasForPrinter,
} from "@/utils/escpos";
import { isCapacitorNative } from "@/lib/capacitor";
import { getBarcodePrinterPrefs } from "@/utils/barcode-printer-prefs";
import { getLocalReceiptWidth } from "@/utils/printer-prefs";
import { renderBarcodeToCanvas } from "@/components/erp/barcode-label-utils";
import { DEFAULT_LABEL_CONFIG } from "@/services/erp/barcode-label.service";
import type { BondedBluetoothDevice } from "@/plugins/thermal-printer";
import type { BarcodeLabelConfig } from "@/types/erp";

const NAME_KEY = "ogs_bt_printer_name";
const ID_KEY = "ogs_bt_printer_id";

const OPTIONAL_SERVICES: BluetoothServiceUUID[] = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
  "0000ff10-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

const BLE_NAME_PREFIXES = [
  "POS",
  "Printer",
  "MTP",
  "RPP",
  "RP",
  "TM-",
  "EPSON",
  "TVS",
  "Inner",
  "BlueTooth",
  "Bluetooth",
  "BT-",
  "BT_",
  "Thermal",
  "XP-",
  "GP-",
  "Gprinter",
  "MPT",
  "HOIN",
  "PeriPage",
  "Phomemo",
  "MUNBYN",
  "Cashino",
  "Rongta",
];

type WriteFn = (chunk: Uint8Array) => Promise<void>;

let writeChunk: WriteFn | null = null;
let connectedName = "";
let gattServer: BluetoothRemoteGATTServer | null = null;
let nativeAddress: string | null = null;

function notify() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ogs-bluetooth-printer-changed"));
}

function persist(name: string, id: string) {
  localStorage.setItem(NAME_KEY, name);
  localStorage.setItem(ID_KEY, id);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

export function isWebBluetoothSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.bluetooth);
}

export function isBluetoothPrintingAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (isCapacitorNative() && Capacitor.getPlatform() === "android") return true;
  return isWebBluetoothSupported();
}

export function getBluetoothPrinterName(): string {
  if (typeof window === "undefined") return connectedName;
  return connectedName || localStorage.getItem(NAME_KEY) || "";
}

export function isBluetoothPrinterConnected(): boolean {
  return writeChunk != null;
}

export function getBluetoothPrinterDots(): number {
  const receiptWidth = getLocalReceiptWidth();
  if (receiptWidth === "88mm") return 640;
  if (receiptWidth === "80mm") return 576;
  if (receiptWidth === "64mm") return 448;
  if (receiptWidth === "58mm" || receiptWidth === "52mm") return 384;
  const paper = getBarcodePrinterPrefs().paperType;
  return paper === "roll80" ? 576 : 384;
}

export async function listPairedBluetoothPrinters(): Promise<BondedBluetoothDevice[]> {
  if (!isCapacitorNative() || Capacitor.getPlatform() !== "android") return [];
  const { ThermalPrinter } = await import("@/plugins/thermal-printer");
  const { devices } = await ThermalPrinter.listBondedDevices();
  const lastId = localStorage.getItem(ID_KEY);
  return [...devices].sort((a, b) => {
    if (a.address === lastId) return -1;
    if (b.address === lastId) return 1;
    const score = (name: string) =>
      /print|pos|thermal|epson|tvs|rongta|mtp|xp-|gp-/i.test(name) ? 0 : 1;
    return score(a.name) - score(b.name) || a.name.localeCompare(b.name);
  });
}

async function findWritableCharacteristic(
  server: BluetoothRemoteGATTServer
): Promise<BluetoothRemoteGATTCharacteristic> {
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const chars = await service.getCharacteristics();
    for (const char of chars) {
      const props = char.properties;
      if (props.writeWithoutResponse || props.write) {
        return char;
      }
    }
  }
  throw new Error("This Bluetooth device has no printable characteristic");
}

async function writeInChunks(write: WriteFn, data: Uint8Array, size = 180) {
  for (let i = 0; i < data.length; i += size) {
    await write(data.slice(i, i + size));
    await new Promise((r) => setTimeout(r, 20));
  }
}

async function attachNativeWriter(name: string, address: string) {
  const { ThermalPrinter } = await import("@/plugins/thermal-printer");
  nativeAddress = address;
  gattServer = null;
  connectedName = name;
  persist(name, address);
  writeChunk = async (chunk: Uint8Array) => {
    await ThermalPrinter.write({ data: uint8ToBase64(chunk) });
  };
  notify();
}

export async function connectNativeBluetoothPrinter(address: string): Promise<string> {
  const { ThermalPrinter } = await import("@/plugins/thermal-printer");
  const result = await ThermalPrinter.connect({ address });
  await attachNativeWriter(result.name || "Bluetooth printer", result.address);
  return connectedName;
}

async function connectWebBluetooth(): Promise<string> {
  if (!navigator.bluetooth) {
    throw new Error(
      "Bluetooth printing needs Chrome or Edge, or the Android app with a paired thermal printer."
    );
  }

  let device: BluetoothDevice;
  try {
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: OPTIONAL_SERVICES,
    });
  } catch (err) {
    const cancelled = err instanceof Error && /cancel/i.test(err.message);
    if (cancelled) throw err;
    device = await navigator.bluetooth.requestDevice({
      filters: BLE_NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
      optionalServices: OPTIONAL_SERVICES,
    });
  }

  if (!device.gatt) {
    throw new Error("Printer does not support Bluetooth GATT");
  }

  const server = await device.gatt.connect();
  const characteristic = await findWritableCharacteristic(server);
  const useWithoutResponse = characteristic.properties.writeWithoutResponse;

  nativeAddress = null;
  gattServer = server;
  connectedName = device.name || "Bluetooth printer";
  persist(connectedName, device.id);

  writeChunk = async (chunk: Uint8Array) => {
    const buffer = chunk.buffer.slice(
      chunk.byteOffset,
      chunk.byteOffset + chunk.byteLength
    ) as ArrayBuffer;
    if (useWithoutResponse) {
      await characteristic.writeValueWithoutResponse(buffer);
    } else {
      await characteristic.writeValueWithResponse(buffer);
    }
  };

  device.addEventListener("gattserverdisconnected", () => {
    writeChunk = null;
    gattServer = null;
    notify();
  });

  notify();
  return connectedName;
}

export async function connectBluetoothPrinter(): Promise<string> {
  if (isCapacitorNative() && Capacitor.getPlatform() === "ios") {
    throw new Error(
      "iPhone cannot talk to most Bluetooth thermal printers. Use an Android phone, or AirPrint if the printer supports it."
    );
  }

  if (isCapacitorNative() && Capacitor.getPlatform() === "android") {
    const devices = await listPairedBluetoothPrinters();
    if (devices.length === 0) {
      throw new Error(
        "No paired printers found. In Android settings, pair your thermal printer, then tap Connect again."
      );
    }
    const lastId = localStorage.getItem(ID_KEY);
    const match = devices.find((d) => d.address === lastId) ?? (devices.length === 1 ? devices[0] : null);
    if (!match) {
      const error = new Error("PICK_DEVICE") as Error & { devices: BondedBluetoothDevice[] };
      error.devices = devices;
      throw error;
    }
    return connectNativeBluetoothPrinter(match.address);
  }

  return connectWebBluetooth();
}

export async function disconnectBluetoothPrinter() {
  writeChunk = null;
  try {
    if (nativeAddress) {
      const { ThermalPrinter } = await import("@/plugins/thermal-printer");
      await ThermalPrinter.disconnect();
    }
  } catch {
    /* ignore */
  }
  nativeAddress = null;
  try {
    gattServer?.disconnect();
  } catch {
    /* ignore */
  }
  gattServer = null;
  notify();
}

export async function printRawToBluetooth(data: Uint8Array) {
  if (!writeChunk) {
    throw new Error("Connect a Bluetooth printer first");
  }
  await writeInChunks(writeChunk, data);
}

export async function printEscPosDocument(parts: Uint8Array[]) {
  await printRawToBluetooth(concatBytes(escInit(), ...parts, escFeed(3), escCut()));
}

function wrapEscPosLine(line: string, cols: number): string[] {
  if (line.length <= cols) return [line];
  const out: string[] = [];
  for (let i = 0; i < line.length; i += cols) {
    out.push(line.slice(i, i + cols));
  }
  return out;
}

async function rasterizeElement(el: HTMLElement, dots: number): Promise<Uint8Array | null> {
  try {
    const { toCanvas } = await import("html-to-image");
    const holder = document.createElement("div");
    holder.style.cssText =
      "position:fixed;left:0;top:0;opacity:0.01;pointer-events:none;z-index:-1;background:#fff;";
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.position = "static";
    clone.style.left = "auto";
    clone.style.top = "auto";

    // Ensure all canvas elements are copied to clone as images
    const sourceCanvases = Array.from(el.querySelectorAll("canvas"));
    const cloneCanvases = Array.from(clone.querySelectorAll("canvas"));
    sourceCanvases.forEach((src, idx) => {
      const dest = cloneCanvases[idx];
      if (!dest) return;
      try {
        const img = document.createElement("img");
        img.src = src.toDataURL("image/png");
        img.style.width = src.style.width || `${src.width}px`;
        img.style.height = src.style.height || `${src.height}px`;
        img.style.display = "block";
        img.style.margin = "0 auto";
        dest.replaceWith(img);
      } catch {
        dest.width = src.width;
        dest.height = src.height;
        const ctx = dest.getContext("2d");
        ctx?.drawImage(src, 0, 0);
      }
    });

    holder.appendChild(clone);
    document.body.appendChild(holder);

    try {
      // Ensure all images (including UPI QR code data URLs) are loaded before rasterizing
      const imgs = Array.from(clone.querySelectorAll("img"));
      await Promise.all(
        imgs.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = () => resolve(null);
            img.onerror = () => resolve(null);
            setTimeout(resolve, 400);
          });
        })
      );

      const canvas = await toCanvas(clone, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
        skipFonts: true,
      });
      const scaled = scaleCanvasForPrinter(canvas, dots, true);
      return canvasToEscPosRaster(scaled, 128);
    } finally {
      holder.remove();
    }
  } catch {
    return null;
  }
}

export interface BluetoothBarcodeLabel {
  value: string;
  productName: string;
  shopName?: string;
  sellingPrice?: number;
  mrp?: number;
  showBarcodeNumber?: boolean;
}

export async function printBarcodeLabelsBluetooth(
  label: BluetoothBarcodeLabel,
  copies = 1,
  configOverride?: Partial<BarcodeLabelConfig>
) {
  const dots = getBluetoothPrinterDots();
  const prefs = getBarcodePrinterPrefs();
  const config: BarcodeLabelConfig = {
    ...DEFAULT_LABEL_CONFIG,
    ...prefs,
    ...configOverride,
    showBarcodeNumber: label.showBarcodeNumber !== false,
    paperType: configOverride?.paperType ?? prefs.paperType,
    barcodeHeight: Math.max(25, Math.min(180, configOverride?.barcodeHeight ?? prefs.barcodeHeight ?? 60)),
    labelWidthMm: configOverride?.labelWidthMm ?? prefs.labelWidthMm ?? DEFAULT_LABEL_CONFIG.labelWidthMm,
    labelHeightMm: configOverride?.labelHeightMm ?? prefs.labelHeightMm ?? DEFAULT_LABEL_CONFIG.labelHeightMm,
  };
  const chunks: Uint8Array[] = [];

  for (let i = 0; i < copies; i++) {
    chunks.push(escAlign("center"));
    if (label.shopName) {
      chunks.push(
        escBold(true),
        escText(label.shopName.toUpperCase()),
        escBold(false)
      );
    }
    chunks.push(escText(label.productName));

    const canvas = renderBarcodeToCanvas(label.value, config, dots - 16);
    const centeredCanvas = scaleCanvasForPrinter(canvas, dots, true);
    chunks.push(canvasToEscPosRaster(centeredCanvas, 128));

    const prices: string[] = [];
    if (label.mrp != null) prices.push(`MRP Rs ${label.mrp.toFixed(2)}`);
    if (label.sellingPrice != null) prices.push(`Rs ${label.sellingPrice.toFixed(2)}`);
    if (prices.length) {
      chunks.push(escBold(true), escText(prices.join("  ")), escBold(false));
    }
    chunks.push(escFeed(2));
  }

  // End of print job: feed to clear cutter, then cut
  chunks.push(escFeed(2), escCut());
  await printRawToBluetooth(concatBytes(escInit(), ...chunks));
}

export async function printBarcodeLabelsFromPrintRoot(
  elementId: string,
  configOverride?: Partial<BarcodeLabelConfig>
) {
  const root = document.getElementById(elementId);
  if (!root) throw new Error("Nothing to print");
  const labels = Array.from(root.querySelectorAll<HTMLElement>(".thermal-label"));
  if (labels.length === 0) throw new Error("No barcode labels found");

  const dots = getBluetoothPrinterDots();
  const chunks: Uint8Array[] = [];

  // Try rasterizing each styled HTML label so fonts, layout, and styling match wired print 100%
  let rasterSuccess = true;
  for (const labelEl of labels) {
    const raster = await rasterizeElement(labelEl, dots);
    if (raster && raster.length > 8) {
      chunks.push(escAlign("center"), raster, escFeed(2));
    } else {
      rasterSuccess = false;
      break;
    }
  }

  if (rasterSuccess && chunks.length > 0) {
    chunks.push(escFeed(2), escCut());
    await printRawToBluetooth(concatBytes(escInit(), ...chunks));
    return;
  }

  // Fallback: structured print with matching clean formatting
  const items: BluetoothBarcodeLabel[] = [];
  for (const label of labels) {
    const value = label.getAttribute("data-barcode-value")?.trim();
    if (!value) continue;
    const mrpRaw = label.getAttribute("data-mrp");
    const sellRaw = label.getAttribute("data-selling-price");
    items.push({
      value,
      productName: label.getAttribute("data-product-name") || "Product",
      shopName: label.getAttribute("data-shop-name") || undefined,
      mrp: mrpRaw ? Number(mrpRaw) : undefined,
      sellingPrice: sellRaw ? Number(sellRaw) : undefined,
    });
  }

  for (const item of items) {
    await printBarcodeLabelsBluetooth(item, 1, configOverride);
  }
}

export async function printTextToBluetooth(text: string) {
  const cols = getBluetoothPrinterDots() >= 576 ? 48 : 32;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/g, ""))
    .filter((line, i, arr) => line.length > 0 || (i > 0 && arr[i - 1].length > 0));

  const chunks: Uint8Array[] = [escAlign("center")];
  for (const line of lines) {
    for (const wrapped of wrapEscPosLine(line, cols)) {
      chunks.push(escText(wrapped));
    }
  }
  await printEscPosDocument(chunks);
}

export async function printElementToBluetooth(elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("Nothing to print");

  const dots = getBluetoothPrinterDots();
  const raster = await rasterizeElement(el, dots);
  if (raster && raster.length > 8) {
    await printEscPosDocument([escAlign("center"), raster]);
    return;
  }

  // Fallback: structured text print with centered QR code
  const qrImg = el.querySelector<HTMLImageElement>(".receipt-qr-wrap img, img.receipt-qr-img");
  const canvases = Array.from(el.querySelectorAll("canvas"));
  const chunks: Uint8Array[] = [escAlign("center")];
  const cols = dots >= 576 ? 48 : 32;
  for (const line of el.innerText.split(/\r?\n/)) {
    const trimmed = line.replace(/\s+$/g, "");
    if (!trimmed) {
      chunks.push(escFeed(1));
      continue;
    }
    for (const wrapped of wrapEscPosLine(trimmed, cols)) {
      chunks.push(escText(wrapped));
    }
  }

  if (qrImg && qrImg.src) {
    try {
      const qrCanvas = document.createElement("canvas");
      qrCanvas.width = qrImg.naturalWidth || 240;
      qrCanvas.height = qrImg.naturalHeight || 240;
      const ctx = qrCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, qrCanvas.width, qrCanvas.height);
        ctx.drawImage(qrImg, 0, 0, qrCanvas.width, qrCanvas.height);
        const centered = scaleCanvasForPrinter(qrCanvas, dots, true);
        chunks.push(canvasToEscPosRaster(centered, 128));
      }
    } catch {
      // ignore
    }
  } else {
    for (const canvas of canvases) {
      const centered = scaleCanvasForPrinter(canvas, dots, true);
      chunks.push(canvasToEscPosRaster(centered, 128));
    }
  }

  await printEscPosDocument(chunks);
}

export function bluetoothPrinterHint(): string {
  if (isCapacitorNative() && Capacitor.getPlatform() === "android") {
    return "Pair the thermal printer in Android Bluetooth settings, then connect it here. Bills print on 58/80mm roll — not A4.";
  }
  if (isCapacitorNative() && !isWebBluetoothSupported()) {
    return "Open this admin page in Chrome on Android to pair a BLE printer, or use a paired classic Bluetooth printer in the Android app.";
  }
  if (!isWebBluetoothSupported()) {
    return "Use Google Chrome or Microsoft Edge, or the Android app, to connect a Bluetooth thermal printer.";
  }
  return "Pair a BLE ESC/POS printer in Chrome, or a classic Bluetooth printer in the Android app. Thermal roll only — not A4.";
}

/// <reference types="web-bluetooth" />

import {
  canvasToEscPosRaster,
  concatBytes,
  escAlign,
  escBold,
  escCut,
  escFeed,
  escInit,
  escText,
} from "@/utils/escpos";
import { isCapacitorNative } from "@/lib/capacitor";
import { getBarcodePrinterPrefs } from "@/utils/barcode-printer-prefs";
import { renderBarcodeToCanvas } from "@/components/erp/barcode-label-utils";
import { DEFAULT_LABEL_CONFIG } from "@/services/erp/barcode-label.service";

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

type WriteFn = (chunk: Uint8Array) => Promise<void>;

let writeChunk: WriteFn | null = null;
let connectedName = "";
let gattServer: BluetoothRemoteGATTServer | null = null;

function notify() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ogs-bluetooth-printer-changed"));
}

function persist(name: string, id: string) {
  localStorage.setItem(NAME_KEY, name);
  localStorage.setItem(ID_KEY, id);
}

export function isWebBluetoothSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.bluetooth);
}

export function getBluetoothPrinterName(): string {
  if (typeof window === "undefined") return connectedName;
  return connectedName || localStorage.getItem(NAME_KEY) || "";
}

export function isBluetoothPrinterConnected(): boolean {
  return writeChunk != null;
}

export function getBluetoothPrinterDots(): number {
  const paper = getBarcodePrinterPrefs().paperType;
  return paper === "roll80" ? 576 : 384;
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

export async function connectBluetoothPrinter(): Promise<string> {
  if (!navigator.bluetooth) {
    throw new Error(
      "Bluetooth printing needs Chrome or Edge on a phone/PC. Pair a BLE thermal printer, then try again."
    );
  }

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: OPTIONAL_SERVICES,
  });

  if (!device.gatt) {
    throw new Error("Printer does not support Bluetooth GATT");
  }

  const server = await device.gatt.connect();
  const characteristic = await findWritableCharacteristic(server);
  const useWithoutResponse = characteristic.properties.writeWithoutResponse;

  gattServer = server;
  connectedName = device.name || "Bluetooth printer";
  persist(connectedName, device.id);

  writeChunk = async (chunk: Uint8Array) => {
    const buffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer;
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

export async function disconnectBluetoothPrinter() {
  writeChunk = null;
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
  copies = 1
) {
  const dots = getBluetoothPrinterDots();
  const config = {
    ...DEFAULT_LABEL_CONFIG,
    showBarcodeNumber: label.showBarcodeNumber !== false,
    barcodeHeight: 56,
    paperType: getBarcodePrinterPrefs().paperType,
  };
  const chunks: Uint8Array[] = [];

  for (let i = 0; i < copies; i++) {
    chunks.push(escAlign("center"));
    if (label.shopName) {
      chunks.push(escBold(true), escText(label.shopName.toUpperCase()), escBold(false));
    }
    chunks.push(escText(label.productName));

    const canvas = renderBarcodeToCanvas(label.value, config, dots - 16);
    chunks.push(canvasToEscPosRaster(canvas, 90));

    const prices: string[] = [];
    if (label.mrp != null) prices.push(`MRP Rs ${label.mrp.toFixed(2)}`);
    if (label.sellingPrice != null) prices.push(`Rs ${label.sellingPrice.toFixed(2)}`);
    if (prices.length) {
      chunks.push(escBold(true), escText(prices.join("  ")), escBold(false));
    }
    chunks.push(escFeed(2));
  }

  await printEscPosDocument(chunks);
}

export async function printBarcodeLabelsFromPrintRoot(elementId: string) {
  const root = document.getElementById(elementId);
  if (!root) throw new Error("Nothing to print");
  const labels = Array.from(root.querySelectorAll<HTMLElement>(".thermal-label"));
  if (labels.length === 0) throw new Error("No barcode labels found");

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
    await printBarcodeLabelsBluetooth(item, 1);
  }
}

export async function printTextToBluetooth(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/g, ""))
    .filter((line, i, arr) => line.length > 0 || (i > 0 && arr[i - 1].length > 0));

  const chunks: Uint8Array[] = [escAlign("center")];
  for (const line of lines) {
    chunks.push(escText(line.slice(0, 48)));
  }
  await printEscPosDocument(chunks);
}

export async function printElementToBluetooth(elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("Nothing to print");
  await printTextToBluetooth(el.innerText);
}

export function bluetoothPrinterHint(): string {
  if (isCapacitorNative() && !isWebBluetoothSupported()) {
    return "Open this admin page in Chrome to pair a BLE thermal printer, or use the system print dialog after pairing in Android settings.";
  }
  if (!isWebBluetoothSupported()) {
    return "Use Google Chrome or Microsoft Edge to connect a Bluetooth thermal printer.";
  }
  return "Pair a BLE ESC/POS printer (TVS, Epson, Rongta, and most 58/80mm printers). Classic Bluetooth-only models still use the system print dialog.";
}

"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import type { BarcodeFormat, BarcodeLabelConfig } from "@/types/erp";
import { buildLabelStyle, getJsBarcodeOptions, type BarcodeLabelData } from "./barcode-label-utils";
import { mergeBarcodeConfig } from "@/utils/barcode-printer-prefs";

interface BarcodeLabelProps extends BarcodeLabelData {
  /** @deprecated use sellingPrice */
  price?: number;
  format?: BarcodeFormat;
  config?: Partial<BarcodeLabelConfig>;
  className?: string;
}

const DEFAULT_CONFIG: BarcodeLabelConfig = {
  format: "CODE128",
  labelWidthMm: 50,
  labelHeightMm: 25,
  barcodeHeight: 40,
  fontSize: 10,
  printerType: "tvs",
  paperType: "roll58",
  printDensity: "normal",
  fontFamily: "courier",
  showProductName: true,
  showMrp: true,
  showSellingPrice: true,
  showSku: false,
  showBarcodeNumber: true,
  showStoreName: true,
  showMfgDate: false,
  showExpiryDate: false,
};

export function BarcodeLabel({
  value,
  productName,
  shopName,
  sku,
  sellingPrice,
  price,
  mrp,
  mfgDate,
  expiryDate,
  format,
  config: configOverride,
  className,
}: BarcodeLabelProps) {
  const resolvedSelling = sellingPrice ?? price;
  const config = {
    ...DEFAULT_CONFIG,
    ...configOverride,
    ...(format ? { format } : {}),
  };
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const isQr = config.format === "QR";

  useEffect(() => {
    if (isQr) {
      if (!qrCanvasRef.current || !value) return;
      QRCode.toCanvas(qrCanvasRef.current, value, {
        width: Math.max(80, config.barcodeHeight * 2),
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      }).catch(() => {});
      return;
    }

    if (!barcodeCanvasRef.current || !value) return;
    const options = getJsBarcodeOptions(config, value);
    try {
      JsBarcode(barcodeCanvasRef.current, value, options);
    } catch {
      JsBarcode(barcodeCanvasRef.current, value, {
        ...options,
        format: "CODE128",
        width: 1,
        displayValue: true,
        font: "Courier New",
      });
    }
  }, [value, config, isQr]);

  const labelStyle = buildLabelStyle(config);

  return (
    <div
      className={`thermal-label inline-block rounded border border-gray-200 bg-white text-center print:break-inside-avoid ${className ?? ""}`}
      data-barcode-value={value}
      data-product-name={productName}
      data-shop-name={shopName ?? ""}
      data-mrp={mrp ?? ""}
      data-selling-price={resolvedSelling ?? ""}
      style={{
        ...labelStyle,
        fontWeight: 400,
        background: "#ffffff",
      }}
    >
      {config.showStoreName && shopName && (
        <p className="mb-0.5 truncate font-bold uppercase tracking-wide text-green-800" style={{ fontSize: config.fontSize - 1 }}>
          {shopName}
        </p>
      )}
      {config.showProductName && (
        <p className="mb-0.5 truncate font-medium leading-tight">{productName}</p>
      )}
      {config.showSku && sku && (
        <p className="mb-0.5 text-gray-600" style={{ fontSize: config.fontSize - 1 }}>
          SKU: {sku}
        </p>
      )}
      {isQr ? (
        <canvas ref={qrCanvasRef} data-barcode-value={value} className="mx-auto bg-white" />
      ) : (
        <canvas
          ref={barcodeCanvasRef}
          data-barcode-value={value}
          className="mx-auto max-w-full bg-white"
          style={{ imageRendering: "pixelated" }}
        />
      )}
      <div className="mt-0.5 flex flex-wrap justify-center gap-2 font-bold">
        {config.showMrp && mrp != null && <span>MRP ₹{mrp.toFixed(2)}</span>}
        {config.showSellingPrice && resolvedSelling != null && (
          <span>₹{resolvedSelling.toFixed(2)}</span>
        )}
      </div>
      {config.showMfgDate && mfgDate && (
        <p className="text-gray-600" style={{ fontSize: config.fontSize - 2 }}>
          Mfg: {mfgDate}
        </p>
      )}
      {config.showExpiryDate && expiryDate && (
        <p className="text-gray-600" style={{ fontSize: config.fontSize - 2 }}>
          Exp: {expiryDate}
        </p>
      )}
    </div>
  );
}

export function printBarcodeLabels(
  title = "Barcode Labels",
  config: BarcodeLabelConfig = DEFAULT_CONFIG
) {
  const el = document.getElementById("barcode-labels-print");
  if (!el) return;
  import("@/utils/bluetooth-printer").then(
    ({ isBluetoothPrinterConnected, printBarcodeLabelsFromPrintRoot }) => {
      if (isBluetoothPrinterConnected()) {
        void printBarcodeLabelsFromPrintRoot("barcode-labels-print").catch((err) => {
          console.warn("Bluetooth barcode print failed", err);
          import("./barcode-label-utils").then(({ printBarcodeLabelsFromElement }) =>
            printBarcodeLabelsFromElement(
              "barcode-labels-print",
              title,
              mergeBarcodeConfig(config)
            )
          );
        });
        return;
      }
      import("./barcode-label-utils").then(({ printBarcodeLabelsFromElement }) =>
        printBarcodeLabelsFromElement(
          "barcode-labels-print",
          title,
          mergeBarcodeConfig(config)
        )
      );
    }
  );
}

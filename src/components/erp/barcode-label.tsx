"use client";

import { useEffect, useRef, useState } from "react";
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
  barcodeHeight: 56,
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
  const barcodeSvgRef = useRef<SVGSVGElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const isQr = config.format === "QR";

  useEffect(() => {
    if (isQr) {
      if (!value) return;
      QRCode.toDataURL(value, {
        width: Math.max(100, Math.min(240, (config.barcodeHeight || 56) * 2)),
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      })
        .then(setQrDataUrl)
        .catch(() => {});
      return;
    }

    if (!barcodeSvgRef.current || !value) return;
    const options = getJsBarcodeOptions(config, value);
    try {
      JsBarcode(barcodeSvgRef.current, value, options);
    } catch {
      try {
        JsBarcode(barcodeSvgRef.current, value, {
          ...options,
          format: "CODE128",
        });
      } catch {
        JsBarcode(barcodeSvgRef.current, value, {
          ...options,
          format: "CODE128",
          width: 1,
          displayValue: true,
          font: "Courier New",
        });
      }
    }
  }, [
    value,
    isQr,
    config.format,
    config.barcodeHeight,
    config.fontSize,
    config.fontFamily,
    config.showBarcodeNumber,
    config.labelWidthMm,
    config.paperType,
  ]);

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
        <p
          className="mb-0.5 truncate font-bold uppercase tracking-wide text-black"
          style={{ fontSize: `${Math.max(8, config.fontSize - 1)}px` }}
        >
          {shopName}
        </p>
      )}
      {config.showProductName && (
        <p
          className="mb-0.5 truncate font-medium leading-tight text-black"
          style={{ fontSize: `${config.fontSize}px` }}
        >
          {productName}
        </p>
      )}
      {config.showSku && sku && (
        <p
          className="mb-0.5 text-black"
          style={{ fontSize: `${Math.max(7, config.fontSize - 2)}px` }}
        >
          SKU: {sku}
        </p>
      )}
      {isQr ? (
        qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={value}
            data-barcode-value={value}
            className="mx-auto block bg-white"
            style={{
              maxHeight: `${Math.max(40, (config.barcodeHeight || 56) + 10)}px`,
              maxWidth: "100%",
            }}
          />
        ) : (
          <div className="mx-auto h-12 w-12 bg-gray-100" />
        )
      ) : (
        <svg
          ref={barcodeSvgRef}
          data-barcode-value={value}
          className="mx-auto block max-w-full bg-white"
          style={{
            maxHeight: `${Math.max(25, (config.barcodeHeight || 56) + 26)}px`,
            height: "auto",
          }}
        />
      )}
      <div
        className="mt-0.5 flex flex-wrap items-center justify-center gap-2 font-bold text-black"
        style={{ fontSize: `${config.fontSize}px` }}
      >
        {config.showMrp && mrp != null && <span>MRP ₹{mrp.toFixed(2)}</span>}
        {config.showSellingPrice && resolvedSelling != null && (
          <span>₹{resolvedSelling.toFixed(2)}</span>
        )}
      </div>
      {config.showMfgDate && mfgDate && (
        <p
          className="text-black"
          style={{ fontSize: `${Math.max(7, config.fontSize - 2)}px` }}
        >
          Mfg: {mfgDate}
        </p>
      )}
      {config.showExpiryDate && expiryDate && (
        <p
          className="text-black"
          style={{ fontSize: `${Math.max(7, config.fontSize - 2)}px` }}
        >
          Exp: {expiryDate}
        </p>
      )}
    </div>
  );
}

export async function printBarcodeLabels(
  title = "Barcode Labels",
  config: BarcodeLabelConfig = DEFAULT_CONFIG,
  elementId = "barcode-labels-print"
): Promise<boolean> {
  const el = document.getElementById(elementId);
  if (!el) return false;
  const mergedConfig = mergeBarcodeConfig(config);

  try {
    const { isBluetoothPrinterConnected, printBarcodeLabelsFromPrintRoot } = await import(
      "@/utils/bluetooth-printer"
    );
    if (isBluetoothPrinterConnected()) {
      await printBarcodeLabelsFromPrintRoot(elementId, mergedConfig);
      return true;
    }
  } catch (err) {
    console.warn("Bluetooth barcode print failed, falling back to system print", err);
  }

  const { printBarcodeLabelsFromElement } = await import("./barcode-label-utils");
  return printBarcodeLabelsFromElement(elementId, title, mergedConfig);
}

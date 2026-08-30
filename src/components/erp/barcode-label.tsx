"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import type { BarcodeFormat, BarcodeLabelConfig } from "@/types/erp";
import {
  buildLabelStyle,
  FONT_FAMILY_CSS,
  getBarcodeBarWidth,
  resolveJsBarcodeFormat,
  type BarcodeLabelData,
} from "./barcode-label-utils";
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
  const svgRef = useRef<SVGSVGElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const isQr = config.format === "QR";

  useEffect(() => {
    if (isQr) {
      if (!qrCanvasRef.current || !value) return;
      QRCode.toCanvas(qrCanvasRef.current, value, {
        width: config.barcodeHeight,
        margin: 1,
      }).catch(() => {});
      return;
    }

    if (!svgRef.current || !value) return;
    const jsFormat = resolveJsBarcodeFormat(config.format, value);
    const barWidth = getBarcodeBarWidth(config);
    try {
      JsBarcode(svgRef.current, value, {
        format: jsFormat,
        width: barWidth,
        height: config.barcodeHeight,
        displayValue: config.showBarcodeNumber,
        fontSize: config.fontSize,
        font: FONT_FAMILY_CSS[config.fontFamily].split(",")[0].replace(/"/g, ""),
        margin: 2,
      });
    } catch {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        width: barWidth,
        height: config.barcodeHeight,
        displayValue: true,
        fontSize: config.fontSize,
        font: "Courier New",
      });
    }
  }, [value, config, isQr]);

  const labelStyle = buildLabelStyle(config);

  return (
    <div
      className={`thermal-label inline-block rounded border border-gray-200 bg-white text-center print:break-inside-avoid ${className ?? ""}`}
      style={{
        ...labelStyle,
        fontWeight: config.printDensity === "dark" ? 700 : 400,
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
        <canvas ref={qrCanvasRef} className="mx-auto" />
      ) : (
        <svg ref={svgRef} className="mx-auto max-w-full" />
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
  import("./barcode-label-utils").then(({ printBarcodeLabelsFromElement }) =>
    printBarcodeLabelsFromElement(
      "barcode-labels-print",
      title,
      mergeBarcodeConfig(config)
    )
  );
}

"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import type { BarcodeFormat, BarcodeLabelConfig } from "@/types/erp";
import {
  buildLabelStyle,
  resolveJsBarcodeFormat,
  type BarcodeLabelData,
} from "./barcode-label-utils";

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
    try {
      JsBarcode(svgRef.current, value, {
        format: jsFormat,
        width: config.printerType === "tvs" ? 1.5 : 2,
        height: config.barcodeHeight,
        displayValue: config.showBarcodeNumber,
        fontSize: config.fontSize,
        margin: 2,
      });
    } catch {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        width: 2,
        height: config.barcodeHeight,
        displayValue: true,
        fontSize: config.fontSize,
      });
    }
  }, [value, config, isQr]);

  const labelStyle = buildLabelStyle(config);

  return (
    <div
      className={`thermal-label inline-block rounded border border-gray-200 bg-white text-center print:break-inside-avoid ${className ?? ""}`}
      style={labelStyle}
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

export function printBarcodeLabels(title = "Barcode Labels", printerType: BarcodeLabelConfig["printerType"] = "tvs") {
  const el = document.getElementById("barcode-labels-print");
  if (!el) return;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`
    <html><head><title>${title}</title>
    <style>
      body{font-family:Arial,sans-serif;display:flex;flex-wrap:wrap;gap:2mm;margin:0;padding:2mm;}
      .thermal-label{page-break-inside:avoid;}
      @page{margin:2mm;}
    </style>
    </head><body>${el.innerHTML}</body></html>
  `);
  w.document.close();
  w.print();
}

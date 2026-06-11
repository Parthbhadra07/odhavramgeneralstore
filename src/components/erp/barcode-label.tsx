"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeLabelProps {
  value: string;
  productName: string;
  shopName?: string;
  price?: number;
  mrp?: number;
  format?: "EAN13" | "CODE128";
}

export function BarcodeLabel({
  value,
  productName,
  shopName,
  price,
  mrp,
  format = "CODE128",
}: BarcodeLabelProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: format === "EAN13" && value.length === 13 ? "EAN13" : "CODE128",
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 14,
      });
    } catch {
      JsBarcode(svgRef.current, value, { format: "CODE128", width: 2, height: 60 });
    }
  }, [value, format]);

  return (
    <div className="inline-block w-[220px] rounded border bg-white p-3 text-center print:break-inside-avoid">
      {shopName && (
        <p className="mb-1 truncate text-[10px] font-bold uppercase tracking-wide text-green-800">
          {shopName}
        </p>
      )}
      <p className="mb-1 max-w-[200px] truncate text-xs font-medium">{productName}</p>
      <svg ref={svgRef} className="mx-auto" />
      <div className="mt-1 flex justify-center gap-3 text-sm font-bold">
        {mrp != null && <span>MRP ₹{mrp.toFixed(2)}</span>}
        {price != null && mrp == null && <span>₹{price.toFixed(2)}</span>}
      </div>
    </div>
  );
}

export function printBarcodeLabels(title = "Barcode Labels") {
  const el = document.getElementById("barcode-labels-print");
  if (!el) return;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`
    <html><head><title>${title}</title>
    <style>
      body{font-family:sans-serif;display:flex;flex-wrap:wrap;gap:8px;}
      @page{margin:10mm;}
    </style>
    </head><body>${el.innerHTML}</body></html>
  `);
  w.document.close();
  w.print();
}

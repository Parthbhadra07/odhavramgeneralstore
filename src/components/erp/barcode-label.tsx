"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeLabelProps {
  value: string;
  productName: string;
  price?: number;
  format?: "EAN13" | "CODE128";
}

export function BarcodeLabel({
  value,
  productName,
  price,
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
    <div className="inline-block rounded border bg-white p-3 text-center print:break-inside-avoid">
      <p className="mb-1 max-w-[200px] truncate text-xs font-medium">{productName}</p>
      <svg ref={svgRef} />
      {price != null && (
        <p className="mt-1 text-sm font-bold">₹{price.toFixed(2)}</p>
      )}
    </div>
  );
}

export function printBarcodeLabels() {
  const el = document.getElementById("barcode-labels-print");
  if (!el) return;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`
    <html><head><title>Barcode Labels</title>
    <style>body{font-family:sans-serif;} @page{margin:10mm;}</style>
    </head><body>${el.innerHTML}</body></html>
  `);
  w.document.close();
  w.print();
}

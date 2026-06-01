"use client";

import { APP_NAME, STORE_PHONE } from "@/lib/constants";
import { POS_PAYMENT_LABELS } from "@/lib/erp/constants";
import { formatPrice, formatDate } from "@/utils/format";
import type { PosSale } from "@/types/erp";

interface PosThermalReceiptProps {
  sale: PosSale;
  width?: "58mm" | "80mm";
}

export function PosThermalReceipt({ sale, width = "80mm" }: PosThermalReceiptProps) {
  const items = sale.pos_sale_items ?? [];
  const w = width === "58mm" ? "58mm" : "80mm";

  return (
    <div
      id="pos-thermal-receipt"
      className="thermal-receipt mx-auto bg-white font-mono text-black"
      style={{ width: w, maxWidth: w, fontSize: width === "58mm" ? "10px" : "12px" }}
    >
      <div className="border-b border-dashed border-black pb-2 text-center">
        <p className="text-sm font-bold uppercase leading-tight">{APP_NAME}</p>
        <p className="mt-1">Mobile: {STORE_PHONE}</p>
      </div>

      <div className="border-b border-dashed border-black py-2 text-xs">
        <p>Bill: {sale.bill_number}</p>
        <p>Date: {formatDate(sale.created_at)}</p>
        {sale.customer_name && <p>Customer: {sale.customer_name}</p>}
        {sale.customer_mobile && <p>Mobile: {sale.customer_mobile}</p>}
        <p>
          Payment:{" "}
          {POS_PAYMENT_LABELS[sale.payment_method as keyof typeof POS_PAYMENT_LABELS] ??
            sale.payment_method}
        </p>
      </div>

      <table className="w-full border-collapse py-2 text-xs">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1 text-left">Item</th>
            <th className="py-1 text-center">Qty</th>
            <th className="py-1 text-right">Rate</th>
            <th className="py-1 text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-dotted border-gray-400">
              <td className="py-1 pr-1 leading-tight">{item.product_name}</td>
              <td className="py-1 text-center">{item.quantity}</td>
              <td className="py-1 text-right">{formatPrice(item.rate)}</td>
              <td className="py-1 text-right">{formatPrice(item.total_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-dashed border-black py-2 text-xs">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatPrice(sale.subtotal)}</span>
        </div>
        {Number(sale.cgst) > 0 && (
          <div className="flex justify-between">
            <span>CGST</span>
            <span>{formatPrice(sale.cgst)}</span>
          </div>
        )}
        {Number(sale.sgst) > 0 && (
          <div className="flex justify-between">
            <span>SGST</span>
            <span>{formatPrice(sale.sgst)}</span>
          </div>
        )}
        {Number(sale.igst) > 0 && (
          <div className="flex justify-between">
            <span>IGST</span>
            <span>{formatPrice(sale.igst)}</span>
          </div>
        )}
        {Number(sale.discount) > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{formatPrice(sale.discount)}</span>
          </div>
        )}
      </div>

      <div className="border-t-2 border-black py-2 text-sm font-bold">
        <div className="flex justify-between">
          <span>TOTAL</span>
          <span>{formatPrice(sale.total_amount)}</span>
        </div>
      </div>

      <p className="border-t border-dashed border-black pt-2 text-center text-xs">
        Thank You! Visit Again.
      </p>
    </div>
  );
}

export function printPosThermalReceipt(width: "58mm" | "80mm" = "80mm") {
  const receipt = document.getElementById("pos-thermal-receipt");
  if (!receipt) return;
  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (!printWindow) return;
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>POS Receipt</title>
        <style>
          @page { margin: 0; size: ${width} auto; }
          body { margin: 0; padding: 4mm; font-family: monospace; color: #000; background: #fff; }
          .thermal-receipt { width: ${width}; max-width: ${width}; }
          table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>${receipt.outerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}

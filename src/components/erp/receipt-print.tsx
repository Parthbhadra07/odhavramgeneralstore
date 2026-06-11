"use client";

import type { ReceiptData, StoreSettings } from "@/types/erp";
import { formatPrice } from "@/utils/format";
import { settingsService } from "@/services/erp/settings.service";
import { UpiQr } from "@/components/erp/upi-qr";

interface ReceiptPrintProps {
  data: ReceiptData;
  settings?: StoreSettings | null;
  width?: "58mm" | "80mm";
  id?: string;
}

function shouldShowUpiQr(data: ReceiptData, settings: StoreSettings): boolean {
  if (!settings.enable_upi_qr || !settings.upi_id || data.grandTotal <= 0) {
    return false;
  }
  if (data.showUpiQr === false) return false;
  const method = data.paymentMethod.toLowerCase();
  if (method.includes("cod") || method.includes("cash on delivery")) return false;
  return true;
}

function wrapName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  const words = name.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length <= maxLen) {
      current = (current + " " + w).trim();
    } else {
      if (current) lines.push(current);
      current = w.length > maxLen ? w.slice(0, maxLen) : w;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

export function ReceiptPrint({
  data,
  settings: settingsProp,
  width = "80mm",
  id = "thermal-receipt",
}: ReceiptPrintProps) {
  const settings = settingsProp ?? {
    ...settingsService.getDefaults(),
    id: "default",
    created_at: "",
    updated_at: "",
  };

  const w = width === "58mm" ? "58mm" : "80mm";
  const fontSize = width === "58mm" ? "9px" : "11px";
  const nameMax = width === "58mm" ? 14 : 20;
  const showUpiQr = shouldShowUpiQr(data, settings);
  const upiPayAmount = data.upiAmount ?? data.creditDue ?? data.grandTotal;
  const upiUrl = showUpiQr
    ? settingsService.buildUpiUrl(settings, upiPayAmount)
    : null;

  return (
    <div
      id={id}
      className="thermal-receipt thermal-receipt-border mx-auto bg-white font-mono text-black"
      style={{ width: w, maxWidth: w, fontSize, lineHeight: 1.4 }}
    >
      {/* Store header */}
      <div className="pb-2 text-center">
        {settings.store_logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.store_logo_url}
            alt=""
            className="mx-auto mb-2 h-12 w-auto object-contain"
          />
        )}
        <p
          className="font-bold uppercase leading-tight tracking-wide"
          style={{ fontSize: width === "58mm" ? "12px" : "14px" }}
        >
          {settings.store_name}
        </p>
        <p className="mt-1">Mobile: {settings.store_mobile}</p>
        {settings.store_address && (
          <p className="mt-1 text-[0.85em] leading-snug">{settings.store_address}</p>
        )}
      </div>

      <div className="thermal-line-solid" />

      {/* Order ID */}
      <div className="py-1 text-center text-[0.95em]">
        <p className="font-bold">Order ID: {data.orderId}</p>
        <p className="text-[0.9em]">
          {data.date} · {data.time}
        </p>
        {data.cashierName && (
          <p className="text-[0.9em]">Cashier: {data.cashierName}</p>
        )}
      </div>

      <div className="thermal-line" />

      {/* Customer box */}
      {(data.customerName || data.customerMobile || data.deliveryAddress) && (
        <>
          <p className="thermal-section-title">Customer Information</p>
          <div className="thermal-line" />
          <div className="py-1 text-[0.95em]">
            {data.customerName && (
              <p>
                <span className="font-semibold">Name:</span> {data.customerName}
              </p>
            )}
            {data.customerMobile && (
              <p>
                <span className="font-semibold">Mobile:</span> {data.customerMobile}
              </p>
            )}
            {data.deliveryAddress && (
              <p className="mt-1 whitespace-pre-wrap break-words">
                <span className="font-semibold">Address:</span> {data.deliveryAddress}
              </p>
            )}
          </div>
          <div className="thermal-line" />
        </>
      )}

      {/* Items */}
      <p className="thermal-section-title">Items</p>
      <div className="thermal-line" />

      <table className="w-full border-collapse text-[0.95em]">
        <thead>
          <tr>
            <th className="py-1 text-left font-bold">Item</th>
            <th className="py-1 text-center font-bold">Qty</th>
            <th className="py-1 text-right font-bold">Rate</th>
            <th className="py-1 text-right font-bold">Amt</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr key={i}>
              <td className="py-0.5 pr-1 align-top whitespace-pre-wrap">
                {wrapName(item.name, nameMax)}
              </td>
              <td className="py-0.5 text-center align-top">{item.quantity}</td>
              <td className="py-0.5 text-right align-top">{formatPrice(item.rate)}</td>
              <td className="py-0.5 text-right align-top">{formatPrice(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="thermal-line" />

      {/* Totals */}
      <div className="py-1 text-[0.95em]">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatPrice(data.subtotal)}</span>
        </div>
        {data.deliveryCharge !== undefined && (
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>{formatPrice(data.deliveryCharge)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>
            Discount
            {data.discountPercent ? ` (${data.discountPercent}%)` : ""}
          </span>
          <span>{formatPrice(data.discount ?? 0)}</span>
        </div>
        {(data.taxCgst ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>CGST</span>
            <span>{formatPrice(data.taxCgst!)}</span>
          </div>
        )}
        {(data.taxSgst ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>SGST</span>
            <span>{formatPrice(data.taxSgst!)}</span>
          </div>
        )}
        {(data.taxIgst ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>IGST</span>
            <span>{formatPrice(data.taxIgst!)}</span>
          </div>
        )}
        <p className="mt-1 text-[0.85em]">
          Payment: {data.paymentMethod}
          {data.orderStatus ? ` · ${data.orderStatus}` : ""}
        </p>
        {(data.creditDue ?? 0) > 0 && (
          <p className="mt-1 font-semibold text-[0.85em]">
            Credit This Bill: {formatPrice(data.creditDue!)}
          </p>
        )}
        {data.creditBalance !== undefined && data.creditBalance > 0 && (
          <p className="text-[0.85em]">
            Total Credit Due: {formatPrice(data.creditBalance)}
          </p>
        )}
      </div>

      <div className="thermal-line-solid" />

      <div
        className="flex justify-between py-1 font-bold"
        style={{ fontSize: width === "58mm" ? "13px" : "16px" }}
      >
        <span>GRAND TOTAL</span>
        <span>{formatPrice(data.grandTotal)}</span>
      </div>

      <div className="thermal-line-solid" />

      {/* UPI QR — shown on all bills when enabled in settings */}
      {showUpiQr && upiUrl && (
        <>
          <div className="py-2 text-center">
            <p className="mb-1 text-[0.9em] font-semibold">Scan to Pay via UPI</p>
            <p className="mb-1 text-[0.85em]">Amount: {formatPrice(upiPayAmount)}</p>
            <div className="flex justify-center">
              <UpiQr upiUrl={upiUrl} size={width === "58mm" ? 100 : 130} />
            </div>
            {settings.upi_id && (
              <p className="mt-1 text-[0.8em]">{settings.upi_id}</p>
            )}
            {settings.upi_merchant_name && (
              <p className="mt-1 text-[0.85em]">{settings.upi_merchant_name}</p>
            )}
          </div>
          <div className="thermal-line" />
        </>
      )}

      {/* Footer — text only, no barcodes */}
      <div className="pt-2 text-center text-[0.95em]">
        <p className="font-semibold">
          {settings.receipt_header_text ?? "Thank You! Visit Again"}
        </p>
        <p className="mt-2 font-bold uppercase">{settings.store_name}</p>
        {settings.receipt_footer_text && (
          <p className="mt-1 text-[0.85em]">{settings.receipt_footer_text}</p>
        )}
      </div>

      <div className="thermal-line-solid" />
    </div>
  );
}

export function getReceiptPrintStyles(width: "58mm" | "80mm") {
  return `
    @page { margin: 0; size: ${width} auto; }
    * { box-sizing: border-box; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; padding: 3mm; font-family: "Courier New", Courier, monospace; color: #000; background: #fff; }
    .thermal-receipt { width: ${width}; max-width: ${width}; overflow: hidden; }
    .thermal-receipt-border { border: 2px solid #000; padding: 8px; }
    .thermal-line { border-top: 1px dashed #000; margin: 6px 0; }
    .thermal-line-solid { border-top: 2px solid #000; margin: 6px 0; }
    .thermal-section-title { text-align: center; font-weight: 700; text-transform: uppercase; font-size: 0.85em; letter-spacing: 0.05em; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    td, th { word-wrap: break-word; overflow-wrap: break-word; }
    img, canvas, svg { max-width: 100%; height: auto; }
  `;
}

export function printReceipt(
  elementId = "thermal-receipt",
  width: "58mm" | "80mm" = "80mm"
) {
  const receipt = document.getElementById(elementId);
  if (!receipt) return;
  const printWindow = window.open("", "_blank", "width=400,height=700");
  if (!printWindow) return;
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt</title>
        <style>${getReceiptPrintStyles(width)}</style>
      </head>
      <body>${receipt.outerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };
}

export function downloadReceiptPdf(
  elementId = "thermal-receipt",
  width: "58mm" | "80mm" = "80mm",
  filename = "receipt"
) {
  const receipt = document.getElementById(elementId);
  if (!receipt) return;
  const printWindow = window.open("", "_blank", "width=400,height=700");
  if (!printWindow) return;
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${filename}</title>
        <style>${getReceiptPrintStyles(width)}</style>
      </head>
      <body>${receipt.outerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.document.title = filename;
  printWindow.focus();
  printWindow.print();
}

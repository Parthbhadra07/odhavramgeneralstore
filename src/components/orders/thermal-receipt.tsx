"use client";

import { APP_NAME, STORE_PHONE, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { ORDER_STATUS_LABELS, type StoreOrderStatus } from "@/lib/constants";
import { formatPrice, formatDate } from "@/utils/format";
import { orderItemsSubtotal, resolveDeliveryCharge } from "@/utils/order-pricing";
import type { Order } from "@/types/database";

interface ThermalReceiptProps {
  order: Order;
  width?: "58mm" | "80mm";
}

export function ThermalReceipt({ order, width = "80mm" }: ThermalReceiptProps) {
  const items = order.order_items ?? [];
  const subtotal = orderItemsSubtotal(items);
  const delivery = resolveDeliveryCharge(
    subtotal,
    order.total_amount,
    order.delivery_charge
  );
  const w = width === "58mm" ? "58mm" : "80mm";

  return (
    <div
      id="thermal-receipt"
      className="thermal-receipt mx-auto bg-white font-mono text-black"
      style={{ width: w, maxWidth: w, fontSize: width === "58mm" ? "10px" : "12px" }}
    >
      <div className="border-b border-dashed border-black pb-2 text-center">
        <p className="text-sm font-bold uppercase leading-tight">{APP_NAME}</p>
        <p className="mt-1">Mobile: {STORE_PHONE}</p>
      </div>

      <div className="border-b border-dashed border-black py-2 text-xs">
        <p>Order ID: {order.order_number ?? order.id.slice(0, 8)}</p>
        <p>Date: {formatDate(order.created_at)}</p>
        <p>Customer: {order.customer_name ?? order.users?.name ?? "—"}</p>
        <p>Mobile: {order.customer_phone ?? order.users?.phone ?? "—"}</p>
        <p>
          Status:{" "}
          {ORDER_STATUS_LABELS[order.order_status as StoreOrderStatus] ??
            order.order_status}
        </p>
        <p>
          Payment:{" "}
          {PAYMENT_METHOD_LABELS[order.payment_method ?? "cod"] ??
            order.payment_method}
        </p>
      </div>

      {order.addresses && (
        <div className="border-b border-dashed border-black py-2 text-xs">
          <p className="font-bold">Delivery Address:</p>
          <p>{order.addresses.address_line}</p>
          <p>
            {order.addresses.city}, {order.addresses.state} -{" "}
            {order.addresses.postal_code}
          </p>
        </div>
      )}

      <table className="w-full border-collapse py-2 text-xs">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1 text-left">Item</th>
            <th className="py-1 text-center">Qty</th>
            <th className="py-1 text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-dotted border-gray-400">
              <td className="py-1 pr-1 leading-tight">
                {item.products?.name ?? "Item"}
              </td>
              <td className="py-1 text-center">{item.quantity}</td>
              <td className="py-1 text-right">
                {formatPrice(item.price * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-dashed border-black py-2 text-xs">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Delivery</span>
          <span>{delivery === 0 ? "FREE" : formatPrice(delivery)}</span>
        </div>
      </div>

      <div className="border-t-2 border-black py-2 text-sm font-bold">
        <div className="flex justify-between">
          <span>GRAND TOTAL</span>
          <span>{formatPrice(order.total_amount)}</span>
        </div>
      </div>

      <p className="border-t border-dashed border-black pt-2 text-center text-xs">
        Thank You! Visit Again.
      </p>
      <p className="mt-1 text-center text-[10px]">— {APP_NAME} —</p>
    </div>
  );
}

export function printThermalReceipt(width: "58mm" | "80mm" = "80mm") {
  const receipt = document.getElementById("thermal-receipt");
  if (!receipt) return;

  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt</title>
        <style>
          @page { margin: 0; size: ${width} auto; }
          body { margin: 0; padding: 4mm; font-family: monospace; color: #000; background: #fff; }
          .thermal-receipt { width: ${width}; max-width: ${width}; }
          table { width: 100%; border-collapse: collapse; }
          * { color: #000 !important; }
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

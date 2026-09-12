"use client";

import { ReceiptPrint, printReceipt } from "@/components/erp/receipt-print";
import { receiptFromOrder } from "@/utils/receipt";
import type { Order } from "@/types/database";
import type { StoreSettings } from "@/types/erp";
import type { ReceiptWidth } from "@/utils/printer-prefs";

interface ThermalReceiptProps {
  order: Order;
  settings?: StoreSettings | null;
  width?: ReceiptWidth;
}

export function ThermalReceipt({ order, settings, width = "80mm" }: ThermalReceiptProps) {
  const data = receiptFromOrder(order);
  return (
    <ReceiptPrint
      data={data}
      settings={settings}
      width={width}
      id="thermal-receipt"
    />
  );
}

export function printThermalReceipt(width: ReceiptWidth = "80mm") {
  printReceipt("thermal-receipt", width);
}

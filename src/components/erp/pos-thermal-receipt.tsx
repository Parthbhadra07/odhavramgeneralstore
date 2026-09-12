"use client";

import { ReceiptPrint, printReceipt } from "@/components/erp/receipt-print";
import { receiptFromPosSale } from "@/utils/receipt";
import type { PosSale, StoreSettings } from "@/types/erp";
import type { ReceiptWidth } from "@/utils/printer-prefs";

interface PosThermalReceiptProps {
  sale: PosSale;
  settings?: StoreSettings | null;
  width?: ReceiptWidth;
}

export function PosThermalReceipt({
  sale,
  settings,
  width = "80mm",
}: PosThermalReceiptProps) {
  const data = receiptFromPosSale(sale);
  return (
    <ReceiptPrint
      data={data}
      settings={settings}
      width={width}
      id="pos-thermal-receipt"
    />
  );
}

export function printPosThermalReceipt(width: ReceiptWidth = "80mm") {
  printReceipt("pos-thermal-receipt", width);
}

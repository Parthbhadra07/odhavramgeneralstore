"use client";

import { useState } from "react";
import { Eye, Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ReceiptPrint,
  printReceipt,
  downloadReceiptPdf,
} from "@/components/erp/receipt-print";
import { getReceiptPreviewStyles } from "@/utils/receipt-styles";
import type { ReceiptData, StoreSettings } from "@/types/erp";

interface ReceiptActionsProps {
  data: ReceiptData;
  settings?: StoreSettings | null;
  defaultWidth?: "58mm" | "80mm";
  receiptId?: string;
}

export function ReceiptActions({
  data,
  settings,
  defaultWidth = "80mm",
  receiptId = "thermal-receipt",
}: ReceiptActionsProps) {
  const [width, setWidth] = useState<"58mm" | "80mm">(defaultWidth);
  const [showPreview, setShowPreview] = useState(false);

  const handlePrint = () => {
    requestAnimationFrame(() => {
      printReceipt(receiptId, width);
    });
  };

  const handleReprint = () => handlePrint();

  const handlePdf = () => {
    requestAnimationFrame(() => {
      downloadReceiptPdf(receiptId, width, `receipt-${data.orderId}`);
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={width}
          onChange={(e) => setWidth(e.target.value as "58mm" | "80mm")}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          aria-label="Receipt width"
        >
          <option value="58mm">58mm</option>
          <option value="80mm">80mm</option>
        </select>
        <Button size="sm" variant="outline" onClick={() => setShowPreview(true)}>
          <Eye className="mr-1 h-4 w-4" />
          Preview
        </Button>
        <Button size="sm" variant="outline" onClick={handlePrint}>
          <Printer className="mr-1 h-4 w-4" />
          Print Receipt
        </Button>
        <Button size="sm" variant="outline" onClick={handleReprint}>
          <Printer className="mr-1 h-4 w-4" />
          Reprint
        </Button>
        <Button size="sm" variant="outline" onClick={handlePdf}>
          <Download className="mr-1 h-4 w-4" />
          Download PDF
        </Button>
      </div>

      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="max-h-[90vh] overflow-y-auto rounded-xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="font-semibold">Receipt Preview</h3>
              <div className="flex gap-2">
                <Button size="sm" onClick={handlePrint}>
                  <Printer className="mr-1 h-4 w-4" />
                  Print
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowPreview(false)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="receipt-preview-scope">
              <style>{getReceiptPreviewStyles(width)}</style>
              <ReceiptPrint
                data={data}
                settings={settings}
                width={width}
                id={receiptId}
              />
            </div>
          </div>
        </div>
      )}

      {/* Hidden receipt for print when preview modal is closed */}
      {!showPreview && (
        <div
          className="pointer-events-none fixed -left-[9999px] top-0"
          aria-hidden="true"
        >
          <ReceiptPrint
            data={data}
            settings={settings}
            width={width}
            id={receiptId}
          />
        </div>
      )}
    </>
  );
}

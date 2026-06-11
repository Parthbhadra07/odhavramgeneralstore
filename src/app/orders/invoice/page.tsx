"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { orderService } from "@/services/order.service";
import { ReceiptActions } from "@/components/erp/receipt-actions";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { receiptFromOrder } from "@/utils/receipt";
import { CallStoreButton } from "@/components/call-store-button";
import { STORE_PHONE, APP_NAME } from "@/lib/constants";
import type { Order } from "@/types/database";

function InvoiceContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const [order, setOrder] = useState<Order | null>(null);
  const { settings } = useStoreSettings();

  useEffect(() => {
    if (id) orderService.getById(id).then(setOrder);
  }, [id]);

  if (!id) return <p className="p-8 text-center">Invalid invoice.</p>;
  if (!order) return <p className="p-8 text-center">Loading invoice...</p>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 print:hidden">
        <h1 className="mb-4 text-2xl font-bold">Invoice / Bill</h1>
        <ReceiptActions
          data={receiptFromOrder(order)}
          settings={settings}
          defaultWidth={settings?.receipt_width ?? "80mm"}
          receiptId="thermal-receipt"
        />
      </div>

      <p className="mt-4 text-center text-sm text-gray-500 print:hidden">
        {APP_NAME} · {STORE_PHONE}
      </p>
      <CallStoreButton className="mx-auto mt-4 print:hidden" />
    </div>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<p className="p-8 text-center">Loading...</p>}>
      <InvoiceContent />
    </Suspense>
  );
}

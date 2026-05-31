"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { orderService } from "@/services/order.service";
import { ThermalReceipt, printThermalReceipt } from "@/components/orders/thermal-receipt";
import { Button } from "@/components/ui/button";
import { CallStoreButton } from "@/components/call-store-button";
import { STORE_PHONE, APP_NAME } from "@/lib/constants";
import type { Order } from "@/types/database";

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [width, setWidth] = useState<"58mm" | "80mm">("80mm");

  useEffect(() => {
    if (id) orderService.getById(id).then(setOrder);
  }, [id]);

  if (!order) return <p className="p-8 text-center">Loading invoice...</p>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <h1 className="text-2xl font-bold">Invoice / Bill</h1>
        <div className="flex flex-wrap gap-2">
          <select
            value={width}
            onChange={(e) => setWidth(e.target.value as "58mm" | "80mm")}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="58mm">58mm Thermal</option>
            <option value="80mm">80mm Thermal</option>
          </select>
          <Button onClick={() => printThermalReceipt(width)}>Print Bill</Button>
          <Button variant="outline" onClick={() => window.print()}>
            Browser Print
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-md rounded-xl border bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        <ThermalReceipt order={order} width={width} />
      </div>

      <p className="mt-4 text-center text-sm text-gray-500 print:hidden">
        {APP_NAME} · {STORE_PHONE}
      </p>
      <CallStoreButton className="mx-auto mt-4 print:hidden" />
    </div>
  );
}

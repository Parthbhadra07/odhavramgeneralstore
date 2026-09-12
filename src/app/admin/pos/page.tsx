"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Monitor, FileSpreadsheet, Tag } from "lucide-react";
import { PosQuickBilling } from "@/components/erp/pos-quick-billing";
import { PosInvoiceBilling } from "@/components/erp/pos-invoice-billing";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

type PosTab = "quick" | "invoice";

const STORAGE_KEY = "ogs-pos-tab";

export default function PosPage() {
  const [tab, setTab] = useState<PosTab>("quick");

  useEffect(() => {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    if (saved === "quick" || saved === "invoice") setTab(saved);
  }, []);

  const selectTab = (next: PosTab) => {
    setTab(next);
    window.sessionStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex w-full max-w-md rounded-lg border bg-white p-1">
          <button
            type="button"
            onClick={() => selectTab("quick")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
              tab === "quick"
                ? "bg-green-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <Monitor className="h-4 w-4" />
            Quick POS
          </button>
          <button
            type="button"
            onClick={() => selectTab("invoice")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
              tab === "invoice"
                ? "bg-[#1a365d] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Invoice POS
          </button>
        </div>

        <Link href="/admin/inventory/price-checker">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 font-semibold text-xs shadow-sm"
          >
            <Tag className="h-3.5 w-3.5 text-blue-600" />
            Full Price &amp; Stock Checker
          </Button>
        </Link>
      </div>
      {tab === "quick" ? <PosQuickBilling /> : <PosInvoiceBilling />}
    </div>
  );
}

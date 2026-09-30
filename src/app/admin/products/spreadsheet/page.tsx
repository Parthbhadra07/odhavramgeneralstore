"use client";

import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, Plus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { MultiProductSpreadsheet } from "@/components/admin/multi-product-spreadsheet";
import { Button } from "@/components/ui/button";

export default function MultiProductSpreadsheetPage() {
  const router = useRouter();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="admin-page-title">Add Multiple Products (Excel Grid)</h1>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                Excel Sheet Format
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Quickly enter multiple products at once with barcodes, prices, stock, and loose item weight configuration.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/products">
            <Button variant="outline" size="sm" className="text-xs">
              Back to Catalog
            </Button>
          </Link>
          <Link href="/admin/products/import">
            <Button variant="outline" size="sm" className="text-xs gap-1.5 text-emerald-800 border-emerald-200 hover:bg-emerald-50">
              <Upload className="h-3.5 w-3.5 text-emerald-600" /> Upload CSV/Excel File
            </Button>
          </Link>
        </div>
      </div>

      {/* Spreadsheet Component */}
      <MultiProductSpreadsheet
        onSuccess={() => {
          router.push("/admin/products");
        }}
        onCancel={() => {
          router.push("/admin/products");
        }}
      />
    </div>
  );
}

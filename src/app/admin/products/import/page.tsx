"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, Package } from "lucide-react";
import { BulkProductImportModal } from "@/components/admin/bulk-product-import-modal";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function BulkImportPage() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(true);

  const handleClose = () => {
    router.push("/admin/products");
  };

  const handleSuccess = () => {
    router.push("/admin/products");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/products"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="admin-page-title">Bulk Import Products</h1>
          <p className="text-xs text-gray-500">
            Import hundreds of products, barcodes, and opening stock counts at once
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center max-w-xl mx-auto shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 mb-3">
          <FileSpreadsheet className="h-7 w-7" />
        </div>
        <h2 className="text-base font-bold text-gray-900">Spreadsheet Catalog Import</h2>
        <p className="text-xs text-gray-600 mt-1 max-w-md mx-auto leading-relaxed">
          Upload an Excel or CSV file containing your products, barcodes, prices, and stock numbers. You can also download our pre-filled Indian Kirana store template.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-5"
          >
            Open Import Wizard
          </Button>
          <Link href="/admin/products">
            <Button variant="outline" className="text-xs">
              Back to Products
            </Button>
          </Link>
        </div>
      </div>

      <BulkProductImportModal
        isOpen={modalOpen}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

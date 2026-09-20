"use client";

import { useRef, useState } from "react";
import { Download, Upload, Database, AlertTriangle, Trash2, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { backupService } from "@/services/erp";
import { Button } from "@/components/ui/button";

const TABLES = ["products", "customers", "suppliers", "orders", "pos_sales", "expenses"];

export default function BackupPage() {
  const [restoring, setRestoring] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const result = await backupService.restoreFromJson(text);
      if (result.errors.length) {
        toast.warning(`Imported ${result.imported} rows with ${result.errors.length} warnings`);
      } else {
        toast.success(`Restored ${result.imported} records`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoring(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleClearData = async () => {
    setClearing(true);
    try {
      const res = await backupService.clearStoreDataExceptUsers();
      toast.success(res.message || "Store data cleared! Users and login accounts preserved.");
      setShowClearModal(false);
      setConfirmText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear store data");
    } finally {
      setClearing(false);
    }
  };

  const handleCopySql = () => {
    const sql = `-- Migration 024: Remove SKU & Clear Store Data Except Users
DROP INDEX IF EXISTS public.idx_products_sku;
DO $$ BEGIN
  ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_key;
  ALTER TABLE public.products ALTER COLUMN sku DROP NOT NULL;
  UPDATE public.products SET sku = NULL WHERE sku = '' OR sku IS NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT public.clear_store_data_except_users();`;
    navigator.clipboard.writeText(sql);
    toast.success("SQL command copied to clipboard!");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="admin-page-title mb-1 flex items-center gap-2">
        <Database className="h-6 w-6 text-green-600" />
        Database Backup & Maintenance
      </h1>
      <p className="mb-6 text-sm text-gray-600">Export, restore, and maintain store data</p>

      <div className="space-y-4">
        <div className="admin-card p-4 sm:p-6">
          <h2 className="font-semibold">Full Backup (JSON)</h2>
          <p className="mt-1 text-sm text-gray-600">Export all key tables as a single JSON file</p>
          <Button className="mt-4" onClick={() => backupService.exportJson()}>
            <Download className="mr-1 h-4 w-4" />
            Download JSON Backup
          </Button>
        </div>

        <div className="admin-card p-4 sm:p-6">
          <h2 className="font-semibold">Table Export (CSV)</h2>
          <p className="mt-1 text-sm text-gray-600">Export individual tables</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {TABLES.map((t) => (
              <Button
                key={t}
                variant="outline"
                size="sm"
                onClick={() =>
                  backupService.exportTableCsv(t).catch((e) =>
                    toast.error(e instanceof Error ? e.message : "Export failed")
                  )
                }
              >
                {t}
              </Button>
            ))}
          </div>
        </div>

        <div className="admin-card p-4 sm:p-6">
          <h2 className="font-semibold">Restore from JSON</h2>
          <p className="mt-1 text-sm text-gray-600">Upload a previously exported JSON backup</p>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleRestore} />
          <Button
            variant="outline"
            className="mt-4"
            disabled={restoring}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-1 h-4 w-4" />
            {restoring ? "Restoring…" : "Upload & Restore"}
          </Button>
        </div>

        {/* Danger Zone: Clear Store Data */}
        <div className="admin-card border-2 border-red-200 bg-red-50/40 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-red-950">Clear All Store Data (Keep Users)</h2>
              <p className="mt-1 text-sm text-red-800">
                Wipes all test products, orders, POS sales, inventory movements, purchases, and customers.
                <strong> Your admin and cashier login accounts will NOT be deleted.</strong>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  onClick={() => setShowClearModal(true)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Clear Full Store Data
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCopySql}
                  className="border-red-300 bg-white text-red-700 hover:bg-red-50 text-xs"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy Supabase SQL
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Are you absolutely sure?</h3>
            </div>

            <p className="mt-3 text-sm text-gray-600">
              This action will delete all products, orders, sales bills, and stock history.
            </p>

            <div className="mt-3 rounded-lg bg-green-50 border border-green-200 p-2.5 text-xs text-green-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <span><strong>User accounts preserved:</strong> You and your cashiers will stay logged in.</span>
            </div>

            <p className="mt-4 text-xs font-semibold text-gray-700">
              Type <span className="font-mono text-red-600 uppercase">CLEAR</span> below to confirm:
            </p>
            <input
              type="text"
              placeholder="Type CLEAR"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
            />

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowClearModal(false);
                  setConfirmText("");
                }}
                disabled={clearing}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleClearData}
                disabled={confirmText.trim().toUpperCase() !== "CLEAR" || clearing}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {clearing ? "Clearing Database…" : "Yes, Delete Store Data"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

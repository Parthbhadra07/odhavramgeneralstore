"use client";

import { useRef, useState } from "react";
import { Download, Upload, Database } from "lucide-react";
import { toast } from "sonner";
import { backupService } from "@/services/erp";
import { Button } from "@/components/ui/button";

const TABLES = ["products", "customers", "suppliers", "orders", "pos_sales", "expenses"];

export default function BackupPage() {
  const [restoring, setRestoring] = useState(false);
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

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="admin-page-title mb-1 flex items-center gap-2">
        <Database className="h-6 w-6 text-green-600" />
        Database Backup
      </h1>
      <p className="mb-6 text-sm text-gray-600">Export and restore store data</p>

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
      </div>
    </div>
  );
}

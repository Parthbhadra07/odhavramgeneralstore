import { createClient } from "@/lib/supabase/client";
import { erpReportsService } from "./reports.service";

const EXPORT_TABLES = [
  "products",
  "categories",
  "customers",
  "suppliers",
  "orders",
  "pos_sales",
  "purchase_bills",
  "expenses",
  "settings",
] as const;

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const backupService = {
  async exportJson(): Promise<void> {
    const supabase = createClient();
    const backup: Record<string, unknown[]> = {};
    const ts = new Date().toISOString().slice(0, 10);

    for (const table of EXPORT_TABLES) {
      const { data, error } = await supabase.from(table).select("*").limit(5000);
      if (error) {
        backup[table] = [{ error: error.message }];
      } else {
        backup[table] = data ?? [];
      }
    }

    downloadBlob(JSON.stringify(backup, null, 2), `ogs-backup-${ts}.json`, "application/json");
  },

  async exportTableCsv(table: string): Promise<void> {
    const supabase = createClient();
    const { data, error } = await supabase.from(table).select("*").limit(5000);
    if (error) throw error;
    if (!data?.length) throw new Error("No data to export");
    erpReportsService.exportCsv(data as Record<string, unknown>[], `${table}-backup.csv`);
  },

  async restoreFromJson(json: string): Promise<{ imported: number; errors: string[] }> {
    const supabase = createClient();
    const parsed = JSON.parse(json) as Record<string, unknown[]>;
    let imported = 0;
    const errors: string[] = [];

    for (const [table, rows] of Object.entries(parsed)) {
      if (!Array.isArray(rows) || !rows.length) continue;
      if ((rows[0] as { error?: string }).error) {
        errors.push(`${table}: skipped`);
        continue;
      }
      const { error } = await supabase.from(table).upsert(rows);
      if (error) errors.push(`${table}: ${error.message}`);
      else imported += rows.length;
    }

    return { imported, errors };
  },
};

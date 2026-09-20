import { requireClient } from "@/lib/supabase/client";
import { erpReportsService } from "./reports.service";
import { clearProductCatalog } from "@/lib/offline/product-cache";

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
    const supabase = requireClient();
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
    const supabase = requireClient();
    const { data, error } = await supabase.from(table).select("*").limit(5000);
    if (error) throw error;
    if (!data?.length) throw new Error("No data to export");
    erpReportsService.exportCsv(data as Record<string, unknown>[], `${table}-backup.csv`);
  },

  async restoreFromJson(json: string): Promise<{ imported: number; errors: string[] }> {
    const supabase = requireClient();
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

  async clearStoreDataExceptUsers(): Promise<{ success: boolean; message: string }> {
    const supabase = requireClient();

    // 1. Try invoking the database RPC function (Migration 024)
    try {
      const { data, error } = await supabase.rpc("clear_store_data_except_users");
      if (!error && data) {
        await clearProductCatalog();
        return {
          success: true,
          message: (data as { message?: string }).message || "Store data cleared successfully. User accounts preserved.",
        };
      }
    } catch {
      // Fall through to client-side cascade
    }

    // 2. Client-side cascade fallback in reverse foreign key order
    const tablesToDelete = [
      "tracking_history",
      "order_items",
      "orders",
      "refunds",
      "sales_return_items",
      "sales_returns",
      "purchase_return_items",
      "purchase_returns",
      "pos_payment_splits",
      "pos_sale_items",
      "pos_sales",
      "supplier_payments",
      "purchase_items",
      "purchase_bills",
      "lot_stock_movements",
      "stock_movements",
      "barcode_labels",
      "product_variants",
      "product_images",
      "product_lots",
      "cart_items",
      "wishlist",
      "products",
      "categories",
      "brands",
      "suppliers",
      "customer_loyalty",
      "customer_credit",
      "customers",
      "addresses",
      "cash_closing",
      "expenses",
      "notifications",
    ];

    for (const t of tablesToDelete) {
      try {
        await supabase.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      } catch {
        // Continue through all tables
      }
    }

    // Clear local offline product cache
    await clearProductCatalog();

    return {
      success: true,
      message: "Store data cleared successfully. User accounts and login preserved.",
    };
  },
};

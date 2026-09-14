import { requireClient } from "@/lib/supabase/client";
import {
  APP_NAME,
  STORE_ADDRESS,
  STORE_PHONE,
  STORE_UPI_ID,
} from "@/lib/constants";
import type { StoreSettings } from "@/types/erp";

const DEFAULT_SETTINGS: Omit<StoreSettings, "id" | "created_at" | "updated_at"> = {
  store_name: APP_NAME,
  store_mobile: STORE_PHONE,
  store_address: STORE_ADDRESS,
  store_logo_url: null,
  gst_number: null,
  currency: "INR",
  default_gst_percentage: 5,
  upi_id: STORE_UPI_ID,
  upi_merchant_name: APP_NAME,
  enable_upi_qr: true,
  receipt_header_text: "Thank You! Visit Again",
  receipt_footer_text: `${APP_NAME} — ${STORE_PHONE}`,
  receipt_width: "80mm",
  enable_loyalty_points: true,
  loyalty_point_value: 1,
  loyalty_points_per_100: 1,
  loyalty_min_points_redeem: 0,
  gemini_api_key: null,
};

let cachedSettings: StoreSettings | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000;

export const settingsService = {
  getDefaults(): Omit<StoreSettings, "id" | "created_at" | "updated_at"> {
    return { ...DEFAULT_SETTINGS };
  },

  async get(): Promise<StoreSettings> {
    const now = Date.now();
    if (cachedSettings && now - cacheTime < CACHE_TTL) {
      return cachedSettings;
    }

    const supabase = requireClient();
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    let merged: StoreSettings;
    if (error || !data) {
      merged = {
        id: "default",
        ...DEFAULT_SETTINGS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } else {
      merged = {
        ...DEFAULT_SETTINGS,
        ...(data as StoreSettings),
      };
    }

    // Merge any client-side overrides (e.g. if database schema migration is pending)
    if (typeof window !== "undefined") {
      try {
        const storedKey = localStorage.getItem("gemini_api_key");
        if (storedKey && !merged.gemini_api_key) {
          merged.gemini_api_key = storedKey;
        }
        const overridesRaw = localStorage.getItem("erp_store_settings_overrides");
        if (overridesRaw) {
          const overrides = JSON.parse(overridesRaw);
          merged = { ...merged, ...overrides };
        }
      } catch {
        // ignore localStorage read issues
      }
    }

    cachedSettings = merged;
    cacheTime = now;
    return cachedSettings;
  },

  async update(
    updates: Partial<
      Omit<StoreSettings, "id" | "created_at" | "updated_at">
    >
  ): Promise<StoreSettings> {
    const supabase = requireClient();
    const current = await this.get();

    // Persist API key and loyalty settings in localStorage as fallback
    if (typeof window !== "undefined") {
      try {
        if (updates.gemini_api_key !== undefined) {
          if (updates.gemini_api_key) {
            localStorage.setItem("gemini_api_key", updates.gemini_api_key);
          } else {
            localStorage.removeItem("gemini_api_key");
          }
        }
        const overridesRaw = localStorage.getItem("erp_store_settings_overrides");
        const existingOverrides = overridesRaw ? JSON.parse(overridesRaw) : {};
        localStorage.setItem(
          "erp_store_settings_overrides",
          JSON.stringify({ ...existingOverrides, ...updates })
        );
      } catch {
        // ignore storage errors
      }
    }

    const baseColumns = new Set([
      "store_name",
      "store_mobile",
      "store_address",
      "store_logo_url",
      "gst_number",
      "currency",
      "default_gst_percentage",
      "upi_id",
      "upi_merchant_name",
      "enable_upi_qr",
      "receipt_header_text",
      "receipt_footer_text",
      "receipt_width",
    ]);

    if (current.id === "default") {
      try {
        const { data, error } = await supabase
          .from("settings")
          .insert({ ...DEFAULT_SETTINGS, ...updates })
          .select("*")
          .single();
        if (error) throw error;
        cachedSettings = { ...DEFAULT_SETTINGS, ...(data as StoreSettings), ...updates };
      } catch (err: unknown) {
        const msg = String((err as { message?: string })?.message || "");
        if (msg.includes("column") || msg.includes("schema cache")) {
          // Retry inserting with base columns only
          const filtered: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(updates)) {
            if (baseColumns.has(k)) filtered[k] = v;
          }
          await supabase.from("settings").insert({ ...DEFAULT_SETTINGS, ...filtered });
        } else {
          throw err;
        }
        cachedSettings = { ...current, ...updates };
      }
      cacheTime = Date.now();
      return cachedSettings;
    }

    try {
      const { data, error } = await supabase
        .from("settings")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", current.id)
        .select("*")
        .single();
      if (error) throw error;
      cachedSettings = { ...current, ...(data as StoreSettings), ...updates };
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message || "");
      if (msg.includes("column") || msg.includes("schema cache")) {
        // Retry updating with only standard base columns
        const filtered: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(updates)) {
          if (baseColumns.has(k)) filtered[k] = v;
        }
        if (Object.keys(filtered).length > 0) {
          await supabase
            .from("settings")
            .update({ ...filtered, updated_at: new Date().toISOString() })
            .eq("id", current.id);
        }
      } else {
        throw err;
      }
      cachedSettings = { ...current, ...updates };
    }

    cacheTime = Date.now();
    return cachedSettings;
  },

  clearCache() {
    cachedSettings = null;
    cacheTime = 0;
  },

  buildUpiUrl(settings: StoreSettings, amount: number, note?: string): string | null {
    const upiId = settings.upi_id?.trim() || STORE_UPI_ID;
    if (!upiId) return null;
    const params = new URLSearchParams({
      pa: upiId,
      pn: (settings.upi_merchant_name ?? settings.store_name ?? APP_NAME).trim(),
      am: amount.toFixed(2),
      cu: "INR",
    });
    if (note?.trim()) {
      params.set("tn", note.trim());
    }
    return `upi://pay?${params.toString()}`;
  },
};

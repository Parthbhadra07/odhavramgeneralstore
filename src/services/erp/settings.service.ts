import { requireClient } from "@/lib/supabase/client";
import {
  APP_NAME,
  STORE_ADDRESS,
  STORE_PHONE,
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
  upi_id: null,
  upi_merchant_name: null,
  enable_upi_qr: false,
  receipt_header_text: "Thank You! Visit Again",
  receipt_footer_text: `${APP_NAME} — ${STORE_PHONE}`,
  receipt_width: "80mm",
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

    if (error || !data) {
      const fallback: StoreSettings = {
        id: "default",
        ...DEFAULT_SETTINGS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return fallback;
    }

    cachedSettings = data as StoreSettings;
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

    if (current.id === "default") {
      const { data, error } = await supabase
        .from("settings")
        .insert({ ...DEFAULT_SETTINGS, ...updates })
        .select("*")
        .single();
      if (error) throw error;
      cachedSettings = data as StoreSettings;
      cacheTime = Date.now();
      return cachedSettings;
    }

    const { data, error } = await supabase
      .from("settings")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", current.id)
      .select("*")
      .single();
    if (error) throw error;
    cachedSettings = data as StoreSettings;
    cacheTime = Date.now();
    return cachedSettings;
  },

  clearCache() {
    cachedSettings = null;
    cacheTime = 0;
  },

  buildUpiUrl(settings: StoreSettings, amount: number): string | null {
    if (!settings.upi_id?.trim()) return null;
    const params = new URLSearchParams({
      pa: settings.upi_id.trim(),
      pn: (settings.upi_merchant_name ?? settings.store_name).trim(),
      am: amount.toFixed(2),
      cu: "INR",
    });
    return `upi://pay?${params.toString()}`;
  },
};

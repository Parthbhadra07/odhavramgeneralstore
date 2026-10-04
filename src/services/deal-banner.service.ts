import { createClient } from "@/lib/supabase/client";
import { getOfferTimeRemaining } from "@/utils/offer-helper";

export interface DealBannerItem {
  id: string;
  type: "deal" | "photo";
  enabled: boolean;
  title: string;
  subtitle?: string;
  badgeText?: string;
  discountHighlight?: string;
  endDate?: string;
  timerMode?: "realtime_daily" | "weekend" | "custom";
  buttonText?: string;
  buttonLink?: string;
  theme?: "flame" | "royal" | "emerald" | "amber" | "dark";
  imageUrl?: string | null;
  imageAlt?: string;
  targetUrl?: string; // Click destination for photo banner
  displayOrder?: number;
}

export interface DealBannerConfig {
  enabled: boolean;
  banners: DealBannerItem[];
  // Backwards compatibility fields
  title?: string;
  subtitle?: string;
  badgeText?: string;
  discountHighlight?: string;
  endDate?: string;
  buttonText?: string;
  buttonLink?: string;
  theme?: "flame" | "royal" | "emerald" | "amber";
  bannerImageUrl?: string | null;
}

const STORAGE_KEY = "ogs_home_deal_banner_config_v2";
const LEGACY_STORAGE_KEY = "ogs_home_deal_banner_config_v1";

const DEFAULT_DEAL_BANNER: DealBannerItem = {
  id: "deal-banner-primary",
  type: "deal",
  enabled: true,
  title: "⚡ Mega Savings & Flash Deals!",
  subtitle: "Save big on your daily groceries, snacks & household essentials. Real-time daily flash prices!",
  badgeText: "LIMITED TIME DEALS",
  discountHighlight: "UP TO 50% OFF",
  endDate: "realtime_daily",
  timerMode: "realtime_daily",
  buttonText: "Shop Deals Now",
  buttonLink: "/products?deals=true",
  theme: "flame",
  displayOrder: 1,
};

const DEFAULT_PHOTO_BANNER: DealBannerItem = {
  id: "photo-banner-promo",
  type: "photo",
  enabled: true,
  title: "🛒 Fresh Produce & Daily Grocery Fest",
  subtitle: "Farm fresh fruits, vegetables, pulses & premium staples delivered to your doorstep.",
  badgeText: "EXCLUSIVE ADVERTISEMENT",
  discountHighlight: "SPECIAL SAVINGS",
  imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
  imageAlt: "Odhavram Supermarket Photo Advertisement Banner",
  targetUrl: "/products",
  buttonText: "Explore Collection",
  buttonLink: "/products",
  endDate: "realtime_daily",
  timerMode: "realtime_daily",
  theme: "emerald",
  displayOrder: 2,
};

function serializeBannerToRow(item: DealBannerItem) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);

  const meta = {
    type: item.type || "deal",
    timerMode: item.timerMode || (item.endDate === "realtime_daily" ? "realtime_daily" : "custom"),
    imageUrl: item.imageUrl || null,
    imageAlt: item.imageAlt || null,
    targetUrl: item.targetUrl || null,
    displayOrder: item.displayOrder ?? 1,
    originalId: item.id,
  };

  const cleanSubtitle = (item.subtitle || "").replace(/<!--BANNER_META:\{.*?\}-->/g, "").trim();
  const serializedSubtitle = `${cleanSubtitle}\n<!--BANNER_META:${JSON.stringify(meta)}-->`.trim();

  let dbEndDate: string | null = null;
  if (item.endDate && item.endDate !== "realtime_daily" && item.endDate !== "weekend") {
    const parsed = new Date(item.endDate);
    if (!isNaN(parsed.getTime())) {
      dbEndDate = parsed.toISOString();
    }
  }

  const row: Record<string, any> = {
    title: item.title || "Special Offer",
    subtitle: serializedSubtitle,
    badge_text: item.badgeText || "SPECIAL OFFER",
    discount_highlight: item.discountHighlight || "LIMITED DEAL",
    end_date: dbEndDate,
    button_text: item.buttonText || "Shop Deals Now",
    button_link: item.buttonLink || "/products?deals=true",
    theme: item.theme || "flame",
    enabled: item.enabled ?? true,
    updated_at: new Date().toISOString(),
  };

  if (isUUID) {
    row.id = item.id;
  }

  return row;
}

function deserializeRowToBanner(row: any): DealBannerItem {
  let subtitle = row.subtitle || "";
  let meta: any = {};

  if (subtitle) {
    const match = subtitle.match(/<!--BANNER_META:(\{.*?\})-->/);
    if (match && match[1]) {
      try {
        meta = JSON.parse(match[1]);
        subtitle = subtitle.replace(/<!--BANNER_META:\{.*?\}-->/g, "").trim();
      } catch {}
    }
  }

  const timerMode: "realtime_daily" | "weekend" | "custom" =
    meta.timerMode || (!row.end_date ? "realtime_daily" : "custom");

  const endDate =
    timerMode === "realtime_daily"
      ? "realtime_daily"
      : timerMode === "weekend"
      ? "weekend"
      : row.end_date
      ? new Date(row.end_date).toISOString()
      : "realtime_daily";

  return {
    id: meta.originalId || row.id,
    type: meta.type || "deal",
    enabled: row.enabled ?? true,
    title: row.title || "Special Deals",
    subtitle: subtitle || undefined,
    badgeText: row.badge_text || undefined,
    discountHighlight: row.discount_highlight || undefined,
    endDate,
    timerMode,
    buttonText: row.button_text || undefined,
    buttonLink: row.button_link || undefined,
    theme: row.theme || "flame",
    imageUrl: meta.imageUrl || null,
    imageAlt: meta.imageAlt || undefined,
    targetUrl: meta.targetUrl || undefined,
    displayOrder: meta.displayOrder ?? 1,
  };
}

export const dealBannerService = {
  getDefaults(): DealBannerConfig {
    return {
      enabled: true,
      banners: [
        { ...DEFAULT_DEAL_BANNER },
        { ...DEFAULT_PHOTO_BANNER },
      ],
    };
  },

  createBanner(type: "deal" | "photo"): DealBannerItem {
    const id = `banner-${type}-${Date.now().toString(36)}`;
    if (type === "photo") {
      return {
        id,
        type: "photo",
        enabled: true,
        title: "📸 Special Promotional Advertisement",
        subtitle: "Exclusive deals on premium branded grocery packs and pantry items.",
        badgeText: "PHOTO ADVERTISEMENT",
        discountHighlight: "HOT OFFER",
        imageUrl: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1200&q=80",
        imageAlt: "Promotional Banner",
        targetUrl: "/products",
        buttonText: "Shop Promotion",
        buttonLink: "/products",
        endDate: "realtime_daily",
        timerMode: "realtime_daily",
        theme: "royal",
        displayOrder: 99,
      };
    }

    return {
      id,
      type: "deal",
      enabled: true,
      title: "🔥 Weekend Super Sale & Offers",
      subtitle: "Unbeatable wholesale discounts on household favorites.",
      badgeText: "FLASH SALE",
      discountHighlight: "SAVE BIG",
      endDate: "realtime_daily",
      timerMode: "realtime_daily",
      buttonText: "View Deals",
      buttonLink: "/products?deals=true",
      theme: "amber",
      displayOrder: 99,
    };
  },

  async get(): Promise<DealBannerConfig> {
    // 1. Try server API route first (handles service-role database sync cleanly)
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/banners", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.banners)) {
            if (json.banners.length === 0) {
              const emptyConfig: DealBannerConfig = { enabled: false, banners: [] };
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyConfig));
              } catch {}
              return emptyConfig;
            }
            const banners: DealBannerItem[] = (json.banners as any[]).map((row: any) => deserializeRowToBanner(row));
            const config: DealBannerConfig = {
              enabled: banners.some((b: DealBannerItem) => b.enabled),
              banners,
            };
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
            } catch {}
            return config;
          }
        }
      } catch {
        // network or server error, try direct Supabase
      }
    }

    // 2. Direct Supabase client query
    try {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from("deal_banners")
          .select("*")
          .order("created_at", { ascending: true });

        if (!error && Array.isArray(data)) {
          if (data.length === 0) {
            const emptyConfig: DealBannerConfig = { enabled: false, banners: [] };
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyConfig));
              } catch {}
            }
            return emptyConfig;
          }
          const banners: DealBannerItem[] = (data || []).map((row: any) => deserializeRowToBanner(row));
          const config: DealBannerConfig = {
            enabled: banners.some((b: DealBannerItem) => b.enabled),
            banners,
          };
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
            } catch {}
          }
          return config;
        }
      }
    } catch {
      // offline fallback
    }

    // 3. Offline localStorage cache fallback
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<DealBannerConfig>;
          if (Array.isArray(parsed.banners)) {
            return {
              enabled: parsed.enabled ?? (parsed.banners.length > 0),
              banners: parsed.banners,
            };
          }
        }
      } catch {}
    }

    return dealBannerService.getDefaults();
  },

  async renewBanner(id: string, duration: "today" | "24h" | "3d" | "7d" = "today"): Promise<DealBannerConfig> {
    const config = await dealBannerService.get();
    let newEndDate = "realtime_daily";
    let timerMode: "realtime_daily" | "custom" = "realtime_daily";

    if (duration === "24h") {
      newEndDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      timerMode = "custom";
    } else if (duration === "3d") {
      newEndDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      timerMode = "custom";
    } else if (duration === "7d") {
      newEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      timerMode = "custom";
    }

    const updatedBanners = (config.banners || []).map((b: DealBannerItem) => {
      if (b.id === id) {
        return {
          ...b,
          enabled: true,
          endDate: newEndDate,
          timerMode,
        };
      }
      return b;
    });

    const updatedConfig: DealBannerConfig = {
      ...config,
      enabled: true,
      banners: updatedBanners,
    };

    return await dealBannerService.save(updatedConfig);
  },

  async deleteBanner(id: string): Promise<DealBannerConfig> {
    // 1. Try server API delete
    try {
      const res = await fetch("/api/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const remaining: DealBannerItem[] = Array.isArray(json.banners)
            ? (json.banners as any[]).map((row: any) => deserializeRowToBanner(row))
            : [];
          const updatedConfig: DealBannerConfig = {
            enabled: remaining.some((b: DealBannerItem) => b.enabled),
            banners: remaining,
          };
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedConfig));
              window.dispatchEvent(new Event("deal-banner-updated"));
            } catch {}
          }
          return updatedConfig;
        }
      }
    } catch (err) {
      console.warn("[dealBannerService] API delete notice:", err);
    }

    // 2. Direct Supabase delete fallback
    try {
      const supabase = createClient();
      if (supabase) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        if (isUUID) {
          await supabase.from("deal_banners").delete().eq("id", id);
        } else {
          await supabase
            .from("deal_banners")
            .delete()
            .ilike("subtitle", `%"originalId":"${id}"%`);
        }
      }
    } catch {}

    const current = await dealBannerService.get();
    const updated: DealBannerConfig = {
      ...current,
      banners: (current.banners || []).filter((b: DealBannerItem) => b.id !== id),
    };
    if (updated.banners.length === 0) {
      updated.enabled = false;
    }
    return await dealBannerService.save(updated);
  },

  async save(config: DealBannerConfig): Promise<DealBannerConfig> {
    // 1. Save to database via /api/banners (bypasses RLS issues with service role)
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/banners", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save", banners: config.banners || [] }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.banners)) {
            const savedBanners: DealBannerItem[] = (json.banners as any[]).map((row: any) => deserializeRowToBanner(row));
            const savedConfig: DealBannerConfig = {
              enabled: savedBanners.some((b: DealBannerItem) => b.enabled),
              banners: savedBanners,
            };
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConfig));
              window.dispatchEvent(new Event("deal-banner-updated"));
            } catch {}
            return savedConfig;
          }
        }
      } catch (err) {
        console.warn("[dealBannerService] API save error:", err);
      }
    }

    // 2. Save to localStorage immediately and notify listeners
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        window.dispatchEvent(new Event("deal-banner-updated"));
      } catch {}
    }

    // 3. Direct Supabase sync fallback
    try {
      const supabase = createClient();
      if (supabase) {
        await supabase
          .from("deal_banners")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");

        const rows = (config.banners || []).map(serializeBannerToRow);
        if (rows.length > 0) {
          await supabase.from("deal_banners").insert(rows);
        }
      }
    } catch (err) {
      console.warn("[dealBannerService] Supabase sync notice:", err);
    }

    return config;
  },
};

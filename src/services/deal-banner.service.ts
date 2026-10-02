export interface DealBannerItem {
  id: string;
  type: "deal" | "photo";
  enabled: boolean;
  title: string;
  subtitle?: string;
  badgeText?: string;
  discountHighlight?: string;
  endDate?: string;
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
  subtitle: "Save big on your daily groceries, snacks & household essentials. Limited time prices!",
  badgeText: "LIMITED TIME DEALS",
  discountHighlight: "UP TO 50% OFF",
  endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
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
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  theme: "emerald",
  displayOrder: 2,
};

const DEFAULT_BANNER_CONFIG: DealBannerConfig = {
  enabled: true,
  banners: [DEFAULT_DEAL_BANNER, DEFAULT_PHOTO_BANNER],
};

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
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
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
      endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      buttonText: "View Deals",
      buttonLink: "/products?deals=true",
      theme: "amber",
      displayOrder: 99,
    };
  },

  async get(): Promise<DealBannerConfig> {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<DealBannerConfig>;
          if (Array.isArray(parsed.banners) && parsed.banners.length > 0) {
            return {
              enabled: parsed.enabled ?? true,
              banners: parsed.banners,
            };
          }
        }

        // Migrate from legacy single banner key if available
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          const parsedLegacy = JSON.parse(legacy);
          const migratedBanner: DealBannerItem = {
            id: "legacy-deal-banner",
            type: "deal",
            enabled: parsedLegacy.enabled ?? true,
            title: parsedLegacy.title || DEFAULT_DEAL_BANNER.title,
            subtitle: parsedLegacy.subtitle || DEFAULT_DEAL_BANNER.subtitle,
            badgeText: parsedLegacy.badgeText || DEFAULT_DEAL_BANNER.badgeText,
            discountHighlight: parsedLegacy.discountHighlight || DEFAULT_DEAL_BANNER.discountHighlight,
            endDate: parsedLegacy.endDate || DEFAULT_DEAL_BANNER.endDate,
            buttonText: parsedLegacy.buttonText || DEFAULT_DEAL_BANNER.buttonText,
            buttonLink: parsedLegacy.buttonLink || DEFAULT_DEAL_BANNER.buttonLink,
            theme: parsedLegacy.theme || "flame",
            imageUrl: parsedLegacy.bannerImageUrl || null,
            displayOrder: 1,
          };
          const migratedConfig: DealBannerConfig = {
            enabled: parsedLegacy.enabled ?? true,
            banners: [migratedBanner, DEFAULT_PHOTO_BANNER],
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedConfig));
          return migratedConfig;
        }
      } catch {
        // fallback to defaults on error
      }
    }
    return dealBannerService.getDefaults();
  },

  async save(config: DealBannerConfig): Promise<DealBannerConfig> {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        window.dispatchEvent(new Event("deal-banner-updated"));
      } catch {
        // ignore storage error
      }
    }
    return config;
  },
};

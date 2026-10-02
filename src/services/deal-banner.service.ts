export interface DealBannerConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  badgeText: string;
  discountHighlight: string;
  endDate: string;
  buttonText: string;
  buttonLink: string;
  theme: "flame" | "royal" | "emerald" | "amber";
  bannerImageUrl?: string | null;
}

const STORAGE_KEY = "ogs_home_deal_banner_config_v1";

const DEFAULT_BANNER_CONFIG: DealBannerConfig = {
  enabled: true,
  title: "⚡ Mega Savings & Flash Deals!",
  subtitle: "Save big on your daily groceries, snacks & household essentials. Limited time prices!",
  badgeText: "LIMITED TIME DEALS",
  discountHighlight: "UP TO 50% OFF",
  // Default end date is 3 days from now
  endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  buttonText: "Shop Deals Now",
  buttonLink: "/products?deals=true",
  theme: "flame",
  bannerImageUrl: null,
};

export const dealBannerService = {
  getDefaults(): DealBannerConfig {
    return { ...DEFAULT_BANNER_CONFIG };
  },

  async get(): Promise<DealBannerConfig> {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return { ...DEFAULT_BANNER_CONFIG, ...parsed };
        }
      } catch {
        // ignore parse error
      }
    }
    return { ...DEFAULT_BANNER_CONFIG };
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

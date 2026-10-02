"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Tag,
  Sparkles,
  ArrowRight,
  Clock,
  ShoppingCart,
  Percent,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
} from "lucide-react";
import {
  dealBannerService,
  type DealBannerConfig,
  type DealBannerItem,
} from "@/services/deal-banner.service";
import { productService } from "@/services/product.service";
import { formatPrice } from "@/utils/format";
import { getOfferTimeRemaining, isOfferActive } from "@/utils/offer-helper";
import { useCartStore } from "@/store/cart-store";
import { toast } from "sonner";
import { cn } from "@/utils/cn";
import type { Product } from "@/types/database";

export function DealsAdvertisementBanner() {
  const [config, setConfig] = useState<DealBannerConfig>(dealBannerService.getDefaults());
  const [dealProducts, setDealProducts] = useState<Product[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());

  const { addItem } = useCartStore();

  useEffect(() => {
    // 1-second ticker for all live timers
    const interval = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadConfig = () => {
      dealBannerService.get().then(setConfig);
    };

    loadConfig();
    window.addEventListener("deal-banner-updated", loadConfig);

    // Load active deal products for deal banners
    productService
      .getAll({ includeInactive: false })
      .then((all) => {
        const onOffer = all.filter((p) => isOfferActive(p));
        setDealProducts(onOffer.slice(0, 4));
      })
      .catch(() => {});

    return () => {
      window.removeEventListener("deal-banner-updated", loadConfig);
    };
  }, []);

  // Filter banners that are enabled and not expired
  const activeBanners = (config.banners || []).filter((banner) => {
    if (!banner.enabled) return false;
    if (banner.endDate) {
      const remaining = getOfferTimeRemaining(banner.endDate);
      if (remaining.isExpired) return false;
    }
    return true;
  });

  // Autoplay rotation every 6 seconds if multiple banners exist
  useEffect(() => {
    if (activeBanners.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [activeBanners.length, isPaused]);

  // Keep index within bounds if active banners count changes
  useEffect(() => {
    if (currentIndex >= activeBanners.length && activeBanners.length > 0) {
      setCurrentIndex(0);
    }
  }, [activeBanners.length, currentIndex]);

  if (!config.enabled || activeBanners.length === 0) {
    return null;
  }

  const currentBanner = activeBanners[currentIndex] || activeBanners[0];
  if (!currentBanner) return null;

  const remaining = currentBanner.endDate
    ? getOfferTimeRemaining(currentBanner.endDate)
    : null;

  const themeClasses: Record<string, string> = {
    flame: "from-rose-700 via-red-600 to-amber-600 border-rose-500/30",
    royal: "from-blue-950 via-indigo-900 to-blue-800 border-blue-500/30",
    emerald: "from-emerald-900 via-green-800 to-teal-700 border-emerald-500/30",
    amber: "from-amber-700 via-orange-600 to-rose-600 border-amber-500/30",
    dark: "from-gray-950 via-slate-900 to-zinc-800 border-gray-700/50",
  };
  const activeThemeClass = themeClasses[currentBanner.theme || "flame"] || themeClasses.flame;

  const handleQuickAdd = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    if (product.stock <= 0) {
      toast.error("Item is out of stock!");
      return;
    }
    const currentItems = useCartStore.getState().items;
    const existing = currentItems.find((i) => i.productId === product.id);
    const inCartQty = existing ? existing.quantity : 0;
    if (inCartQty >= product.stock) {
      toast.error(`Only ${product.stock} items available in stock!`);
      return;
    }
    addItem(product);
    toast.success(`Added ${product.name} to cart!`);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + activeBanners.length) % activeBanners.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
  };

  return (
    <section
      className="relative overflow-hidden py-4 sm:py-6"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="container mx-auto px-4">
        {/* Banner Card Container */}
        <div className="relative group/carousel">
          {/* PHOTO ADVERTISING BANNER */}
          {currentBanner.type === "photo" ? (
            <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-gray-950 shadow-2xl transition-all">
              <Link
                href={currentBanner.targetUrl || currentBanner.buttonLink || "/products"}
                className="block relative aspect-[21/9] sm:aspect-[24/9] md:aspect-[3/1] min-h-[220px] sm:min-h-[280px] w-full overflow-hidden group"
              >
                {currentBanner.imageUrl ? (
                  <img
                    src={currentBanner.imageUrl}
                    alt={currentBanner.imageAlt || currentBanner.title || "Advertising Banner"}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gradient-to-r from-blue-900 to-indigo-950 text-white/50">
                    <ImageIcon className="h-16 w-16" />
                  </div>
                )}

                {/* Dark Gradient Overlay for readability */}
                <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-gray-950/90 via-gray-950/60 to-transparent p-6 sm:p-8 md:p-10 flex flex-col justify-end sm:justify-center">
                  <div className="max-w-xl text-white">
                    {/* Badge & Discount Pill */}
                    <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-black tracking-wider uppercase backdrop-blur-md border border-white/25">
                        <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                        {currentBanner.badgeText || "SPECIAL ADVERTISEMENT"}
                      </span>
                      {currentBanner.discountHighlight && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 text-gray-950 px-2.5 py-0.5 text-xs font-black shadow-sm">
                          {currentBanner.discountHighlight}
                        </span>
                      )}
                    </div>

                    {/* Headline */}
                    <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight leading-tight mb-2 drop-shadow-md">
                      {currentBanner.title}
                    </h2>

                    {/* Subtitle */}
                    {currentBanner.subtitle && (
                      <p className="text-xs sm:text-sm md:text-base text-white/90 mb-4 line-clamp-2 leading-relaxed">
                        {currentBanner.subtitle}
                      </p>
                    )}

                    {/* Optional Floating Countdown on Photo Banner */}
                    {remaining && !remaining.isExpired && currentBanner.endDate && (
                      <div className="mb-4 inline-flex items-center gap-2 rounded-xl bg-black/50 border border-white/20 px-3 py-1.5 backdrop-blur-md text-xs font-bold text-white shadow-sm">
                        <Clock className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
                        <span>Offer valid for:</span>
                        <span className="font-mono text-amber-300">
                          {remaining.days > 0 ? `${remaining.days}d ` : ""}
                          {String(remaining.hours).padStart(2, "0")}h :{" "}
                          {String(remaining.minutes).padStart(2, "0")}m :{" "}
                          {String(remaining.seconds).padStart(2, "0")}s
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs sm:text-sm font-bold text-gray-950 shadow-lg transition hover:bg-amber-100 group-hover:scale-105 active:scale-95">
                        <Tag className="h-4 w-4 text-rose-600" />
                        {currentBanner.buttonText || "Shop Offers Now"}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ) : (
            /* INTERACTIVE DEAL BANNER WITH COUNTDOWN & LIVE PRODUCTS */
            <div
              className={cn(
                "relative overflow-hidden rounded-3xl bg-gradient-to-r p-6 sm:p-8 md:p-10 text-white shadow-2xl border transition-all",
                activeThemeClass
              )}
            >
              {/* Subtle background glow circles */}
              <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
              <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                {/* Left Column: Headlines, Badge & Countdown */}
                <div className="max-w-xl">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-black tracking-wider uppercase backdrop-blur-md border border-white/25">
                      <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                      {currentBanner.badgeText || "SPECIAL OFFER ADVERTISEMENT"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 text-gray-950 px-2.5 py-0.5 text-xs font-black shadow-sm">
                      {currentBanner.discountHighlight || "UP TO 50% OFF"}
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight mb-2 drop-shadow-sm">
                    {currentBanner.title || "⚡ Mega Savings & Flash Grocery Deals!"}
                  </h2>

                  <p className="text-sm sm:text-base text-white/90 mb-5 leading-relaxed">
                    {currentBanner.subtitle ||
                      "Stock up on daily groceries, snacks and pantry essentials with special limited-time prices."}
                  </p>

                  {/* Countdown Timer Block */}
                  {remaining && !remaining.isExpired && (
                    <div className="mb-6 flex items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80 mr-1">
                        <Clock className="h-4 w-4 text-amber-300 animate-pulse" />
                        <span>Ends in:</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="flex flex-col items-center justify-center rounded-xl bg-black/30 border border-white/20 px-2.5 py-1.5 min-w-[3rem] backdrop-blur-md">
                          <span className="text-base sm:text-lg font-black leading-none font-mono">
                            {String(remaining.days).padStart(2, "0")}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70 mt-0.5">
                            Days
                          </span>
                        </div>
                        <span className="font-bold text-white/60">:</span>
                        <div className="flex flex-col items-center justify-center rounded-xl bg-black/30 border border-white/20 px-2.5 py-1.5 min-w-[3rem] backdrop-blur-md">
                          <span className="text-base sm:text-lg font-black leading-none font-mono">
                            {String(remaining.hours).padStart(2, "0")}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70 mt-0.5">
                            Hours
                          </span>
                        </div>
                        <span className="font-bold text-white/60">:</span>
                        <div className="flex flex-col items-center justify-center rounded-xl bg-black/30 border border-white/20 px-2.5 py-1.5 min-w-[3rem] backdrop-blur-md">
                          <span className="text-base sm:text-lg font-black leading-none font-mono">
                            {String(remaining.minutes).padStart(2, "0")}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70 mt-0.5">
                            Mins
                          </span>
                        </div>
                        <span className="font-bold text-white/60">:</span>
                        <div className="flex flex-col items-center justify-center rounded-xl bg-black/30 border border-white/20 px-2.5 py-1.5 min-w-[3rem] backdrop-blur-md">
                          <span className="text-base sm:text-lg font-black leading-none font-mono text-amber-300">
                            {String(remaining.seconds).padStart(2, "0")}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70 mt-0.5">
                            Secs
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={currentBanner.buttonLink || "/products?deals=true"}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-950 shadow-lg transition hover:bg-amber-100 hover:scale-[1.02] active:scale-95"
                    >
                      <Tag className="h-4 w-4 text-rose-600" />
                      {currentBanner.buttonText || "Shop Deals Now"}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/contact"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/20 transition"
                    >
                      Call Store Delivery
                    </Link>
                  </div>
                </div>

                {/* Right Column: Live Deals Products Grid Showcase */}
                {dealProducts.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:w-[460px] shrink-0">
                    {dealProducts.map((p) => {
                      const hasDiscount = Boolean(p.mrp && p.mrp > p.price);
                      const discountPct =
                        hasDiscount && p.mrp
                          ? Math.round(((p.mrp - p.price) / p.mrp) * 100)
                          : 0;
                      return (
                        <div
                          key={p.id}
                          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white p-3 text-gray-900 shadow-md transition hover:-translate-y-1 hover:shadow-xl"
                        >
                          {discountPct > 0 && (
                            <div className="absolute left-2 top-2 z-10 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white shadow-xs">
                              {discountPct}% OFF
                            </div>
                          )}

                          <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-xl bg-gray-50 flex items-center justify-center p-2">
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.name}
                                className="h-full w-full object-contain transition-transform group-hover:scale-105"
                              />
                            ) : (
                              <Percent className="h-8 w-8 text-gray-300" />
                            )}
                          </div>

                          <div>
                            <h4 className="font-bold text-xs sm:text-sm text-gray-900 line-clamp-1 mb-1">
                              {p.name}
                            </h4>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-sm sm:text-base font-black text-rose-600">
                                {formatPrice(p.price)}
                              </span>
                              {hasDiscount && (
                                <span className="text-[11px] text-gray-400 line-through">
                                  {formatPrice(p.mrp!)}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleQuickAdd(p, e)}
                            className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg bg-gray-900 py-1.5 text-xs font-bold text-white transition hover:bg-rose-600 active:scale-95"
                          >
                            <ShoppingCart className="h-3 w-3" />
                            Add
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Carousel Left / Right Arrows (Only shown when multiple banners exist) */}
          {activeBanners.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md border border-white/20 shadow-lg transition hover:bg-black/70 hover:scale-110 active:scale-95 opacity-80 sm:opacity-0 group-hover/carousel:opacity-100"
                aria-label="Previous Banner"
              >
                <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md border border-white/20 shadow-lg transition hover:bg-black/70 hover:scale-110 active:scale-95 opacity-80 sm:opacity-0 group-hover/carousel:opacity-100"
                aria-label="Next Banner"
              >
                <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>

              {/* Indicator Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-md border border-white/10">
                {activeBanners.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentIndex(i);
                    }}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      currentIndex === i
                        ? "w-6 bg-amber-400"
                        : "w-2 bg-white/60 hover:bg-white"
                    )}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

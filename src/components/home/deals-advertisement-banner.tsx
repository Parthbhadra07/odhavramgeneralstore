"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tag, Sparkles, ArrowRight, Clock, ShoppingCart, Percent } from "lucide-react";
import { dealBannerService, type DealBannerConfig } from "@/services/deal-banner.service";
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
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false });

  const { addItem, setOpen } = useCartStore();

  useEffect(() => {
    // Load config
    dealBannerService.get().then(setConfig);

    const handleUpdate = () => {
      dealBannerService.get().then(setConfig);
    };
    window.addEventListener("deal-banner-updated", handleUpdate);

    // Load active deal products
    productService
      .getAll({ includeInactive: false })
      .then((all) => {
        const onOffer = all.filter((p) => isOfferActive(p));
        setDealProducts(onOffer.slice(0, 4));
      })
      .catch(() => {});

    return () => {
      window.removeEventListener("deal-banner-updated", handleUpdate);
    };
  }, []);

  // Countdown timer ticker
  useEffect(() => {
    if (!config.endDate) return;

    const updateTimer = () => {
      const remaining = getOfferTimeRemaining(config.endDate);
      setTimeLeft({
        days: remaining.days,
        hours: remaining.hours,
        minutes: remaining.minutes,
        seconds: remaining.seconds,
        isExpired: remaining.isExpired,
      });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [config.endDate]);

  if (!config.enabled || timeLeft.isExpired) {
    return null;
  }

  const themeClasses = {
    flame: "from-rose-700 via-red-600 to-amber-600 border-rose-500/30",
    royal: "from-blue-950 via-indigo-900 to-blue-800 border-blue-500/30",
    emerald: "from-emerald-900 via-green-800 to-teal-700 border-emerald-500/30",
    amber: "from-amber-700 via-orange-600 to-rose-600 border-amber-500/30",
  }[config.theme || "flame"];

  const handleQuickAdd = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    addItem(product);
    toast.success(`Added ${product.name} to cart!`);
    setOpen(true);
  };

  return (
    <section className="relative overflow-hidden py-6 sm:py-8">
      <div className="container mx-auto px-4">
        <div
          className={cn(
            "relative overflow-hidden rounded-3xl bg-gradient-to-r p-6 sm:p-8 md:p-10 text-white shadow-2xl border",
            themeClasses
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
                  {config.badgeText || "SPECIAL OFFER ADVERTISEMENT"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 text-gray-950 px-2.5 py-0.5 text-xs font-black shadow-sm">
                  {config.discountHighlight || "UP TO 50% OFF"}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight mb-2 drop-shadow-sm">
                {config.title || "⚡ Mega Savings & Flash Grocery Deals!"}
              </h2>

              <p className="text-sm sm:text-base text-white/90 mb-5 leading-relaxed">
                {config.subtitle ||
                  "Stock up on daily groceries, snacks and pantry essentials with special limited-time prices."}
              </p>

              {/* Countdown Timer Block */}
              <div className="mb-6 flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80 mr-1">
                  <Clock className="h-4 w-4 text-amber-300 animate-pulse" />
                  <span>Ends in:</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex flex-col items-center justify-center rounded-xl bg-black/30 border border-white/20 px-2.5 py-1.5 min-w-[3rem] backdrop-blur-md">
                    <span className="text-base sm:text-lg font-black leading-none font-mono">
                      {String(timeLeft.days).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70 mt-0.5">
                      Days
                    </span>
                  </div>
                  <span className="font-bold text-white/60">:</span>
                  <div className="flex flex-col items-center justify-center rounded-xl bg-black/30 border border-white/20 px-2.5 py-1.5 min-w-[3rem] backdrop-blur-md">
                    <span className="text-base sm:text-lg font-black leading-none font-mono">
                      {String(timeLeft.hours).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70 mt-0.5">
                      Hours
                    </span>
                  </div>
                  <span className="font-bold text-white/60">:</span>
                  <div className="flex flex-col items-center justify-center rounded-xl bg-black/30 border border-white/20 px-2.5 py-1.5 min-w-[3rem] backdrop-blur-md">
                    <span className="text-base sm:text-lg font-black leading-none font-mono">
                      {String(timeLeft.minutes).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70 mt-0.5">
                      Mins
                    </span>
                  </div>
                  <span className="font-bold text-white/60">:</span>
                  <div className="flex flex-col items-center justify-center rounded-xl bg-black/30 border border-white/20 px-2.5 py-1.5 min-w-[3rem] backdrop-blur-md">
                    <span className="text-base sm:text-lg font-black leading-none font-mono text-amber-300">
                      {String(timeLeft.seconds).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70 mt-0.5">
                      Secs
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={config.buttonLink || "/products?deals=true"}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-950 shadow-lg transition hover:bg-amber-100 hover:scale-[1.02] active:scale-95"
                >
                  <Tag className="h-4 w-4 text-rose-600" />
                  {config.buttonText || "Shop Deals Now"}
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
                  const discountPct = hasDiscount && p.mrp ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
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
                        className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg bg-gray-900 py-1.5 text-xs font-bold text-white transition hover:bg-rose-600"
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
      </div>
    </section>
  );
}

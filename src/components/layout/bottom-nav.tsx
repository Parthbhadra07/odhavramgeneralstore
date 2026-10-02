"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Home, Search, Grid, Tag, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { useMounted } from "@/hooks/use-mounted";
import { productService } from "@/services/product.service";
import { isOfferActive } from "@/utils/offer-helper";
import { formatPrice } from "@/utils/format";
import { cn } from "@/utils/cn";

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useMounted();
  const { getItemCount, getTotal, setOpen } = useCartStore();

  const [activeDealsCount, setActiveDealsCount] = useState<number | null>(null);

  const itemCount = mounted ? getItemCount() : 0;
  const total = mounted ? getTotal() : 0;

  useEffect(() => {
    let isMounted = true;
    const checkDeals = async () => {
      try {
        const prods = await productService.getAll({ includeInactive: false });
        if (!isMounted) return;
        const activeDeals = prods.filter((p) => isOfferActive(p));
        setActiveDealsCount(activeDeals.length);
      } catch {
        if (isMounted) setActiveDealsCount(0);
      }
    };

    checkDeals();
    window.addEventListener("deal-banner-updated", checkDeals);
    return () => {
      isMounted = false;
      window.removeEventListener("deal-banner-updated", checkDeals);
    };
  }, []);

  // Don't show in admin area
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const isHome = pathname === "/";
  const isProducts = pathname === "/products";
  const isCategoriesView = isProducts && searchParams.get("view") === "categories";
  const isDealsView =
    isProducts &&
    (searchParams.get("deals") === "true" || searchParams.get("featured") === "true");
  const isOrders = pathname === "/dashboard/orders" || pathname === "/track-order";
  const isSearchActive = isProducts && !isCategoriesView && !isDealsView;

  const handleSearchClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isProducts && !isCategoriesView) {
      // Already on products, focus search input
      const el = document.querySelector('input[type="text"]') as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      router.push("/products?focusSearch=true");
    }
  };

  const handleCategoriesClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isProducts) {
      const p = new URLSearchParams(searchParams.toString());
      if (p.get("view") === "categories") {
        p.delete("view");
      } else {
        p.set("view", "categories");
      }
      p.delete("deals");
      p.delete("featured");
      router.push(`/products?${p.toString()}`);
    } else {
      router.push("/products?view=categories");
    }
  };

  const handleOffersClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push("/products?deals=true");
  };

  return (
    <div className="fixed bottom-2.5 inset-x-3 z-40 md:hidden pointer-events-none">
      <nav className="pointer-events-auto mx-auto max-w-md rounded-full border border-gray-200/90 bg-white/95 px-3 py-1.5 shadow-2xl backdrop-blur-md flex items-center justify-between gap-1 transition-all">
        {/* Home */}
        <Link
          href="/"
          className={cn(
            "flex flex-1 flex-col items-center justify-center py-1 text-center transition-colors rounded-xl",
            isHome
              ? "text-blue-700 font-bold"
              : "text-gray-500 hover:text-gray-800"
          )}
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-medium leading-none">Home</span>
        </Link>

        {/* Search */}
        <button
          type="button"
          onClick={handleSearchClick}
          className={cn(
            "flex flex-1 flex-col items-center justify-center py-1 text-center transition-colors rounded-xl",
            isSearchActive
              ? "text-blue-700 font-bold"
              : "text-gray-500 hover:text-gray-800"
          )}
        >
          <Search className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-medium leading-none">Search</span>
        </button>

        {/* Categories */}
        <button
          type="button"
          onClick={handleCategoriesClick}
          className={cn(
            "flex flex-1 flex-col items-center justify-center py-1 text-center transition-colors rounded-xl",
            isCategoriesView
              ? "text-blue-700 font-bold"
              : "text-gray-500 hover:text-gray-800"
          )}
        >
          <Grid className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-medium leading-none">Categories</span>
        </button>

        {/* Offers Tab (Shows deals page; if no deals, deals page shows friendly banner + all products) */}
        <button
          type="button"
          onClick={handleOffersClick}
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center py-1 text-center transition-colors rounded-xl",
            isDealsView
              ? "text-blue-700 font-bold"
              : "text-gray-500 hover:text-gray-800"
          )}
          aria-label="Deals & Offers"
        >
          <div className="relative">
            <Tag className="h-5 w-5" />
            {activeDealsCount !== null && activeDealsCount > 0 && (
              <span className="absolute -top-1 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-600 px-1 text-[8px] font-black text-white shadow-xs animate-pulse">
                {activeDealsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 font-medium leading-none">Offers</span>
        </button>

        {/* Floating Cart Button */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative ml-1 flex items-center gap-1.5 rounded-full bg-blue-700 hover:bg-blue-800 px-3.5 py-2 text-white shadow-lg active:scale-95 transition-transform"
          aria-label="View Cart"
        >
          <div className="relative">
            <ShoppingBag className="h-4 w-4" />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-gray-900 border border-white">
                {itemCount}
              </span>
            )}
          </div>
          {itemCount > 0 ? (
            <span className="text-xs font-bold whitespace-nowrap">
              {formatPrice(total)}
            </span>
          ) : (
            <span className="text-xs font-bold whitespace-nowrap">Cart</span>
          )}
        </button>
      </nav>
    </div>
  );
}

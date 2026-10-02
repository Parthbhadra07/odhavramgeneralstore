"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Home, Grid, RotateCcw, Percent, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { useMounted } from "@/hooks/use-mounted";
import { formatPrice } from "@/utils/format";
import { cn } from "@/utils/cn";

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useMounted();
  const { getItemCount, getTotal, setOpen } = useCartStore();

  const itemCount = mounted ? getItemCount() : 0;
  const total = mounted ? getTotal() : 0;

  // Don't show in admin area
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const isHome = pathname === "/";
  const isProducts = pathname === "/products";
  const isOrders = pathname === "/dashboard/orders" || pathname === "/track-order";
  const isCategoriesView = isProducts && searchParams.get("view") === "categories";
  const isOffers = isProducts && searchParams.get("featured") === "true";

  const handleCategoriesClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isProducts) {
      const p = new URLSearchParams(searchParams.toString());
      if (p.get("view") === "categories") {
        p.delete("view");
      } else {
        p.set("view", "categories");
      }
      router.push(`/products?${p.toString()}`);
    } else {
      router.push("/products?view=categories");
    }
  };

  const handleOffersClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push("/products?featured=true");
  };

  return (
    <div className="fixed bottom-2.5 inset-x-3 z-40 md:hidden pointer-events-none">
      <nav className="pointer-events-auto mx-auto max-w-md rounded-full border border-slate-200/90 bg-white/95 px-3 py-1.5 shadow-2xl backdrop-blur-md flex items-center justify-between gap-1 transition-all">
        {/* Home */}
        <Link
          href="/"
          className={cn(
            "flex flex-1 flex-col items-center justify-center py-1 text-center transition-colors rounded-xl",
            isHome && !isOffers
              ? "text-emerald-700 font-bold"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-medium leading-none">Home</span>
        </Link>

        {/* Categories */}
        <button
          type="button"
          onClick={handleCategoriesClick}
          className={cn(
            "flex flex-1 flex-col items-center justify-center py-1 text-center transition-colors rounded-xl",
            (isProducts && !isOffers) || isCategoriesView
              ? "text-emerald-700 font-bold"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Grid className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-medium leading-none">Categories</span>
        </button>

        {/* Buy Again / Orders */}
        <Link
          href="/dashboard/orders"
          className={cn(
            "flex flex-1 flex-col items-center justify-center py-1 text-center transition-colors rounded-xl",
            isOrders
              ? "text-emerald-700 font-bold"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <RotateCcw className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-medium leading-none">Buy Again</span>
        </Link>

        {/* Offers */}
        <button
          type="button"
          onClick={handleOffersClick}
          className={cn(
            "flex flex-1 flex-col items-center justify-center py-1 text-center transition-colors rounded-xl",
            isOffers
              ? "text-amber-600 font-bold"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Percent className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-medium leading-none">Offers</span>
        </button>

        {/* Floating Cart Button */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative ml-1 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 px-3.5 py-2 text-white shadow-lg active:scale-95 transition-transform"
          aria-label="View Cart"
        >
          <div className="relative">
            <ShoppingBag className="h-4 w-4" />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-slate-900 border border-white">
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

"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Mic,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpDown,
  Heart,
  Plus,
  Minus,
  Sparkles,
  Zap,
  ShoppingBag,
  X,
  Check,
  Package,
  Layers,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import { useCartStore } from "@/store/cart-store";
import { useAuth } from "@/hooks/use-auth";
import { wishlistService } from "@/services/wishlist.service";
import { formatPrice } from "@/utils/format";
import { STORE_ADDRESS } from "@/lib/constants";
import type { Product, Category, ProductSort } from "@/types/database";
import { cn } from "@/utils/cn";

// Fallback high-res imagery for Indian grocery categories
const CATEGORY_IMAGES: Record<string, string> = {
  vegetables: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=240",
  fruits: "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=240",
  dairy: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=240",
  bakery: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=240",
  snacks: "https://images.unsplash.com/photo-1566478989037-eec170f9d0ca?w=240",
  biscuits: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=240",
  beverages: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=240",
  tea: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=240",
  atta: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=240",
  pulses: "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=240",
  spices: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=240",
  cleaning: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=240",
  personal: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=240",
};

function getCategoryImage(catName: string, existingImage?: string | null): string {
  if (existingImage && existingImage.startsWith("http")) return existingImage;
  const lower = catName.toLowerCase();
  for (const [k, url] of Object.entries(CATEGORY_IMAGES)) {
    if (lower.includes(k)) return url;
  }
  return "https://images.unsplash.com/photo-1542838132-92c53300491e?w=240";
}

const SEARCH_PLACEHOLDERS = [
  'Search for "milk, bread, butter..."',
  'Search for "rain gear"',
  'Search for "personal care"',
  'Search for "chips & snacks"',
  'Search for "atta, rice & dal"',
  'Search for "biscuits & cookies"',
];

interface MobileCatalogViewProps {
  products: Product[];
  categories: Category[];
  loading: boolean;
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  isFeatured: boolean;
  onToggleFeatured: (featured: boolean) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedSort?: ProductSort;
  onSortChange: (sort?: ProductSort) => void;
}

export function MobileCatalogView({
  products,
  categories,
  loading,
  selectedCategory,
  onSelectCategory,
  isFeatured,
  onToggleFeatured,
  searchQuery,
  onSearchChange,
  selectedSort,
  onSortChange,
}: MobileCatalogViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { items: cartItems, addItem, updateQuantity, removeItem } = useCartStore();

  // Mode: 'catalog' (split screen Screenshot 1) or 'categories' (grid Screenshot 2)
  const isCategoriesTab = searchParams.get("view") === "categories";
  const [activeView, setActiveView] = useState<"catalog" | "categories">(
    isCategoriesTab ? "categories" : "catalog"
  );

  // Sync state with url view param
  useEffect(() => {
    setActiveView(searchParams.get("view") === "categories" ? "categories" : "catalog");
  }, [searchParams]);

  // Animated Search Placeholder
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % SEARCH_PLACEHOLDERS.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  // Filter & Brand Modal State
  const [showBrandFilter, setShowBrandFilter] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyLoose, setOnlyLoose] = useState(false);
  const [priceRange, setPriceRange] = useState<number>(2000);

  // Wishlist state
  const [wishlistSet, setWishlistSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.id) {
      wishlistService
        .getItems(user.id)
        .then((items) => {
          setWishlistSet(new Set(items.map((i) => i.product_id)));
        })
        .catch(() => {});
    }
  }, [user?.id]);

  const toggleWishlist = async (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.info("Please sign in to save items to your wishlist");
      router.push("/auth/login");
      return;
    }

    const next = new Set(wishlistSet);
    if (next.has(productId)) {
      next.delete(productId);
      setWishlistSet(next);
      try {
        await wishlistService.remove(user.id, productId);
        toast.info("Removed from wishlist");
      } catch {
        // rollback
        next.add(productId);
        setWishlistSet(new Set(next));
      }
    } else {
      next.add(productId);
      setWishlistSet(next);
      try {
        await wishlistService.add(user.id, productId);
        toast.success("Saved to wishlist!");
      } catch {
        next.delete(productId);
        setWishlistSet(new Set(next));
      }
    }
  };

  // Distinct Brands
  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand && p.brand.trim()) set.add(p.brand.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtered Products for Mobile
  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Category filter
    if (selectedCategory) {
      list = list.filter((p) => p.category_id === selectedCategory);
    }

    // Featured / Deals filter
    if (isFeatured) {
      list = list.filter((p) => p.featured || (p.mrp && p.mrp > p.price));
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.barcode?.includes(q)
      );
    }

    // Brand filter
    if (selectedBrand) {
      list = list.filter((p) => p.brand?.toLowerCase() === selectedBrand.toLowerCase());
    }

    // In Stock filter
    if (onlyInStock) {
      list = list.filter((p) => p.stock > 0);
    }

    // Loose weight filter
    if (onlyLoose) {
      list = list.filter((p) => p.is_loose);
    }

    // Max price
    if (priceRange < 2000) {
      list = list.filter((p) => p.price <= priceRange);
    }

    // Sort
    if (selectedSort === "price-asc") {
      list.sort((a, b) => a.price - b.price);
    } else if (selectedSort === "price-desc") {
      list.sort((a, b) => b.price - a.price);
    } else if (selectedSort === "name-asc") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [
    products,
    selectedCategory,
    isFeatured,
    searchQuery,
    selectedBrand,
    onlyInStock,
    onlyLoose,
    priceRange,
    selectedSort,
  ]);

  // Voice Search Handler
  const startVoiceSearch = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.info("Voice search is not supported in this browser. Please type to search.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.onstart = () => {
        toast.info("Listening... Speak your search query");
      };
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          onSearchChange(transcript);
          toast.success(`Searching for "${transcript}"`);
        }
      };
      recognition.onerror = () => {
        toast.error("Could not capture speech. Please try again.");
      };
      recognition.start();
    } catch {
      toast.error("Voice search unavailable");
    }
  };

  // Grouped Categories for Categories View (Screenshot 2)
  const groupedCategories = useMemo(() => {
    const fresh = categories.filter((c) =>
      /fruit|veg|fresh|dairy|milk|bread|bakery|egg|batter/i.test(c.name)
    );
    const packaged = categories.filter((c) =>
      /snack|biscuit|cookie|chip|chocolate|sweet|namkeen|drink|juice|beverage/i.test(c.name)
    );
    const staples = categories.filter((c) =>
      /atta|flour|rice|grain|dal|pulse|oil|ghee|spice|masala|sugar|salt/i.test(c.name)
    );
    const household = categories.filter(
      (c) =>
        !fresh.includes(c) &&
        !packaged.includes(c) &&
        !staples.includes(c)
    );

    return [
      {
        id: "fresh",
        title: "Fresh & Daily",
        items: fresh.length > 0 ? fresh : categories.slice(0, 4),
      },
      {
        id: "packaged",
        title: "Biscuits, Drinks & Packaged Foods",
        items: packaged.length > 0 ? packaged : categories.slice(4, 8),
      },
      {
        id: "staples",
        title: "Grains, Atta, Dal & Oils",
        items: staples.length > 0 ? staples : categories.slice(8, 12),
      },
      {
        id: "household",
        title: "Household & Personal Care",
        items: household.length > 0 ? household : categories.slice(12),
      },
    ];
  }, [categories]);

  // Helper to switch directly into catalog with category
  const selectCategoryAndGoCatalog = (categoryId: string | null) => {
    onSelectCategory(categoryId);
    setActiveView("catalog");
    const p = new URLSearchParams(searchParams.toString());
    p.delete("view");
    if (categoryId) {
      p.set("category", categoryId);
    } else {
      p.delete("category");
    }
    router.push(`/products?${p.toString()}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 pb-20 select-none">
      {/* 1. TOP GOLDEN-AMBER DELIVERY HEADER (Matches Screenshots 1 & 2) */}
      <header className="sticky top-0 z-30 bg-gradient-to-b from-amber-400 via-amber-300 to-amber-200/90 px-3.5 pt-2.5 pb-3 shadow-sm">
        {/* Delivery status and address */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="block text-[11px] font-medium tracking-tight text-amber-950/80 leading-none">
              Delivery to
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-base font-black text-amber-950 leading-tight">
                Home
              </span>
              <ChevronDown className="h-4 w-4 text-amber-950 shrink-0" />
            </div>
            <p className="text-[11px] text-amber-900/90 truncate font-medium max-w-[280px]">
              {STORE_ADDRESS}
            </p>
          </div>

          {/* User profile avatar circle */}
          <Link
            href={user ? "/dashboard" : "/auth/login"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100/90 text-amber-900 border border-amber-300/80 shadow-xs hover:bg-amber-100 transition active:scale-95"
            aria-label="Account"
          >
            <span className="text-sm font-bold">
              {user?.email ? user.email.slice(0, 1).toUpperCase() : "👤"}
            </span>
          </Link>
        </div>

        {/* Search Bar Pill with Voice Search */}
        <div className="mt-2.5 relative flex items-center rounded-full bg-white px-3 py-2 shadow-xs border border-amber-200/70 focus-within:ring-2 focus-within:ring-amber-500">
          <Search className="h-4 w-4 text-slate-400 shrink-0 mr-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={SEARCH_PLACEHOLDERS[placeholderIndex]}
            className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startVoiceSearch}
              className="p-1 text-slate-500 hover:text-amber-800 transition active:scale-90"
              title="Voice Search"
            >
              <Mic className="h-4 w-4 text-slate-700" />
            </button>
          )}
        </div>
      </header>

      {/* 2. CATEGORY SWITCHER PILLS (Screenshot 2: Groceries vs Essentials / View Mode) */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveView("catalog")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all",
              activeView === "catalog"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <ShoppingBag className="h-3.5 w-3.5 text-emerald-600" />
            <span>Products</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView("categories")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all",
              activeView === "categories"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Layers className="h-3.5 w-3.5 text-sky-600" />
            <span>Categories</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onToggleFeatured(!isFeatured)}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition border",
            isFeatured
              ? "bg-amber-100 border-amber-300 text-amber-900"
              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
          )}
        >
          <span>🔥 Deals</span>
          {isFeatured && <span className="text-[10px] text-amber-700">✓</span>}
        </button>
      </div>

      {/* 3. SCREENSHOT 1: SPLIT-SCREEN CATALOG VIEW (Left Category Rail + Right Product Grid) */}
      {activeView === "catalog" && (
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: "calc(100vh - 165px)" }}>
          {/* LEFT CATEGORY RAIL (Blinkit style vertical sidebar) */}
          <aside className="w-[76px] shrink-0 border-r border-slate-200 bg-slate-100/90 overflow-y-auto overflow-x-hidden flex flex-col py-1.5 scrollbar-none">
            {/* Deals / Premium Picks Tab */}
            <button
              type="button"
              onClick={() => {
                onToggleFeatured(true);
                onSelectCategory(null);
              }}
              className={cn(
                "group relative flex flex-col items-center justify-center py-2.5 px-1 text-center transition-colors border-r-4",
                isFeatured && !selectedCategory
                  ? "border-sky-600 bg-white font-bold text-sky-950 shadow-2xs"
                  : "border-transparent text-slate-600 hover:bg-slate-200/60"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-900 shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="mt-1 text-[10px] font-bold leading-tight line-clamp-2">
                Deals &amp; Picks
              </span>
            </button>

            {/* All Products Tab */}
            <button
              type="button"
              onClick={() => {
                onToggleFeatured(false);
                onSelectCategory(null);
              }}
              className={cn(
                "group relative flex flex-col items-center justify-center py-2.5 px-1 text-center transition-colors border-r-4",
                !selectedCategory && !isFeatured
                  ? "border-sky-600 bg-white font-bold text-sky-950 shadow-2xs"
                  : "border-transparent text-slate-600 hover:bg-slate-200/60"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-700 shadow-xs">
                <Package className="h-5 w-5" />
              </div>
              <span className="mt-1 text-[10px] font-semibold leading-tight line-clamp-2">
                All Items
              </span>
            </button>

            {/* Each Category in Store */}
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              const imgUrl = getCategoryImage(cat.name, cat.image);

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    onToggleFeatured(false);
                    onSelectCategory(cat.id);
                  }}
                  className={cn(
                    "group relative flex flex-col items-center justify-center py-2.5 px-1 text-center transition-all border-r-4",
                    isActive
                      ? "border-sky-600 bg-white font-bold text-sky-950 shadow-2xs"
                      : "border-transparent text-slate-600 hover:bg-slate-200/60"
                  )}
                >
                  <div className="relative h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-white shadow-2xs">
                    <img
                      src={imgUrl}
                      alt={cat.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <span className="mt-1 text-[10px] leading-tight line-clamp-2 px-0.5">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </aside>

          {/* RIGHT PRODUCT FEED */}
          <main className="flex-1 overflow-y-auto px-2 pt-2 pb-24">
            {/* Top filter strip: [ Filters ] [ Brands ⌄ ] [ Sort ☰ ] */}
            <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs pb-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
              {/* Filters Button */}
              <button
                type="button"
                onClick={() => setShowFilterModal(true)}
                className="flex shrink-0 items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
              >
                <SlidersHorizontal className="h-3 w-3 text-slate-600" />
                <span>Filters</span>
                {(onlyInStock || onlyLoose || priceRange < 2000) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                )}
              </button>

              {/* Brands Chip Dropdown */}
              {availableBrands.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBrandFilter(true)}
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 font-semibold transition shadow-2xs",
                    selectedBrand
                      ? "border-sky-500 bg-sky-50 text-sky-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <span>{selectedBrand ? selectedBrand : "Brands"}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              )}

              {/* Sort Chip */}
              <button
                type="button"
                onClick={() => setShowSortModal(true)}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 font-semibold transition shadow-2xs",
                  selectedSort
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                )}
              >
                <ArrowUpDown className="h-3 w-3 text-slate-600" />
                <span>
                  {selectedSort === "price-asc"
                    ? "Price: Low"
                    : selectedSort === "price-desc"
                    ? "Price: High"
                    : "Sort"}
                </span>
              </button>

              {/* Clear brand chip if active */}
              {selectedBrand && (
                <button
                  type="button"
                  onClick={() => setSelectedBrand(null)}
                  className="shrink-0 text-[11px] font-semibold text-red-600 hover:underline px-1"
                >
                  Clear Brand ✕
                </button>
              )}
            </div>

            {/* Products Count Indicator */}
            <div className="flex items-center justify-between px-1 py-1 text-[11px] text-slate-500">
              <span>
                <b>{filteredProducts.length}</b> products available
              </span>
              {isFeatured && (
                <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                  🔥 Deals Only
                </span>
              )}
            </div>

            {/* Product Cards Grid: 2 Columns */}
            {loading ? (
              <div className="grid grid-cols-2 gap-2 mt-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-56 rounded-2xl bg-white p-3 border border-slate-200 animate-pulse flex flex-col justify-between"
                  >
                    <div className="h-28 rounded-xl bg-slate-200" />
                    <div className="space-y-2">
                      <div className="h-3 w-16 bg-slate-200 rounded" />
                      <div className="h-4 w-full bg-slate-200 rounded" />
                      <div className="h-4 w-12 bg-slate-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="my-8 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
                <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No items found</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Try clearing active filters or searching for another grocery product.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onSelectCategory(null);
                    onToggleFeatured(false);
                    onSearchChange("");
                    setSelectedBrand(null);
                    setOnlyInStock(false);
                    setOnlyLoose(false);
                    setPriceRange(2000);
                  }}
                  className="mt-3 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-1">
                {filteredProducts.map((product) => {
                  const cartItem = cartItems.find((i) => i.productId === product.id);
                  const inCartQty = cartItem ? cartItem.quantity : 0;
                  const isWishlisted = wishlistSet.has(product.id);

                  // Calculate discount %
                  let discountPercent = 0;
                  if (product.mrp && product.mrp > product.price) {
                    discountPercent = Math.round(
                      ((product.mrp - product.price) / product.mrp) * 100
                    );
                  }

                  return (
                    <article
                      key={product.id}
                      className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xs transition-shadow hover:shadow-md"
                    >
                      {/* Top Image & Wishlist Container */}
                      <div className="relative">
                        {/* Wishlist Heart Button */}
                        <button
                          type="button"
                          onClick={(e) => toggleWishlist(product.id, e)}
                          className="absolute -top-1 -right-1 z-10 rounded-full p-1 text-slate-400 hover:text-red-500 transition active:scale-125"
                          aria-label="Wishlist"
                        >
                          <Heart
                            className={cn(
                              "h-4 w-4 transition-colors",
                              isWishlisted ? "fill-red-500 text-red-500" : "text-slate-400"
                            )}
                          />
                        </button>

                        {/* Product Photo */}
                        <Link
                          href={`/products/view?slug=${encodeURIComponent(product.slug)}`}
                          className="block relative h-28 w-full overflow-hidden rounded-xl bg-slate-50 flex items-center justify-center p-1"
                        >
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-full w-full object-contain transition-transform group-hover:scale-105"
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-300">
                              <ShoppingBag className="h-8 w-8" />
                            </div>
                          )}
                        </Link>

                        {/* Pagination indicator dots */}
                        <div className="mt-1 flex items-center justify-center gap-1">
                          <span className="h-1 w-2 rounded-full bg-slate-400"></span>
                          <span className="h-1 w-1 rounded-full bg-slate-200"></span>
                          <span className="h-1 w-1 rounded-full bg-slate-200"></span>
                        </div>
                      </div>

                      {/* Unit & ADD Button */}
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <span className="text-[11px] font-medium text-slate-500 truncate">
                          {product.unit ? `1 ${product.unit}` : "pcs"}
                        </span>

                        {/* ADD BUTTON OR STEPPER (Matches Blinkit Quick Commerce) */}
                        {product.stock <= 0 ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                            Out
                          </span>
                        ) : inCartQty === 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              addItem(product);
                              toast.success(`Added ${product.name} to cart`);
                            }}
                            className="rounded-lg border-2 border-sky-600 bg-sky-50/60 px-3 py-1 text-xs font-black text-sky-700 shadow-2xs hover:bg-sky-600 hover:text-white transition-all active:scale-95 flex items-center gap-0.5"
                          >
                            <span>ADD</span>
                            <Plus className="h-3 w-3 stroke-[3]" />
                          </button>
                        ) : (
                          <div className="flex items-center rounded-lg bg-sky-600 px-1 py-0.5 text-white shadow-sm gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (inCartQty <= 1) {
                                  removeItem(product.id);
                                } else {
                                  updateQuantity(product.id, inCartQty - 1);
                                }
                              }}
                              className="p-1 hover:bg-sky-700 rounded transition"
                              aria-label="Decrease"
                            >
                              <Minus className="h-3 w-3 stroke-[3]" />
                            </button>
                            <span className="min-w-3 text-center text-xs font-black">
                              {inCartQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                updateQuantity(product.id, inCartQty + 1);
                              }}
                              className="p-1 hover:bg-sky-700 rounded transition"
                              aria-label="Increase"
                            >
                              <Plus className="h-3 w-3 stroke-[3]" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Pricing Row */}
                      <div className="mt-1">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-sm font-extrabold text-slate-900">
                            {formatPrice(product.price)}
                          </span>
                          {product.mrp && product.mrp > product.price && (
                            <span className="text-[11px] text-slate-400 line-through">
                              {formatPrice(product.mrp)}
                            </span>
                          )}
                        </div>
                        {discountPercent > 0 && (
                          <span className="inline-block text-[10px] font-bold text-emerald-600 leading-tight">
                            {discountPercent}% off
                          </span>
                        )}
                      </div>

                      {/* Product Title */}
                      <Link
                        href={`/products/view?slug=${encodeURIComponent(product.slug)}`}
                        className="mt-1 text-xs font-semibold text-slate-800 line-clamp-2 leading-snug hover:text-sky-700"
                        title={product.name}
                      >
                        {product.name}
                      </Link>

                      {/* Delivery badge */}
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-slate-400">
                        <Zap className="h-3 w-3 text-amber-500 fill-amber-400 shrink-0" />
                        <span>Delivery Before 10:00 AM</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      )}

      {/* 4. SCREENSHOT 2: GROUPED CATEGORIES GRID VIEW */}
      {activeView === "categories" && (
        <div className="flex-1 px-3 py-3 overflow-y-auto pb-24">
          <div className="space-y-6">
            {groupedCategories.map((group) => {
              if (group.items.length === 0) return null;

              return (
                <section key={group.id} className="space-y-2.5">
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">
                    {group.title}
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {group.items.map((cat) => {
                      const imgUrl = getCategoryImage(cat.name, cat.image);

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => selectCategoryAndGoCatalog(cat.id)}
                          className="group flex flex-col items-center text-center transition-transform active:scale-95"
                        >
                          <div className="relative aspect-square w-full rounded-2xl border border-amber-100 bg-amber-50/60 p-2 shadow-2xs group-hover:border-amber-300 transition-colors flex items-center justify-center overflow-hidden">
                            <img
                              src={imgUrl}
                              alt={cat.name}
                              className="h-full w-full object-contain transition-transform group-hover:scale-105"
                              loading="lazy"
                            />
                          </div>
                          <span className="mt-1 text-[11px] font-semibold text-slate-800 line-clamp-2 leading-tight">
                            {cat.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: Brand Selector */}
      {showBrandFilter && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-sm rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="text-sm font-bold text-slate-900">Select Brand</h4>
              <button
                type="button"
                onClick={() => setShowBrandFilter(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto py-2 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedBrand(null);
                  setShowBrandFilter(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between",
                  !selectedBrand ? "bg-sky-50 text-sky-800" : "hover:bg-slate-50"
                )}
              >
                <span>All Brands</span>
                {!selectedBrand && <Check className="h-4 w-4 text-sky-600" />}
              </button>
              {availableBrands.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    setSelectedBrand(b);
                    setShowBrandFilter(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between",
                    selectedBrand === b ? "bg-sky-50 text-sky-800" : "hover:bg-slate-50"
                  )}
                >
                  <span>{b}</span>
                  {selectedBrand === b && <Check className="h-4 w-4 text-sky-600" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Sort Options */}
      {showSortModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-sm rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="text-sm font-bold text-slate-900">Sort Products</h4>
              <button
                type="button"
                onClick={() => setShowSortModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="py-2 space-y-1">
              {[
                { label: "Featured & Popular", value: undefined },
                { label: "Price: Low to High", value: "price-asc" as ProductSort },
                { label: "Price: High to Low", value: "price-desc" as ProductSort },
                { label: "Product Name (A - Z)", value: "name-asc" as ProductSort },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    onSortChange(opt.value);
                    setShowSortModal(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between",
                    selectedSort === opt.value
                      ? "bg-emerald-50 text-emerald-800"
                      : "hover:bg-slate-50"
                  )}
                >
                  <span>{opt.label}</span>
                  {selectedSort === opt.value && (
                    <Check className="h-4 w-4 text-emerald-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Filters Drawer */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-sm rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="text-sm font-bold text-slate-900">Filters</h4>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-3 space-y-4">
              {/* In stock toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-slate-700">In Stock Only</span>
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                  className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
              </label>

              {/* Loose weight item toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-slate-700">
                  Loose / Sold by Weight Only
                </span>
                <input
                  type="checkbox"
                  checked={onlyLoose}
                  onChange={(e) => setOnlyLoose(e.target.checked)}
                  className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
              </label>

              {/* Price max slider */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Max Price: ₹{priceRange}</span>
                  {priceRange < 2000 && (
                    <button
                      type="button"
                      onClick={() => setPriceRange(2000)}
                      className="text-[10px] text-emerald-600 font-semibold"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <input
                  type="range"
                  min="20"
                  max="2000"
                  step="20"
                  value={priceRange}
                  onChange={(e) => setPriceRange(Number(e.target.value))}
                  className="mt-2 w-full accent-emerald-600"
                />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between border-t pt-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setOnlyInStock(false);
                  setOnlyLoose(false);
                  setPriceRange(2000);
                  setShowFilterModal(false);
                }}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="flex-1 rounded-xl bg-emerald-700 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

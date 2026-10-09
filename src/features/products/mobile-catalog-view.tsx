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
  MapPin,
  Clock,
  Home,
  Briefcase,
  Building,
  Navigation,
  CheckCircle2,
  Tag,
  Maximize2,
} from "lucide-react";
import { ImageModal } from "@/components/ui/image-modal";
import { toast } from "sonner";
import { useCartStore } from "@/store/cart-store";
import { useAuth } from "@/hooks/use-auth";
import { wishlistService } from "@/services/wishlist.service";
import { addressService } from "@/services/address.service";
import { formatPrice } from "@/utils/format";
import { APP_NAME, APP_SHORT_NAME } from "@/lib/constants";
import type { Product, Category, ProductSort, Address } from "@/types/database";
import { cn } from "@/utils/cn";

// Fallback high-res imagery for grocery categories
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
  'Search for "atta, rice & dal..."',
  'Search for "tea, coffee & sugar..."',
  'Search for "chips & snacks..."',
  'Search for "biscuits & cookies..."',
  'Search for "soaps & shampoos..."',
];

/** Computes realistic dynamic Indian delivery time based on current hour in Vapi, Gujarat */
function getRealisticDeliveryTime(): { text: string; subtext: string; isInstant: boolean } {
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();

  // Store delivery active: 7:30 AM to 9:30 PM IST
  const isOperating =
    (hour > 7 || (hour === 7 && minutes >= 30)) &&
    (hour < 21 || (hour === 21 && minutes <= 30));

  if (isOperating) {
    const target = new Date(now.getTime() + 25 * 60 * 1000);
    const timeStr = target.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return {
      text: `In 20-30 mins (by ${timeStr})`,
      subtext: "Fast local delivery in Vapi",
      isInstant: true,
    };
  } else if (hour >= 21) {
    return {
      text: "Tomorrow morning by 8:30 AM",
      subtext: "Order now for priority morning delivery",
      isInstant: false,
    };
  } else {
    return {
      text: "Today morning by 8:30 AM",
      subtext: "Store opens at 7:30 AM",
      isInstant: false,
    };
  }
}

interface UserDeliveryAddress {
  label: string;
  address_line: string;
  city: string;
  postal_code: string;
}

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

  const searchInputRef = useRef<HTMLInputElement>(null);

  // View state: 'catalog' (split rail + products) or 'categories' (grouped categories grid)
  const isCategoriesTab = searchParams.get("view") === "categories";
  const [activeView, setActiveView] = useState<"catalog" | "categories">(
    isCategoriesTab ? "categories" : "catalog"
  );
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    name: string;
    price?: number;
  } | null>(null);

  useEffect(() => {
    setActiveView(searchParams.get("view") === "categories" ? "categories" : "catalog");
  }, [searchParams]);

  // Auto-focus search if requested via URL param (e.g. from bottom nav or homepage search)
  useEffect(() => {
    if (searchParams.get("focusSearch") === "true") {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
    }
  }, [searchParams]);

  // Realistic delivery time state (updates every minute)
  const [deliveryInfo, setDeliveryInfo] = useState(getRealisticDeliveryTime());
  useEffect(() => {
    const timer = setInterval(() => {
      setDeliveryInfo(getRealisticDeliveryTime());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // 1. USER DELIVERY ADDRESS (Real user address, not static)
  const [deliveryAddress, setDeliveryAddress] = useState<UserDeliveryAddress>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("ogs_user_delivery_address");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {
      label: "Deliver to",
      address_line: "Set delivery location in Vapi",
      city: "Vapi",
      postal_code: "396191",
    };
  });

  const [savedUserAddresses, setSavedUserAddresses] = useState<Address[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddrLine, setNewAddrLine] = useState("");
  const [newAddrArea, setNewAddrArea] = useState("");
  const [newAddrCity, setNewAddrCity] = useState("Vapi");
  const [newAddrPin, setNewAddrPin] = useState("396191");
  const [newAddrLabel, setNewAddrLabel] = useState<"Home" | "Work" | "Other">("Home");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Fetch logged-in user addresses from database
  useEffect(() => {
    if (user?.id) {
      addressService
        .getByUser(user.id)
        .then((addrs) => {
          setSavedUserAddresses(addrs);
          if (addrs.length > 0) {
            const def = addrs.find((a) => a.is_default) || addrs[0];
            const updatedAddr: UserDeliveryAddress = {
              label: def.is_default ? "Home" : "Address",
              address_line: def.address_line,
              city: def.city || "Vapi",
              postal_code: def.postal_code || "396191",
            };
            setDeliveryAddress(updatedAddr);
            try {
              localStorage.setItem("ogs_user_delivery_address", JSON.stringify(updatedAddr));
            } catch {}
          }
        })
        .catch(() => {});
    }
  }, [user?.id]);

  const handleSelectSavedAddress = (addr: Address) => {
    const updated: UserDeliveryAddress = {
      label: "Home",
      address_line: addr.address_line,
      city: addr.city || "Vapi",
      postal_code: addr.postal_code || "396191",
    };
    setDeliveryAddress(updated);
    try {
      localStorage.setItem("ogs_user_delivery_address", JSON.stringify(updated));
    } catch {}
    setShowAddressModal(false);
    toast.success("Delivery address updated!");
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingLocation(false);
        setNewAddrCity("Vapi");
        setNewAddrPin("396191");
        if (!newAddrArea) {
          setNewAddrArea("Near GIDC / Station Road, Vapi");
        }
        toast.success("Location detected in Vapi area!");
      },
      () => {
        setIsDetectingLocation(false);
        toast.info("Could not pinpoint exact GPS. Please enter your address details.");
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  const handleSaveCustomAddress = async () => {
    if (!newAddrLine.trim()) {
      toast.error("Please enter your flat / house number and building name");
      return;
    }

    const fullLine = newAddrArea.trim()
      ? `${newAddrLine.trim()}, ${newAddrArea.trim()}`
      : newAddrLine.trim();

    const updated: UserDeliveryAddress = {
      label: newAddrLabel,
      address_line: fullLine,
      city: newAddrCity.trim() || "Vapi",
      postal_code: newAddrPin.trim() || "396191",
    };

    setDeliveryAddress(updated);
    try {
      localStorage.setItem("ogs_user_delivery_address", JSON.stringify(updated));
    } catch {}

    if (user?.id) {
      try {
        await addressService.create(user.id, {
          address_line: fullLine,
          city: newAddrCity.trim() || "Vapi",
          state: "Gujarat",
          postal_code: newAddrPin.trim() || "396191",
          is_default: true,
        });
      } catch {}
    }

    setShowAddressModal(false);
    toast.success(`Delivery address set to ${newAddrLabel}!`);
  };

  // 2. INSTANT SEARCH STATE (Zero latency, debounced URL sync)
  const [localSearch, setLocalSearch] = useState(searchQuery || "");
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalSearch(searchQuery || "");
  }, [searchQuery]);

  const handleSearchInput = (val: string) => {
    setLocalSearch(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      onSearchChange(val);
    }, 400);
  };

  const handleClearSearch = () => {
    setLocalSearch("");
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    onSearchChange("");
  };

  // 3. INSTANT LOCAL CATEGORY SWITCHING (0ms feedback)
  const [localCategory, setLocalCategory] = useState<string | null>(selectedCategory);
  useEffect(() => {
    setLocalCategory(selectedCategory);
  }, [selectedCategory]);

  const handleCategorySelect = (catId: string | null) => {
    setLocalCategory(catId);
    onSelectCategory(catId);
  };

  // Animated Search Placeholder
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % SEARCH_PLACEHOLDERS.length);
    }, 3000);
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

  // Client-side instantaneous filtering across category, search, brand, stock, price, sort
  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Category filter
    const activeCat = localCategory;
    if (activeCat) {
      list = list.filter((p) => {
        if (p.category_id === activeCat) return true;
        if (p.categories?.id === activeCat) return true;
        if (p.categories?.slug === activeCat) return true;
        if (p.categories?.name?.toLowerCase() === activeCat.toLowerCase()) return true;
        return false;
      });
    }

    // Featured / Deals filter: if active deals exist, filter to them; otherwise show all products with banner
    const hasCatalogDeals = products.some((p) => p.featured || (p.mrp && p.mrp > p.price));
    if (isFeatured && hasCatalogDeals) {
      list = list.filter((p) => p.featured || (p.mrp && p.mrp > p.price));
    }

    // Real-time local search query
    if (localSearch.trim()) {
      const q = localSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.barcode?.includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.categories?.name?.toLowerCase().includes(q)
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
    localCategory,
    isFeatured,
    localSearch,
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
        toast.info("Listening... Speak your grocery item");
      };
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          handleSearchInput(transcript);
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

  // Grouped Categories for Categories Tab View
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
        title: "Grains, Atta, Dal & Cooking Oils",
        items: staples.length > 0 ? staples : categories.slice(8, 12),
      },
      {
        id: "household",
        title: "Household & Personal Care",
        items: household.length > 0 ? household : categories.slice(12),
      },
    ];
  }, [categories]);

  // Navigate to category in catalog view and clear view=categories
  const selectCategoryAndGoCatalog = (categoryId: string | null) => {
    handleCategorySelect(categoryId);
    setActiveView("catalog");
  };

  return (
    <div
      data-mobile-catalog="true"
      className="fixed inset-0 z-20 flex flex-col h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-slate-50 text-gray-800 select-none"
    >
      {/* 1. TOP HEADER: FIXED AT TOP */}
      <header className="shrink-0 z-30 bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 text-white px-3.5 pt-2.5 pb-2.5 shadow-md">
        {/* Top row: Store Logo + User Delivery Address + Account Avatar */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Store Logo */}
            <Link href="/" className="shrink-0 group">
              <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-white p-0.5 shadow-xs transition-transform group-hover:scale-105">
                <Image
                  src="/logo.png"
                  alt={APP_NAME}
                  width={36}
                  height={36}
                  priority
                  className="h-full w-full rounded-full object-contain"
                />
              </div>
            </Link>

            {/* Clickable User Delivery Address Selector */}
            <button
              type="button"
              onClick={() => setShowAddressModal(true)}
              className="flex-1 text-left min-w-0 group hover:opacity-95 transition"
              title="Change Delivery Address"
            >
              <div className="flex items-center gap-1 leading-none">
                <span className="text-[11px] font-semibold text-blue-200">Deliver to</span>
                <span className="text-xs font-black text-white flex items-center gap-0.5">
                  {deliveryAddress.label}
                  <ChevronDown className="h-3 w-3 text-blue-200 group-hover:translate-y-0.5 transition-transform" />
                </span>
              </div>
              <p className="text-[11px] text-blue-100 truncate font-medium mt-0.5 max-w-[210px] sm:max-w-xs">
                {deliveryAddress.address_line}
                {deliveryAddress.city ? `, ${deliveryAddress.city}` : ""}
              </p>
            </button>
          </div>

          {/* User profile avatar / Login */}
          <Link
            href={user ? "/dashboard" : "/auth/login"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-800/80 text-white border border-blue-400/50 shadow-xs hover:bg-blue-700 transition active:scale-95"
            aria-label="Account"
          >
            <span className="text-xs font-bold">
              {user?.email ? user.email.slice(0, 1).toUpperCase() : "👤"}
            </span>
          </Link>
        </div>

        {/* Search Bar Pill with Blue Accent */}
        <div className="mt-2.5 relative flex items-center rounded-full bg-white px-3.5 py-1.5 shadow-xs border border-blue-200/60 focus-within:ring-2 focus-within:ring-blue-400 transition-all">
          <Search className="h-4 w-4 text-blue-700 shrink-0 mr-2" />
          <input
            ref={searchInputRef}
            type="text"
            value={localSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder={SEARCH_PLACEHOLDERS[placeholderIndex]}
            className="w-full bg-transparent text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none font-medium"
          />
          {localSearch ? (
            <button
              type="button"
              onClick={handleClearSearch}
              className="p-1 text-gray-400 hover:text-gray-700 transition"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startVoiceSearch}
              className="p-1 text-blue-700 hover:text-blue-900 transition active:scale-90"
              title="Voice Search"
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. CATEGORY SWITCHER TABS (Clean blue & gray tokens) */}
      <div className="shrink-0 z-20 bg-white border-b border-gray-200/80 px-3 py-1.5 flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveView("catalog")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all",
              activeView === "catalog"
                ? "bg-blue-700 text-white shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Products</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView("categories")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all",
              activeView === "categories"
                ? "bg-blue-700 text-white shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Categories</span>
          </button>
        </div>

        {/* Deals toggle */}
        <button
          type="button"
          onClick={() => onToggleFeatured(!isFeatured)}
          className={cn(
            "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition border shadow-2xs",
            isFeatured
              ? "bg-amber-100 border-amber-300 text-amber-900"
              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
          )}
        >
          <span>🔥 Deals</span>
          {isFeatured && <span className="text-[10px] text-amber-700 font-extrabold">✓</span>}
        </button>
      </div>

      {/* 3. SPLIT-SCREEN CATALOG VIEW (Left Rail + Right 2-Column Product Cards) */}
      {activeView === "catalog" && (
        <div className="flex flex-1 min-h-0 h-full overflow-hidden">
          {/* LEFT CATEGORY RAIL (Vertical quick switcher - scrolls independently) */}
          <aside className="w-[78px] shrink-0 h-full overflow-y-auto overflow-x-hidden overscroll-contain border-r border-gray-200 bg-gray-50/80 flex flex-col py-1.5 scrollbar-none pb-28 touch-pan-y">
            {/* Deals / Specials Tab */}
            <button
              type="button"
              onClick={() => {
                onToggleFeatured(true);
                handleCategorySelect(null);
              }}
              className={cn(
                "group relative flex flex-col items-center justify-center py-2 px-1 text-center transition-colors border-l-4",
                isFeatured && !localCategory
                  ? "border-blue-600 bg-white font-bold text-blue-950 shadow-2xs"
                  : "border-transparent text-gray-600 hover:bg-gray-100"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-gray-900 shadow-2xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="mt-1 text-[10px] font-bold leading-tight line-clamp-2">
                Deals &amp; Picks
              </span>
            </button>

            {/* All Items Tab */}
            <button
              type="button"
              onClick={() => {
                onToggleFeatured(false);
                handleCategorySelect(null);
              }}
              className={cn(
                "group relative flex flex-col items-center justify-center py-2 px-1 text-center transition-colors border-l-4",
                !localCategory && !isFeatured
                  ? "border-blue-600 bg-white font-bold text-blue-950 shadow-2xs"
                  : "border-transparent text-gray-600 hover:bg-gray-100"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-800 shadow-2xs">
                <Package className="h-5 w-5" />
              </div>
              <span className="mt-1 text-[10px] font-semibold leading-tight line-clamp-2">
                All Items
              </span>
            </button>

            {/* Categories from store */}
            {categories.map((cat) => {
              const isActive =
                localCategory === cat.id ||
                localCategory === cat.slug ||
                localCategory === cat.name;
              const imgUrl = getCategoryImage(cat.name, cat.image);

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    onToggleFeatured(false);
                    handleCategorySelect(cat.id);
                  }}
                  className={cn(
                    "group relative flex flex-col items-center justify-center py-2 px-1 text-center transition-all border-l-4",
                    isActive
                      ? "border-blue-600 bg-white font-bold text-blue-950 shadow-2xs"
                      : "border-transparent text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <div className="relative h-10 w-10 overflow-hidden rounded-full border border-gray-200 bg-white shadow-2xs">
                    <img
                      src={imgUrl}
                      alt={cat.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <span className="mt-1 text-[10px] leading-tight line-clamp-2 px-0.5 font-medium">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </aside>

          {/* RIGHT PRODUCT FEED (Scrolls independently) */}
          <main className="flex-1 h-full min-w-0 overflow-y-auto overscroll-contain px-2 pt-2 pb-28 bg-gray-50/40 touch-pan-y">
            {/* Top filter strip: [ Filters ] [ Brands ⌄ ] [ Sort ☰ ] */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xs pb-2 pt-0.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs border-b border-gray-100 mb-1.5">
              {/* Filters Button */}
              <button
                type="button"
                onClick={() => setShowFilterModal(true)}
                className="flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 font-semibold text-gray-700 shadow-2xs hover:bg-gray-50"
              >
                <SlidersHorizontal className="h-3 w-3 text-green-700" />
                <span>Filters</span>
                {(onlyInStock || onlyLoose || priceRange < 2000) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-green-600"></span>
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
                      ? "border-green-600 bg-green-50 text-green-900"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
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
                    ? "border-green-600 bg-green-50 text-green-900"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                )}
              >
                <ArrowUpDown className="h-3 w-3 text-gray-600" />
                <span>
                  {selectedSort === "price-asc"
                    ? "Price: Low"
                    : selectedSort === "price-desc"
                    ? "Price: High"
                    : "Sort"}
                </span>
              </button>

              {/* Reset active filters */}
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

            {/* If deals mode is active but there are no active deals, show friendly fallback message */}
            {isFeatured && !products.some((p) => p.featured || (p.mrp && p.mrp > p.price)) && (
              <div className="mb-2.5 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 p-3 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white shadow-2xs shrink-0 mt-0.5">
                    <Tag className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900">
                      ⚡ There are no deals at the moment
                    </h4>
                    <p className="text-[11px] text-gray-600 mt-0.5">
                      Showing all other fresh products &amp; daily groceries below!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Product Count & Active Category Badge */}
            <div className="flex items-center justify-between px-1 py-1 text-[11px] text-gray-500">
              <span>
                <b>{filteredProducts.length}</b> products available
              </span>
              {isFeatured && (
                <span
                  className={cn(
                    "font-bold px-2 py-0.5 rounded-full text-[10px]",
                    !products.some((p) => p.featured || (p.mrp && p.mrp > p.price))
                      ? "bg-gray-100 text-gray-700 border border-gray-200"
                      : "bg-amber-100 text-amber-900"
                  )}
                >
                  {!products.some((p) => p.featured || (p.mrp && p.mrp > p.price))
                    ? "📦 All Products"
                    : "🔥 Deals Active"}
                </span>
              )}
            </div>

            {/* Product Cards Grid: 2 Columns */}
            {loading && products.length === 0 ? (
              <div className="grid grid-cols-2 gap-2 mt-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-56 rounded-2xl bg-white p-3 border border-gray-100 animate-pulse flex flex-col justify-between"
                  >
                    <div className="h-28 rounded-xl bg-gray-200" />
                    <div className="space-y-2">
                      <div className="h-3 w-16 bg-gray-200 rounded" />
                      <div className="h-4 w-full bg-gray-200 rounded" />
                      <div className="h-4 w-12 bg-gray-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="my-8 rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center shadow-2xs">
                <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-gray-700">No items match your criteria</p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Try clearing active filters or search terms.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleCategorySelect(null);
                    onToggleFeatured(false);
                    handleClearSearch();
                    setSelectedBrand(null);
                    setOnlyInStock(false);
                    setOnlyLoose(false);
                    setPriceRange(2000);
                  }}
                  className="mt-3 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-green-800"
                >
                  View All Products
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
                      className="group relative flex flex-col justify-between rounded-2xl border border-gray-200/80 bg-white p-2.5 shadow-2xs transition-shadow hover:shadow-md"
                    >
                      {/* Top Image & Wishlist Container */}
                      <div className="relative">
                        {/* Wishlist Heart Button */}
                        <button
                          type="button"
                          onClick={(e) => toggleWishlist(product.id, e)}
                          className="absolute -top-1 -right-1 z-10 rounded-full p-1 text-gray-400 hover:text-red-500 transition active:scale-125"
                          aria-label="Wishlist"
                        >
                          <Heart
                            className={cn(
                              "h-4 w-4 transition-colors",
                              isWishlisted ? "fill-red-500 text-red-500" : "text-gray-400"
                            )}
                          />
                        </button>

                        {/* Product Photo (Fit to screen & proportional) */}
                        <div className="relative aspect-square w-full max-h-36 sm:max-h-40 overflow-hidden rounded-xl bg-white border border-gray-100 flex items-center justify-center p-1.5">
                          <Link
                            href={`/products/view?slug=${encodeURIComponent(product.slug)}`}
                            className="h-full w-full flex items-center justify-center"
                          >
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="max-h-full max-w-full w-auto h-auto object-contain transition-transform group-hover:scale-105"
                                loading="lazy"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-gray-300">
                                <ShoppingBag className="h-8 w-8 text-gray-300" />
                              </div>
                            )}
                          </Link>

                          {/* Quick Fit-to-screen photo preview */}
                          {product.image_url && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPreviewImage({
                                  url: product.image_url!,
                                  name: product.name,
                                  price: product.price,
                                });
                              }}
                              className="absolute bottom-1 right-1 p-1 rounded-md bg-white/90 text-gray-500 hover:text-green-700 shadow-2xs backdrop-blur-2xs transition"
                              title="Fit to screen photo preview"
                            >
                              <Maximize2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* Pagination indicator dots */}
                        <div className="mt-1 flex items-center justify-center gap-1">
                          <span className="h-1 w-2 rounded-full bg-gray-400"></span>
                          <span className="h-1 w-1 rounded-full bg-gray-200"></span>
                          <span className="h-1 w-1 rounded-full bg-gray-200"></span>
                        </div>
                      </div>

                      {/* Unit & ADD Button */}
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <span className="text-[11px] font-medium text-gray-500 truncate">
                          {product.unit ? `1 ${product.unit}` : "pcs"}
                        </span>

                        {/* ADD BUTTON OR STEPPER (Branded Website Green/Blue) */}
                        {product.stock <= 0 ? (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-400">
                            Out of Stock
                          </span>
                        ) : inCartQty === 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (product.stock <= 0) {
                                toast.error(`"${product.name}" is currently out of stock`);
                                return;
                              }
                              addItem(product);
                              toast.success(`Added ${product.name} to cart`);
                            }}
                            className="rounded-lg border-2 border-blue-600 bg-blue-50/70 px-3 py-1 text-xs font-black text-blue-900 shadow-2xs hover:bg-blue-600 hover:text-white transition-all active:scale-95 flex items-center gap-0.5"
                          >
                            <span>ADD</span>
                            <Plus className="h-3 w-3 stroke-[3]" />
                          </button>
                        ) : (
                          <div className="flex items-center rounded-lg bg-blue-700 px-1 py-0.5 text-white shadow-xs gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (inCartQty <= 1) {
                                  removeItem(product.id);
                                } else {
                                  updateQuantity(product.id, inCartQty - 1);
                                }
                              }}
                              className="p-1 hover:bg-blue-800 rounded transition"
                              aria-label="Decrease"
                            >
                              <Minus className="h-3 w-3 stroke-[3]" />
                            </button>
                            <span className="min-w-3 text-center text-xs font-black">
                              {inCartQty}
                            </span>
                            <button
                              type="button"
                              disabled={inCartQty >= product.stock}
                              onClick={() => {
                                if (inCartQty >= product.stock) {
                                  toast.error(
                                    `Only ${product.stock} items available in stock!`
                                  );
                                  return;
                                }
                                updateQuantity(product.id, inCartQty + 1);
                              }}
                              className={cn(
                                "p-1 rounded transition",
                                inCartQty >= product.stock
                                  ? "opacity-40 cursor-not-allowed"
                                  : "hover:bg-blue-800"
                              )}
                              aria-label="Increase"
                              title={
                                inCartQty >= product.stock
                                  ? `Maximum stock limit reached (${product.stock})`
                                  : "Add one more"
                              }
                            >
                              <Plus className="h-3 w-3 stroke-[3]" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Pricing Row */}
                      <div className="mt-1">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-sm font-extrabold text-blue-950">
                            {formatPrice(product.price)}
                          </span>
                          {product.mrp && product.mrp > product.price && (
                            <span className="text-[11px] text-gray-400 line-through">
                              {formatPrice(product.mrp)}
                            </span>
                          )}
                        </div>
                        {discountPercent > 0 && (
                          <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded leading-tight">
                            {discountPercent}% off
                          </span>
                        )}
                      </div>

                      {/* Product Title */}
                      <Link
                        href={`/products/view?slug=${encodeURIComponent(product.slug)}`}
                        className="mt-1 text-xs font-semibold text-gray-900 line-clamp-2 leading-snug hover:text-blue-700"
                        title={product.name}
                      >
                        {product.name}
                      </Link>

                      {/* Dynamic Realistic Delivery Badge */}
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-gray-500">
                        <Zap className="h-3 w-3 text-blue-600 fill-blue-500 shrink-0" />
                        <span className="truncate">{deliveryInfo.text}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      )}

      {/* 4. GROUPED CATEGORIES GRID VIEW (Scrolls independently) */}
      {activeView === "categories" && (
        <div className="flex-1 h-full min-h-0 overflow-y-auto overscroll-contain px-3 py-3 pb-28 bg-gray-50/30 touch-pan-y">
          <div className="space-y-6">
            {groupedCategories.map((group) => {
              if (group.items.length === 0) return null;

              return (
                <section key={group.id} className="space-y-2.5">
                  <h3 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-600"></span>
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
                          <div className="relative aspect-square w-full rounded-2xl border border-green-100 bg-green-50/50 p-2 shadow-2xs group-hover:border-green-300 transition-colors flex items-center justify-center overflow-hidden">
                            <img
                              src={imgUrl}
                              alt={cat.name}
                              className="h-full w-full object-contain transition-transform group-hover:scale-105"
                              loading="lazy"
                            />
                          </div>
                          <span className="mt-1 text-[11px] font-semibold text-gray-800 line-clamp-2 leading-tight">
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

      {/* MODAL: Real User Delivery Address Selector & Setter */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-green-800">
                <MapPin className="h-5 w-5 text-green-700" />
                <h4 className="text-base font-bold text-gray-900">Delivery Address</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAddressModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto py-3 space-y-4 text-xs">
              {/* Saved addresses for logged-in user */}
              {savedUserAddresses.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Saved Addresses
                  </span>
                  <div className="space-y-2">
                    {savedUserAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => handleSelectSavedAddress(addr)}
                        className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-green-600 bg-gray-50/50 hover:bg-green-50/40 transition flex items-start gap-2.5"
                      >
                        <Home className="h-4 w-4 text-green-700 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900">
                            {addr.address_line}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {addr.city}, Gujarat - {addr.postal_code}
                          </p>
                        </div>
                        {deliveryAddress.address_line === addr.address_line && (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Set New Address Form */}
              <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                    {savedUserAddresses.length > 0 ? "Or Enter Another Address" : "Enter Delivery Address"}
                  </span>
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={isDetectingLocation}
                    className="flex items-center gap-1 text-[11px] font-bold text-green-700 hover:underline disabled:opacity-60"
                  >
                    <Navigation className={cn("h-3 w-3", isDetectingLocation && "animate-spin")} />
                    <span>{isDetectingLocation ? "Detecting..." : "Use GPS Location"}</span>
                  </button>
                </div>

                {/* Tag Buttons */}
                <div className="flex items-center gap-2">
                  {(["Home", "Work", "Other"] as const).map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setNewAddrLabel(lbl)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold transition border",
                        newAddrLabel === lbl
                          ? "bg-green-700 text-white border-green-700 shadow-xs"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">
                    House / Flat No., Society / Building <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newAddrLine}
                    onChange={(e) => setNewAddrLine(e.target.value)}
                    placeholder="e.g. Flat 302, Swastik Complex"
                    className="w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">
                    Area / Street / Landmark
                  </label>
                  <input
                    type="text"
                    value={newAddrArea}
                    onChange={(e) => setNewAddrArea(e.target.value)}
                    placeholder="e.g. Near Fellowship School, Silvassa Road"
                    className="w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={newAddrCity}
                      onChange={(e) => setNewAddrCity(e.target.value)}
                      placeholder="Vapi"
                      className="w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs focus:border-green-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">
                      Pincode
                    </label>
                    <input
                      type="text"
                      value={newAddrPin}
                      onChange={(e) => setNewAddrPin(e.target.value)}
                      placeholder="396191"
                      className="w-full rounded-xl border border-gray-300 bg-white p-2.5 text-xs focus:border-green-600 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveCustomAddress}
                  className="w-full rounded-xl bg-green-700 py-2.5 text-xs font-bold text-white shadow-md hover:bg-green-800 transition"
                >
                  Confirm &amp; Deliver Here
                </button>
              </div>

              {!user && (
                <div className="text-center pt-1">
                  <Link
                    href="/auth/login"
                    className="text-xs font-bold text-green-700 hover:underline"
                    onClick={() => setShowAddressModal(false)}
                  >
                    Sign in to view your account saved addresses →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Brand Selector */}
      {showBrandFilter && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-sm rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="text-sm font-bold text-gray-900">Select Brand</h4>
              <button
                type="button"
                onClick={() => setShowBrandFilter(false)}
                className="rounded-lg p-1 text-gray-400 hover:text-gray-600"
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
                  !selectedBrand ? "bg-green-50 text-green-900 font-bold" : "hover:bg-gray-50"
                )}
              >
                <span>All Brands</span>
                {!selectedBrand && <Check className="h-4 w-4 text-green-600" />}
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
                    selectedBrand === b ? "bg-green-50 text-green-900 font-bold" : "hover:bg-gray-50"
                  )}
                >
                  <span>{b}</span>
                  {selectedBrand === b && <Check className="h-4 w-4 text-green-600" />}
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
              <h4 className="text-sm font-bold text-gray-900">Sort Products</h4>
              <button
                type="button"
                onClick={() => setShowSortModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:text-gray-600"
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
                      ? "bg-green-50 text-green-900 font-bold"
                      : "hover:bg-gray-50"
                  )}
                >
                  <span>{opt.label}</span>
                  {selectedSort === opt.value && (
                    <Check className="h-4 w-4 text-green-600" />
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
              <h4 className="text-sm font-bold text-gray-900">Filter Products</h4>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-3 space-y-4">
              {/* In stock toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-gray-700">In Stock Only</span>
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                  className="h-4 w-4 rounded text-green-600 focus:ring-green-500"
                />
              </label>

              {/* Loose weight item toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-gray-700">
                  Loose / Sold by Weight Only
                </span>
                <input
                  type="checkbox"
                  checked={onlyLoose}
                  onChange={(e) => setOnlyLoose(e.target.checked)}
                  className="h-4 w-4 rounded text-green-600 focus:ring-green-500"
                />
              </label>

              {/* Price max slider */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                  <span>Max Price: ₹{priceRange}</span>
                  {priceRange < 2000 && (
                    <button
                      type="button"
                      onClick={() => setPriceRange(2000)}
                      className="text-[10px] text-green-600 font-semibold"
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
                  className="mt-2 w-full accent-green-600"
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
                className="flex-1 rounded-xl border border-gray-200 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="flex-1 rounded-xl bg-green-700 py-2 text-xs font-bold text-white shadow-xs hover:bg-green-800"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Fit-to-screen photo modal */}
      {previewImage && (
        <ImageModal
          isOpen={!!previewImage}
          onClose={() => setPreviewImage(null)}
          src={previewImage.url}
          alt={previewImage.name}
          title={previewImage.name}
          subtitle={previewImage.price != null ? formatPrice(previewImage.price) : undefined}
        />
      )}
    </div>
  );
}

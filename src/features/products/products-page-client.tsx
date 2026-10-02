"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { ProductsFilters } from "@/features/products/products-filters";
import { MobileCatalogView } from "@/features/products/mobile-catalog-view";
import { productService } from "@/services/product.service";
import { categoryService } from "@/services/category.service";
import { getCatalogCachedAt } from "@/lib/offline/product-cache";
import type { Product, Category, ProductSort } from "@/types/database";

export function ProductsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const isFeatured = searchParams.get("featured") === "true";
  const selectedCategory = searchParams.get("category");
  const searchQuery = searchParams.get("search");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");

  const activeFilterCount = [isFeatured, selectedCategory, searchQuery, minPrice, maxPrice].filter(Boolean).length;

  const filters = useMemo(
    () => ({
      category: selectedCategory ?? undefined,
      search: searchQuery ?? undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      sort: (searchParams.get("sort") as ProductSort) || undefined,
      featured: isFeatured,
    }),
    [searchParams, selectedCategory, searchQuery, minPrice, maxPrice, isFeatured]
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      productService.getAll(filters),
      categoryService.getAll(),
    ])
      .then(([prods, cats]) => {
        setProducts(prods);
        setCategories(cats);
        setOffline(!navigator.onLine && getCatalogCachedAt() != null);
      })
      .catch(async () => {
        try {
          const prods = await productService.getAll(filters);
          setProducts(prods);
          setOffline(true);
        } catch {
          setProducts([]);
        }
      })
      .finally(() => setLoading(false));
  }, [filters]);

  const removeFilter = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    router.push(`/products?${params.toString()}`);
  };

  const clearAllFilters = () => {
    router.push("/products");
  };

  return (
    <>
      {/* MOBILE QUICK-COMMERCE VIEW (< md, Blinkit / Instamart style) */}
      <div className="md:hidden">
        <MobileCatalogView
          products={products}
          categories={categories}
          loading={loading}
          selectedCategory={selectedCategory}
          onSelectCategory={(catId) => {
            const params = new URLSearchParams(searchParams.toString());
            if (catId) {
              params.set("category", catId);
            } else {
              params.delete("category");
            }
            router.push(`/products?${params.toString()}`);
          }}
          isFeatured={isFeatured}
          onToggleFeatured={(featured) => {
            const params = new URLSearchParams(searchParams.toString());
            if (featured) {
              params.set("featured", "true");
            } else {
              params.delete("featured");
            }
            router.push(`/products?${params.toString()}`);
          }}
          searchQuery={searchQuery || ""}
          onSearchChange={(query) => {
            const params = new URLSearchParams(searchParams.toString());
            if (query.trim()) {
              params.set("search", query.trim());
            } else {
              params.delete("search");
            }
            router.push(`/products?${params.toString()}`);
          }}
          selectedSort={(searchParams.get("sort") as ProductSort) || undefined}
          onSortChange={(sort) => {
            const params = new URLSearchParams(searchParams.toString());
            if (sort) {
              params.set("sort", sort);
            } else {
              params.delete("sort");
            }
            router.push(`/products?${params.toString()}`);
          }}
        />
      </div>

      {/* DESKTOP CATALOG VIEW (>= md) */}
      <div className="hidden md:block container mx-auto px-4 py-8">
        {offline && (
          <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
            Offline — showing cached catalog from your last visit.
          </p>
        )}

        {/* Header Banner */}
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900">
              {isFeatured ? "🔥 Deals & Special Offers" : "All Products"}
            </h1>
            {isFeatured && (
              <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-800">
                Deals Filter Active
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {isFeatured
              ? "Handpicked grocery deals and featured essentials from Odhavram General Store."
              : "Browse daily essentials, snacks, grains, spices, dairy and household staples."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isFeatured ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-800 transition"
            >
              ← View All Products (Full Catalogue)
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("featured", "true");
                router.push(`/products?${params.toString()}`);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 transition"
            >
              🔥 View Deals Only
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Chips */}
      {(isFeatured || selectedCategory || searchQuery || minPrice || maxPrice) && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 p-3 border border-gray-200">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 mr-1">
            Active Filters:
          </span>
          {isFeatured && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-200/80 px-3 py-1 text-xs font-bold text-amber-950">
              🔥 Deals &amp; Featured
              <button
                type="button"
                onClick={() => removeFilter("featured")}
                className="hover:text-red-700 font-bold ml-0.5"
                title="Remove deals filter"
              >
                ✕
              </button>
            </span>
          )}
          {selectedCategory && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-900">
              Category: {categories.find((c) => c.id === selectedCategory)?.name ?? "Selected"}
              <button
                type="button"
                onClick={() => removeFilter("category")}
                className="hover:text-red-700 font-bold ml-0.5"
                title="Remove category filter"
              >
                ✕
              </button>
            </span>
          )}
          {searchQuery && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-900">
              Search: &quot;{searchQuery}&quot;
              <button
                type="button"
                onClick={() => removeFilter("search")}
                className="hover:text-red-700 font-bold ml-0.5"
              >
                ✕
              </button>
            </span>
          )}
          {(minPrice || maxPrice) && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-800">
              Price: ₹{minPrice || "0"} - ₹{maxPrice || "Any"}
              <button
                type="button"
                onClick={() => {
                  const p = new URLSearchParams(searchParams.toString());
                  p.delete("minPrice");
                  p.delete("maxPrice");
                  router.push(`/products?${p.toString()}`);
                }}
                className="hover:text-red-700 font-bold ml-0.5"
              >
                ✕
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={clearAllFilters}
            className="ml-auto text-xs font-semibold text-green-700 hover:text-green-900 hover:underline"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Mobile Filter Toggle */}
      <div className="flex items-center justify-between gap-2.5 lg:hidden mb-4">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen((o) => !o)}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-50 transition"
        >
          <span>🎛️ {mobileFiltersOpen ? "Hide Filters & Sort" : "Filter & Sort Products"}</span>
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-700 text-[10px] font-extrabold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
          >
            Reset
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:gap-8 lg:flex-row">
        <aside className={`shrink-0 lg:w-64 ${mobileFiltersOpen ? "block mb-4" : "hidden lg:block"}`}>
          <ProductsFilters categories={categories} />
        </aside>
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/70 p-12 text-center">
              <p className="text-base font-semibold text-gray-800">
                {isFeatured
                  ? "No special deals or featured products match this filter."
                  : "No products found matching your criteria."}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Try clearing active filters or explore the full store catalog.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-800"
                >
                  View All Products
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

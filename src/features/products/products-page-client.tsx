"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { ProductsFilters } from "@/features/products/products-filters";
import { productService } from "@/services/product.service";
import { categoryService } from "@/services/category.service";
import { getCatalogCachedAt } from "@/lib/offline/product-cache";
import type { Product, Category, ProductSort } from "@/types/database";

export function ProductsPageClient() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const filters = useMemo(
    () => ({
      category: searchParams.get("category") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      minPrice: searchParams.get("minPrice")
        ? Number(searchParams.get("minPrice"))
        : undefined,
      maxPrice: searchParams.get("maxPrice")
        ? Number(searchParams.get("maxPrice"))
        : undefined,
      sort: (searchParams.get("sort") as ProductSort) || undefined,
      featured: searchParams.get("featured") === "true",
    }),
    [searchParams]
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

  return (
    <div className="container mx-auto px-4 py-8">
      {offline && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Offline — showing cached catalog from your last visit.
        </p>
      )}
      <h1 className="mb-6 text-3xl font-bold text-gray-900">All Products</h1>
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="shrink-0 lg:w-64">
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
            <p className="rounded-lg bg-gray-50 p-12 text-center text-gray-600">
              No products found. Try adjusting your filters.
            </p>
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
  );
}

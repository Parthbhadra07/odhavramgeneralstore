"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HeroBanner } from "@/features/home/hero-banner";
import { PromoOffers } from "@/features/home/promo-offers";
import { ProductCard } from "@/components/product-card";
import { CategoryCard } from "@/components/category-card";
import { Button } from "@/components/ui/button";
import { productService } from "@/services/product.service";
import { categoryService } from "@/services/category.service";
import { getCatalogCachedAt } from "@/lib/offline/product-cache";
import type { Product, Category } from "@/types/database";

export function HomePageClient() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [products, cats] = await Promise.all([
          productService.getAll({ featured: true }),
          categoryService.getAll(),
        ]);
        setFeatured(products.slice(0, 8));
        setCategories(cats.slice(0, 6));
        setOffline(!navigator.onLine && getCatalogCachedAt() != null);
      } catch {
        const cached = await productService.getAll({ featured: true }).catch(() => []);
        setFeatured(cached.slice(0, 8));
        setOffline(true);
        categoryService.getAll().then((c) => setCategories(c.slice(0, 6))).catch(() => {});
      }
    };
    load();
  }, []);

  return (
    <>
      {offline && (
        <p className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
          Offline mode — showing saved products.
        </p>
      )}
      <HeroBanner />
      <PromoOffers />

      {categories.length > 0 && (
        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Shop by Category</h2>
              <Link
                href="/products"
                className="flex items-center gap-1 text-sm font-medium text-green-700 hover:underline"
              >
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
              {categories.map((cat) => (
                <CategoryCard key={cat.id} category={cat} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-white py-12">
        <div className="container mx-auto px-4">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
            <Button variant="outline" href="/products?featured=true">
              View All
            </Button>
          </div>
          {featured.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-gray-50 p-8 text-center text-gray-600">
              No featured products yet. Add products in the admin panel.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

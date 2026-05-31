import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HeroBanner } from "@/features/home/hero-banner";
import { PromoOffers } from "@/features/home/promo-offers";
import { ProductCard } from "@/components/product-card";
import { CategoryCard } from "@/components/category-card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const revalidate = 60;

export default async function HomePage() {
  const supabase = await createClient();

  const [{ data: featured }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("*, categories(id, name, slug, image)")
      .eq("featured", true)
      .limit(8),
    supabase.from("categories").select("*").limit(6),
  ]);

  return (
    <>
      <HeroBanner />
      <PromoOffers />

      {categories && categories.length > 0 && (
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
          {featured && featured.length > 0 ? (
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

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ProductCard } from "@/components/product-card";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { ProductsFilters } from "@/features/products/products-filters";
import type { ProductSort } from "@/types/database";

export const metadata = { title: "Shop All Products" };

interface PageProps {
  searchParams: Promise<{
    category?: string;
    search?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: ProductSort;
    featured?: string;
  }>;
}

async function ProductGrid({
  searchParams,
}: {
  searchParams: Awaited<PageProps["searchParams"]>;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("*, categories(id, name, slug, image)");

  if (searchParams.category) {
    query = query.eq("category_id", searchParams.category);
  }
  if (searchParams.featured === "true") {
    query = query.eq("featured", true);
  }
  if (searchParams.search) {
    query = query.ilike("name", `%${searchParams.search}%`);
  }
  if (searchParams.minPrice) {
    query = query.gte("price", Number(searchParams.minPrice));
  }
  if (searchParams.maxPrice) {
    query = query.lte("price", Number(searchParams.maxPrice));
  }

  switch (searchParams.sort) {
    case "price-asc":
      query = query.order("price", { ascending: true });
      break;
    case "price-desc":
      query = query.order("price", { ascending: false });
      break;
    case "name-asc":
      query = query.order("name", { ascending: true });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data: products } = await query;

  if (!products?.length) {
    return (
      <p className="col-span-full rounded-lg bg-gray-50 p-12 text-center text-gray-600">
        No products found. Try adjusting your filters.
      </p>
    );
  }

  return (
    <>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </>
  );
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("*");

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">All Products</h1>
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="lg:w-64 shrink-0">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-gray-100" />}>
            <ProductsFilters categories={categories ?? []} />
          </Suspense>
        </aside>
        <div className="flex-1">
          <Suspense
            fallback={
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <ProductGrid searchParams={params} />
            </div>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

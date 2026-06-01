import { Suspense } from "react";
import { ProductsPageClient } from "@/features/products/products-page-client";

export const metadata = { title: "Shop All Products" };

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        </div>
      }
    >
      <ProductsPageClient />
    </Suspense>
  );
}

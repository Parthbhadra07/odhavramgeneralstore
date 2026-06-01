import { Suspense } from "react";
import { ProductDetailClient } from "@/features/products/product-detail-client";

export const metadata = { title: "Product" };

export default function ProductViewPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center">Loading...</p>}>
      <ProductDetailClient />
    </Suspense>
  );
}

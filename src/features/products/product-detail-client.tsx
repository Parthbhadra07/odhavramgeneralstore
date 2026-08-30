"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductImage } from "@/components/product-image";
import { formatPrice } from "@/utils/format";
import { AddToCartButton } from "@/features/products/add-to-cart-button";
import { Badge } from "@/components/ui/badge";
import { productService } from "@/services/product.service";
import type { Product } from "@/types/database";
import Link from "next/link";

export function ProductDetailClient() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    productService
      .getBySlug(slug)
      .then((p) => {
        setProduct(p);
        setOffline(!navigator.onLine && !!p);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <p className="container mx-auto px-4 py-16 text-center">Loading...</p>;
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-gray-600">Product not found.</p>
        <Link href="/products" className="mt-4 inline-block text-green-700 hover:underline">
          Back to shop
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {offline && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Offline — product details from cache.
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-gray-50">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>
        <div>
          {product.categories && (
            <Badge variant="success" className="mb-2">
              {product.categories.name}
            </Badge>
          )}
          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
          <p className="mt-4 text-3xl font-bold text-green-700">
            {formatPrice(product.price)}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            {product.stock > 0 ? (
              <span className="text-green-600">{product.stock} in stock</span>
            ) : (
              <span className="text-red-600">Out of stock</span>
            )}
          </p>
          {product.description && (
            <p className="mt-6 leading-relaxed text-gray-600">{product.description}</p>
          )}
          <div className="mt-8">
            <AddToCartButton product={product} />
          </div>
        </div>
      </div>
    </div>
  );
}

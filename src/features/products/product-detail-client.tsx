"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductImage } from "@/components/product-image";
import { ImageModal } from "@/components/ui/image-modal";
import { formatPrice } from "@/utils/format";
import { AddToCartButton } from "@/features/products/add-to-cart-button";
import { Badge } from "@/components/ui/badge";
import { productService } from "@/services/product.service";
import type { Product } from "@/types/database";
import Link from "next/link";
import { Maximize2 } from "lucide-react";

export function ProductDetailClient() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

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
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-white border border-gray-100 p-6 flex items-center justify-center shadow-xs group">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            fill
            fit="contain"
            className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          {product.image_url && (
            <button
              type="button"
              onClick={() => setShowImageModal(true)}
              className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm border border-gray-200 backdrop-blur-xs transition hover:bg-white hover:text-green-700 hover:border-green-300"
              title="Click to view full photo fit to screen"
            >
              <Maximize2 className="h-3.5 w-3.5 text-green-700" />
              <span>Fit to Screen</span>
            </button>
          )}
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

      {showImageModal && (
        <ImageModal
          isOpen={showImageModal}
          onClose={() => setShowImageModal(false)}
          src={product.image_url}
          alt={product.name}
          title={product.name}
          subtitle={`${formatPrice(product.price)} · ${product.categories?.name || "General Item"}`}
        />
      )}
    </div>
  );
}

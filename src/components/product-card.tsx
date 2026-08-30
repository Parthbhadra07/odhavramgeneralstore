"use client";

import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { Plus, Heart } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/types/database";
import { formatPrice } from "@/utils/format";
import { useCartStore } from "@/store/cart-store";
import { useAuth } from "@/hooks/use-auth";
import { wishlistService } from "@/services/wishlist.service";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const { user } = useAuth();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (product.stock <= 0) {
      toast.error("Out of stock");
      return;
    }
    addItem(product);
    toast.success("Added to cart");
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to save items");
      return;
    }
    try {
      await wishlistService.add(user.id, product.id);
      toast.success("Added to wishlist");
    } catch {
      toast.error("Could not add to wishlist");
    }
  };

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      <Link href={`/products/view?slug=${encodeURIComponent(product.slug)}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-gray-50">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
          {product.featured && (
            <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
              Featured
            </span>
          )}
          {product.stock <= 0 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-medium text-white">
              Out of Stock
            </span>
          )}
          <button
            type="button"
            onClick={handleWishlist}
            className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-gray-600 opacity-0 shadow transition-opacity group-hover:opacity-100 hover:text-red-500"
            aria-label="Add to wishlist"
          >
            <Heart className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <h3 className="line-clamp-2 text-sm font-medium text-gray-900">
            {product.name}
          </h3>
          {product.categories && (
            <p className="mt-0.5 text-xs text-gray-500">
              {product.categories.name}
            </p>
          )}
          <p className="mt-2 text-lg font-bold text-green-700">
            {formatPrice(product.price)}
          </p>
        </div>
      </Link>
      <div className="px-4 pb-4">
        <Button
          size="sm"
          className="w-full"
          onClick={handleAddToCart}
          disabled={product.stock <= 0}
        >
          <Plus className="h-4 w-4" />
          Add to Cart
        </Button>
      </div>
    </article>
  );
}

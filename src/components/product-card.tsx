"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { ImageModal } from "@/components/ui/image-modal";
import { Plus, Minus, Check, Heart, Maximize2 } from "lucide-react";
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
  const [showImageModal, setShowImageModal] = useState(false);
  const { items, addItem, updateQuantity, removeItem } = useCartStore();
  const { user } = useAuth();

  const currentItem = items.find((i) => i.productId === product.id);
  const inCartQty = currentItem ? currentItem.quantity : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (product.stock <= 0) {
      toast.error("Out of stock");
      return;
    }
    if (inCartQty >= product.stock) {
      toast.error(`Only ${product.stock} items available in stock!`);
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
    <>
      <article
        className={cn(
          "group overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xs transition-all hover:shadow-md hover:border-gray-200",
          className
        )}
      >
        <Link href={`/products/view?slug=${encodeURIComponent(product.slug)}`} className="block">
          <div className="relative aspect-square overflow-hidden bg-white p-2.5 flex items-center justify-center border-b border-gray-100/80">
            <ProductImage
              src={product.image_url}
              alt={product.name}
              fill
              fit="contain"
              className="object-contain p-1.5 transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
            {/* Quantity added badge over product card */}
            {inCartQty > 0 && (
              <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white shadow-md ring-2 ring-white">
                <Check className="h-3 w-3 stroke-[3]" />
                <span>{inCartQty} in cart</span>
              </div>
            )}
            {product.featured && inCartQty === 0 && (
              <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white shadow-2xs">
                Featured
              </span>
            )}
            {product.stock <= 0 && (
              <span className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 text-sm font-medium text-white backdrop-blur-2xs">
                Out of Stock
              </span>
            )}

            {/* Quick Fit-to-screen photo preview */}
            {product.image_url && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowImageModal(true);
                }}
                className="absolute left-2 bottom-2 rounded-full bg-white/90 p-1.5 text-gray-600 opacity-0 shadow-xs transition-all group-hover:opacity-100 hover:text-green-700 hover:scale-110"
                aria-label="View photo fit to screen"
                title="View photo fit to screen"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={handleWishlist}
              className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-gray-600 opacity-0 shadow-xs transition-opacity group-hover:opacity-100 hover:text-red-500"
              aria-label="Add to wishlist"
            >
              <Heart className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4">
            <h3 className="line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-green-800 transition-colors">
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
          {product.stock <= 0 ? (
            <Button size="sm" className="w-full opacity-60" disabled>
              Out of Stock
            </Button>
          ) : inCartQty === 0 ? (
            <Button
              size="sm"
              className="w-full"
              onClick={handleAddToCart}
            >
              <Plus className="h-4 w-4" />
              Add to Cart
            </Button>
          ) : (
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-300 p-1 shadow-2xs">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (inCartQty <= 1) {
                    removeItem(product.id);
                    toast.success("Removed from cart");
                  } else {
                    updateQuantity(product.id, inCartQty - 1);
                  }
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-emerald-800 shadow-2xs hover:bg-emerald-100 transition active:scale-90"
                aria-label="Decrease quantity"
              >
                <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
              </button>
              <span className="text-xs font-black text-emerald-950">
                {inCartQty} in cart
              </span>
              <button
                type="button"
                disabled={inCartQty >= product.stock}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (inCartQty >= product.stock) {
                    toast.error(`Only ${product.stock} items available in stock!`);
                    return;
                  }
                  updateQuantity(product.id, inCartQty + 1);
                }}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700 transition active:scale-90",
                  inCartQty >= product.stock && "opacity-40 cursor-not-allowed"
                )}
                aria-label="Increase quantity"
                title={inCartQty >= product.stock ? `Max stock (${product.stock})` : "Add one more"}
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              </button>
            </div>
          )}
        </div>
      </article>

      {/* Fullscreen Fit-To-Screen Image Lightbox */}
      {showImageModal && (
        <ImageModal
          isOpen={showImageModal}
          onClose={() => setShowImageModal(false)}
          src={product.image_url}
          alt={product.name}
          title={product.name}
          subtitle={`${formatPrice(product.price)} · ${product.categories?.name || "General Grocery"}`}
        />
      )}
    </>
  );
}

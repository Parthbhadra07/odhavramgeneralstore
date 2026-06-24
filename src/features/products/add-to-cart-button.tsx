"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import type { Product } from "@/types/database";
import { useCartStore } from "@/store/cart-store";
import { Button } from "@/components/ui/button";

export function AddToCartButton({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((s) => s.addItem);

  const handleAdd = () => {
    if (product.stock <= 0) {
      toast.error("Out of stock");
      return;
    }
    if (quantity > product.stock) {
      toast.error(`Only ${product.stock} available`);
      return;
    }
    addItem(product, quantity);
    toast.success(`Added ${quantity} to cart`);
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center rounded-lg border">
        <button
          type="button"
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          className="p-3 hover:bg-gray-50"
          disabled={product.stock <= 0}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-12 text-center font-medium">{quantity}</span>
        <button
          type="button"
          onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
          className="p-3 hover:bg-gray-50"
          disabled={product.stock <= 0}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <Button
        size="lg"
        onClick={handleAdd}
        disabled={product.stock <= 0}
        className="flex-1 sm:flex-none"
      >
        <ShoppingCart className="h-5 w-5" />
        Add to Cart
      </Button>
    </div>
  );
}

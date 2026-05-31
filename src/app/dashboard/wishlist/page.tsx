"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { wishlistService } from "@/services/wishlist.service";
import { ProductCard } from "@/components/product-card";
import type { WishlistItem } from "@/types/database";

export default function WishlistPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);

  useEffect(() => {
    if (user) wishlistService.getItems(user.id).then(setItems);
  }, [user]);

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-2xl font-bold">My Wishlist</h1>
      {items.length === 0 ? (
        <p className="text-gray-600">Your wishlist is empty.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {items.map(
            (item) =>
              item.products && (
                <ProductCard key={item.id} product={item.products} />
              )
          )}
        </div>
      )}
    </div>
  );
}

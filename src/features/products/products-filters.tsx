"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/types/database";
import type { ProductSort } from "@/types/database";

interface ProductsFiltersProps {
  categories: Category[];
}

export function ProductsFilters({ categories }: ProductsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/products?${params.toString()}`);
  };

  return (
    <div className="space-y-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div>
        <h3 className="mb-3 font-semibold text-gray-900">Category</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="category"
              checked={!searchParams.get("category")}
              onChange={() => update("category", "")}
            />
            All Categories
          </label>
          {categories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="category"
                checked={searchParams.get("category") === cat.id}
                onChange={() => update("category", cat.id)}
              />
              {cat.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-semibold text-gray-900">Price Range (₹)</h3>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            defaultValue={searchParams.get("minPrice") ?? ""}
            onBlur={(e) => update("minPrice", e.target.value)}
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            placeholder="Max"
            defaultValue={searchParams.get("maxPrice") ?? ""}
            onBlur={(e) => update("maxPrice", e.target.value)}
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-semibold text-gray-900">Sort By</h3>
        <select
          value={searchParams.get("sort") ?? "newest"}
          onChange={(e) => update("sort", e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
        >
          <option value="newest">Newest</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="name-asc">Name: A to Z</option>
        </select>
      </div>
    </div>
  );
}

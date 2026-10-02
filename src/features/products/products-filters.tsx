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

  const isFeatured = searchParams.get("featured") === "true";
  const selectedCategory = searchParams.get("category");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const sort = searchParams.get("sort") ?? "newest";
  const search = searchParams.get("search");

  const hasAnyFilter = Boolean(isFeatured || selectedCategory || minPrice || maxPrice || search);

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/products?${params.toString()}`);
  };

  const clearAllFilters = () => {
    router.push("/products");
  };

  return (
    <div className="space-y-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      {hasAnyFilter && (
        <div className="flex items-center justify-between border-b pb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Filters Active
          </span>
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs font-semibold text-green-700 hover:text-green-800 hover:underline"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Deals & Offers Filter */}
      <div>
        <h3 className="mb-2.5 font-semibold text-gray-900 flex items-center justify-between">
          <span>Deals &amp; Offers</span>
          {isFeatured && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              Active
            </span>
          )}
        </h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="dealsFilter"
              checked={!isFeatured}
              onChange={() => update("featured", "")}
              className="text-green-600 focus:ring-green-500"
            />
            All Products
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-amber-900">
            <input
              type="radio"
              name="dealsFilter"
              checked={isFeatured}
              onChange={() => update("featured", "true")}
              className="text-amber-600 focus:ring-amber-500"
            />
            🔥 Deals &amp; Featured Only
          </label>
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-semibold text-gray-900">Category</h3>
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="category"
              checked={!selectedCategory}
              onChange={() => update("category", "")}
              className="text-green-600 focus:ring-green-500"
            />
            All Categories
          </label>
          {categories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="category"
                checked={selectedCategory === cat.id}
                onChange={() => update("category", cat.id)}
                className="text-green-600 focus:ring-green-500"
              />
              <span className="truncate">{cat.name}</span>
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
            defaultValue={minPrice ?? ""}
            onBlur={(e) => update("minPrice", e.target.value)}
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            placeholder="Max"
            defaultValue={maxPrice ?? ""}
            onBlur={(e) => update("maxPrice", e.target.value)}
            className="w-full rounded-lg border px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-semibold text-gray-900">Sort By</h3>
        <select
          value={sort}
          onChange={(e) => update("sort", e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
        >
          <option value="newest">Newest First</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="name-asc">Name: A to Z</option>
        </select>
      </div>

      {hasAnyFilter && (
        <button
          type="button"
          onClick={clearAllFilters}
          className="w-full rounded-lg border border-gray-300 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
        >
          Reset All Filters
        </button>
      )}
    </div>
  );
}

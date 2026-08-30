import type { Product } from "@/types/database";

const CATALOG_KEY = "ogs-catalog-cache";
const CATALOG_TS_KEY = "ogs-catalog-cache-ts";

export function saveProductCatalog(products: Product[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(products));
    localStorage.setItem(CATALOG_TS_KEY, String(Date.now()));
  } catch {
    // quota exceeded — ignore
  }
}

export function loadProductCatalog(): Product[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Product[];
  } catch {
    return null;
  }
}

export function getCatalogCachedAt(): number | null {
  if (typeof window === "undefined") return null;
  const ts = localStorage.getItem(CATALOG_TS_KEY);
  return ts ? Number(ts) : null;
}

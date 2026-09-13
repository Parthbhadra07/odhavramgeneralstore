import type { Product } from "@/types/database";
import type { ErpProduct } from "@/types/erp";
import {
  idbSaveProducts,
  idbGetAllProducts,
  idbFindProductByBarcode,
  idbSearchProducts,
  idbDeleteProduct,
} from "./indexed-db";

const CATALOG_KEY = "ogs-catalog-cache";
const CATALOG_TS_KEY = "ogs-catalog-cache-ts";

export function saveProductCatalog(products: (Product | ErpProduct)[]) {
  if (typeof window === "undefined") return;

  // Save to IndexedDB for large, durable storage
  void idbSaveProducts(products as ErpProduct[]).catch(() => {});

  // Also save in localStorage as lightweight fallback
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(products.slice(0, 300)));
    localStorage.setItem(CATALOG_TS_KEY, String(Date.now()));
  } catch {
    // quota exceeded — IndexedDB will handle the rest
  }
}

export function removeProductFromCatalog(id: string) {
  if (typeof window === "undefined") return;

  void idbDeleteProduct(id).catch(() => {});

  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (raw) {
      const items = JSON.parse(raw) as (Product | ErpProduct)[];
      const filtered = items.filter((p) => p.id !== id);
      localStorage.setItem(CATALOG_KEY, JSON.stringify(filtered));
    }
  } catch {
    // ignore
  }
}

export async function loadProductCatalog(): Promise<(Product | ErpProduct)[] | null> {
  if (typeof window === "undefined") return null;

  try {
    const idbProducts = await idbGetAllProducts();
    if (idbProducts && idbProducts.length > 0) {
      return idbProducts;
    }
  } catch {
    // Fall back to localStorage
  }

  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Product[];
  } catch {
    return null;
  }
}

export async function findProductByBarcodeOffline(
  barcode: string
): Promise<ErpProduct | null> {
  if (typeof window === "undefined" || !barcode.trim()) return null;

  try {
    const found = await idbFindProductByBarcode(barcode);
    if (found) return found;
  } catch {
    // Fallback to localStorage search
  }

  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw) as ErpProduct[];
    const match = list.find(
      (p) =>
        p.barcode?.toLowerCase() === barcode.trim().toLowerCase() ||
        p.sku?.toLowerCase() === barcode.trim().toLowerCase()
    );
    return match ?? null;
  } catch {
    return null;
  }
}

export async function searchProductsOffline(query: string): Promise<ErpProduct[]> {
  const q = query.trim().toLowerCase();
  if (typeof window === "undefined" || !q) return [];

  try {
    const idbResults = await idbSearchProducts(q);
    if (idbResults && idbResults.length > 0) {
      return idbResults;
    }
  } catch {
    // Fall back to localStorage search
  }

  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as ErpProduct[];
    return list
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  } catch {
    return [];
  }
}

export function getCatalogCachedAt(): number | null {
  if (typeof window === "undefined") return null;
  const ts = localStorage.getItem(CATALOG_TS_KEY);
  return ts ? Number(ts) : null;
}

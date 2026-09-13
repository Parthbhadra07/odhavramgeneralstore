/**
 * IndexedDB storage engine for Odhavram General Store
 * Stores offline products catalog, pending offline POS sales, and sync metadata.
 */

import type { ErpProduct, PosCartLine, PosSale, PosSaleStatus } from "@/types/erp";
import type { PosPaymentMethod } from "@/lib/erp/constants";

const DB_NAME = "ogs_offline_db";
const DB_VERSION = 1;

export interface OfflineSaleRecord {
  id: string;
  billNumber: string;
  lines: PosCartLine[];
  paymentMethod: PosPaymentMethod;
  splitPayments?: { method: PosPaymentMethod; amount: number }[];
  customerId?: string;
  customerName?: string;
  customerMobile?: string;
  discount: number;
  loyaltyPointsRedeemed?: number;
  saleStatus: PosSaleStatus;
  notes?: string;
  totalAmount: number;
  subtotal: number;
  createdAt: string;
  synced: boolean;
  syncAttempts: number;
  lastError?: string;
}

let dbInstance: IDBDatabase | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB is only available in browser"));
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store: products (indexed by id, barcode, sku, name)
      if (!db.objectStoreNames.contains("products")) {
        const productStore = db.createObjectStore("products", { keyPath: "id" });
        productStore.createIndex("barcode", "barcode", { unique: false });
        productStore.createIndex("sku", "sku", { unique: false });
        productStore.createIndex("name", "name", { unique: false });
      }

      // Store: offline_sales (indexed by id, createdAt, synced)
      if (!db.objectStoreNames.contains("offline_sales")) {
        const salesStore = db.createObjectStore("offline_sales", { keyPath: "id" });
        salesStore.createIndex("synced", "synced", { unique: false });
        salesStore.createIndex("createdAt", "createdAt", { unique: false });
      }

      // Store: metadata (key-value)
      if (!db.objectStoreNames.contains("metadata")) {
        db.createObjectStore("metadata", { keyPath: "key" });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// -------------------------------------------------------------
// Products Store Operations
// -------------------------------------------------------------

export async function idbSaveProducts(products: ErpProduct[]): Promise<void> {
  if (!products.length) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("products", "readwrite");
    const store = tx.objectStore("products");

    for (const product of products) {
      store.put(product);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGetAllProducts(): Promise<ErpProduct[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("products", "readonly");
    const store = tx.objectStore("products");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as ErpProduct[]);
    request.onerror = () => reject(request.error);
  });
}

export async function idbDeleteProduct(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("products", "readwrite");
    const store = tx.objectStore("products");
    store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbFindProductByBarcode(barcode: string): Promise<ErpProduct | null> {
  const trimmed = barcode.trim();
  if (!trimmed) return null;
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("products", "readonly");
    const store = tx.objectStore("products");
    const index = store.index("barcode");
    const request = index.get(trimmed);

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result as ErpProduct);
      } else {
        // Fallback search across all products (for case-insensitive or partial match)
        const allReq = store.getAll();
        allReq.onsuccess = () => {
          const all = allReq.result as ErpProduct[];
          const match = all.find(
            (p) =>
              p.barcode?.toLowerCase() === trimmed.toLowerCase() ||
              p.sku?.toLowerCase() === trimmed.toLowerCase()
          );
          resolve(match ?? null);
        };
        allReq.onerror = () => reject(allReq.error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function idbSearchProducts(query: string): Promise<ErpProduct[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("products", "readonly");
    const store = tx.objectStore("products");
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result as ErpProduct[];
      const matches = all.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q)
      );
      resolve(matches.slice(0, 20));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function idbUpdateProductStock(productId: string, deltaStock: number): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("products", "readwrite");
    const store = tx.objectStore("products");
    const req = store.get(productId);

    req.onsuccess = () => {
      const product = req.result as ErpProduct | undefined;
      if (product) {
        product.stock = Math.max(0, product.stock + deltaStock);
        store.put(product);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// -------------------------------------------------------------
// Offline Sales Queue Operations
// -------------------------------------------------------------

export async function idbSaveOfflineSale(sale: OfflineSaleRecord): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_sales", "readwrite");
    const store = tx.objectStore("offline_sales");
    const req = store.put(sale);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGetPendingOfflineSales(): Promise<OfflineSaleRecord[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_sales", "readonly");
    const store = tx.objectStore("offline_sales");
    const allReq = store.getAll();

    allReq.onsuccess = () => {
      const all = (allReq.result as OfflineSaleRecord[]) || [];
      const pending = all.filter((s) => !s.synced);
      // Sort oldest first so bills are uploaded in chronological order
      pending.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      resolve(pending);
    };
    allReq.onerror = () => reject(allReq.error);
  });
}

export async function idbMarkSaleSynced(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_sales", "readwrite");
    const store = tx.objectStore("offline_sales");
    const req = store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDeleteOfflineSale(id: string): Promise<void> {
  return idbMarkSaleSynced(id);
}

export async function idbClearAllOfflineSales(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_sales", "readwrite");
    const store = tx.objectStore("offline_sales");
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbRecordSaleSyncError(id: string, errorMessage: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_sales", "readwrite");
    const store = tx.objectStore("offline_sales");
    const req = store.get(id);

    req.onsuccess = () => {
      const sale = req.result as OfflineSaleRecord | undefined;
      if (sale) {
        sale.syncAttempts = (sale.syncAttempts || 0) + 1;
        sale.lastError = errorMessage;
        store.put(sale);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetPendingSalesCount(): Promise<number> {
  try {
    const sales = await idbGetPendingOfflineSales();
    return sales.length;
  } catch {
    return 0;
  }
}

// -------------------------------------------------------------
// Metadata Store Operations (Last sync time, etc.)
// -------------------------------------------------------------

export async function idbSetMeta(key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("metadata", "readwrite");
    const store = tx.objectStore("metadata");
    store.put({ key, value });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGetMeta<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("metadata", "readonly");
    const store = tx.objectStore("metadata");
    const req = store.get(key);

    req.onsuccess = () => {
      resolve(req.result ? (req.result.value as T) : null);
    };
    req.onerror = () => reject(req.error);
  });
}

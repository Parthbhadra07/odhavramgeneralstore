import type { PosCartLine } from "@/types/erp";
import type { PosPaymentMethod } from "@/lib/erp/constants";

const QUEUE_KEY = "ogs-offline-pos-queue";

export interface OfflinePosSale {
  id: string;
  lines: PosCartLine[];
  paymentMethod: PosPaymentMethod;
  customerName?: string;
  customerMobile?: string;
  discount?: number;
  createdAt: string;
}

export function getOfflinePosQueue(): OfflinePosSale[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as OfflinePosSale[];
  } catch {
    return [];
  }
}

export function queueOfflinePosSale(sale: Omit<OfflinePosSale, "id" | "createdAt">): void {
  const queue = getOfflinePosQueue();
  queue.push({
    ...sale,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearOfflinePosQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export function removeOfflinePosSale(id: string): void {
  const queue = getOfflinePosQueue().filter((s) => s.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

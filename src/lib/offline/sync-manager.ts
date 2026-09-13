import {
  idbSaveOfflineSale,
  idbGetPendingOfflineSales,
  idbMarkSaleSynced,
  idbRecordSaleSyncError,
  idbGetPendingSalesCount,
  idbUpdateProductStock,
  idbSetMeta,
  idbGetMeta,
  type OfflineSaleRecord,
} from "./indexed-db";
import type { PosCartLine, PosSale, PosSaleStatus } from "@/types/erp";
import type { PosPaymentMethod } from "@/lib/erp/constants";
import { posService } from "@/services/erp/pos.service";
import { toast } from "sonner";

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
}

let isSyncInProgress = false;
let autoSyncInitialized = false;

function generateOfflineBillNumber(): string {
  const year = new Date().getFullYear();
  return `OFF-${year}-${Date.now().toString().slice(-6)}`;
}

export const syncManager = {
  async queueOfflineSale(params: {
    lines: PosCartLine[];
    paymentMethod: PosPaymentMethod;
    customerId?: string;
    customerName?: string;
    customerMobile?: string;
    discount?: number;
    loyaltyPointsRedeemed?: number;
    saleStatus?: PosSaleStatus;
    notes?: string;
    splitPayments?: { method: PosPaymentMethod; amount: number }[];
  }): Promise<PosSale> {
    const id = `off-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const billNumber = generateOfflineBillNumber();
    const nowIso = new Date().toISOString();

    const grossSubtotal = params.lines.reduce(
      (sum, l) => sum + Number(l.rate) * l.quantity,
      0
    );
    const itemDiscounts = params.lines.reduce((sum, l) => {
      const disc = Number(l.discountPercent || 0);
      const unitDisc = Math.round(Number(l.rate) * (disc / 100) * 100) / 100;
      return sum + unitDisc * l.quantity;
    }, 0);
    const totalDiscount = (params.discount || 0) + itemDiscounts;
    const totalAmount = Math.max(0, grossSubtotal - totalDiscount - (params.loyaltyPointsRedeemed || 0));

    const record: OfflineSaleRecord = {
      id,
      billNumber,
      lines: params.lines,
      paymentMethod: params.paymentMethod,
      splitPayments: params.splitPayments,
      customerId: params.customerId,
      customerName: params.customerName,
      customerMobile: params.customerMobile,
      discount: totalDiscount,
      loyaltyPointsRedeemed: params.loyaltyPointsRedeemed,
      saleStatus: params.saleStatus ?? "completed",
      notes: params.notes,
      totalAmount,
      subtotal: grossSubtotal,
      createdAt: nowIso,
      synced: false,
      syncAttempts: 0,
    };

    // Save to local IndexedDB queue
    await idbSaveOfflineSale(record);

    // Decrement local offline stock so cashier sees accurate remaining units
    for (const line of params.lines) {
      void idbUpdateProductStock(line.productId, -line.quantity).catch(() => {});
    }

    // Notify UI components
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ogs-offline-queue-changed", { detail: { count: await idbGetPendingSalesCount() } })
      );
    }

    // Build PosSale representation for immediate receipt printing
    const posSaleItems = params.lines.map((l) => ({
      id: `${id}-${l.productId}`,
      pos_sale_id: id,
      product_id: l.productId,
      product_name: l.name,
      barcode: l.barcode,
      lot_id: l.lotId ?? null,
      quantity: l.quantity,
      rate: l.rate,
      gst_percentage: l.gstPercentage,
      gst_amount: 0,
      total_amount: l.rate * l.quantity * (1 - (l.discountPercent || 0) / 100),
    }));

    const mockSale: PosSale = {
      id,
      bill_number: billNumber,
      cashier_id: "offline-cashier",
      customer_id: params.customerId ?? null,
      customer_name: params.customerName ?? null,
      customer_mobile: params.customerMobile ?? null,
      subtotal: grossSubtotal,
      cgst: 0,
      sgst: 0,
      igst: 0,
      discount: totalDiscount,
      loyalty_points_redeemed: params.loyaltyPointsRedeemed ?? 0,
      loyalty_discount: params.loyaltyPointsRedeemed ?? 0,
      total_amount: totalAmount,
      payment_method: params.paymentMethod,
      payment_status: params.paymentMethod === "credit" ? "pending" : "paid",
      sale_status: params.saleStatus ?? "completed",
      held_at: null,
      notes: params.notes ? `[OFFLINE] ${params.notes}` : "[OFFLINE BILL]",
      created_at: nowIso,
      pos_sale_items: posSaleItems,
    };

    return mockSale;
  },

  async getPendingCount(): Promise<number> {
    return idbGetPendingSalesCount();
  },

  async syncPendingSales(): Promise<{ successCount: number; failedCount: number }> {
    if (isSyncInProgress) return { successCount: 0, failedCount: 0 };
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { successCount: 0, failedCount: 0 };
    }

    const pending = await idbGetPendingOfflineSales();
    if (!pending.length) return { successCount: 0, failedCount: 0 };

    isSyncInProgress = true;
    let successCount = 0;
    let failedCount = 0;

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ogs-sync-started", { detail: { count: pending.length } }));
    }

    for (const sale of pending) {
      try {
        await posService.createSale({
          lines: sale.lines,
          paymentMethod: sale.paymentMethod,
          customerId: sale.customerId,
          customerName: sale.customerName,
          customerMobile: sale.customerMobile,
          discount: sale.discount,
          loyaltyPointsRedeemed: sale.loyaltyPointsRedeemed,
          notes: sale.notes
            ? `[Synced from ${sale.billNumber}] ${sale.notes}`
            : `[Synced from ${sale.billNumber}]`,
          splitPayments: sale.splitPayments,
        });

        await idbMarkSaleSynced(sale.id);
        successCount++;
      } catch (err) {
        failedCount++;
        const msg = err instanceof Error ? err.message : "Sync error";
        await idbRecordSaleSyncError(sale.id, msg);
      }
    }

    isSyncInProgress = false;
    const nowIso = new Date().toISOString();
    await idbSetMeta("last_synced_at", nowIso);

    if (typeof window !== "undefined") {
      const remaining = await idbGetPendingSalesCount();
      window.dispatchEvent(
        new CustomEvent("ogs-offline-queue-changed", { detail: { count: remaining } })
      );
      window.dispatchEvent(
        new CustomEvent("ogs-sync-completed", {
          detail: { successCount, failedCount, remaining, lastSyncedAt: nowIso },
        })
      );
    }

    if (successCount > 0) {
      toast.success(
        `Cloud sync complete: ${successCount} offline bill${successCount > 1 ? "s" : ""} uploaded!`,
        { id: "pos-sync-toast" }
      );
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} offline bill(s) failed to sync. Will retry automatically.`);
    }

    return { successCount, failedCount };
  },

  async getLastSyncedAt(): Promise<string | null> {
    return idbGetMeta<string>("last_synced_at");
  },

  startAutoSync(): void {
    if (typeof window === "undefined" || autoSyncInitialized) return;
    autoSyncInitialized = true;

    // Listen to browser network online event
    window.addEventListener("online", () => {
      toast.info("Internet connection restored! Syncing offline sales...");
      void this.syncPendingSales();
    });

    window.addEventListener("offline", () => {
      toast.warning("Internet disconnected. POS switched to Offline Mode.");
    });

    // Periodic check every 25 seconds
    setInterval(() => {
      if (navigator.onLine && !isSyncInProgress) {
        void this.syncPendingSales();
      }
    }, 25000);

    // Initial sync check on startup
    if (navigator.onLine) {
      setTimeout(() => void this.syncPendingSales(), 3000);
    }
  },
};

"use client";

import { useEffect, useState, useCallback } from "react";
import { syncManager } from "@/lib/offline/sync-manager";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const refreshState = useCallback(async () => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);
    const count = await syncManager.getPendingCount();
    setPendingCount(count);
    const lastSync = await syncManager.getLastSyncedAt();
    setLastSyncedAt(lastSync);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Start global background sync worker
    syncManager.startAutoSync();

    // Initial check
    void refreshState();

    const handleOnline = () => {
      setIsOnline(true);
      void refreshState();
    };

    const handleOffline = () => {
      setIsOnline(false);
      void refreshState();
    };

    const handleQueueChange = (e: Event) => {
      const custom = e as CustomEvent<{ count: number }>;
      setPendingCount(custom.detail?.count ?? 0);
    };

    const handleSyncStart = () => {
      setIsSyncing(true);
    };

    const handleSyncCompleted = (e: Event) => {
      setIsSyncing(false);
      const custom = e as CustomEvent<{ remaining: number; lastSyncedAt: string }>;
      setPendingCount(custom.detail?.remaining ?? 0);
      setLastSyncedAt(custom.detail?.lastSyncedAt ?? new Date().toISOString());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("ogs-offline-queue-changed", handleQueueChange);
    window.addEventListener("ogs-sync-started", handleSyncStart);
    window.addEventListener("ogs-sync-completed", handleSyncCompleted);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("ogs-offline-queue-changed", handleQueueChange);
      window.removeEventListener("ogs-sync-started", handleSyncStart);
      window.removeEventListener("ogs-sync-completed", handleSyncCompleted);
    };
  }, [refreshState]);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncManager.syncPendingSales();
    } finally {
      setIsSyncing(false);
      void refreshState();
    }
  }, [refreshState]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    syncNow,
    lastSyncedAt,
  };
}

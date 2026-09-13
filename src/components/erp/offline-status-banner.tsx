"use client";

import { Wifi, WifiOff, RefreshCw, HardDrive } from "lucide-react";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { Button } from "@/components/ui/button";

interface OfflineStatusBannerProps {
  compact?: boolean;
}

export function OfflineStatusBanner({ compact = false }: OfflineStatusBannerProps) {
  const { isOnline, pendingCount, isSyncing, syncNow } = useOfflineSync();

  if (isOnline && pendingCount === 0) {
    if (compact) {
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200"
          title="Connected to cloud database"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Online
        </span>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50/80 px-2.5 py-1 text-xs font-medium text-emerald-800 border border-emerald-200">
        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <Wifi className="h-3.5 w-3.5 text-emerald-600" />
        <span>Cloud Online</span>
      </div>
    );
  }

  // When online but has pending offline bills to sync
  if (isOnline && pendingCount > 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900 border border-blue-200 shadow-sm animate-in fade-in">
        <span className="flex h-2 w-2 rounded-full bg-blue-500" />
        <HardDrive className="h-3.5 w-3.5 text-blue-600" />
        <span>
          {pendingCount} offline bill{pendingCount > 1 ? "s" : ""} to sync
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSyncing}
          onClick={() => void syncNow()}
          className="h-6 px-2 text-[11px] font-bold border-blue-300 bg-white hover:bg-blue-100 text-blue-800 gap-1 ml-1"
        >
          <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin text-blue-600" : ""}`} />
          {isSyncing ? "Syncing..." : "Sync Now"}
        </Button>
      </div>
    );
  }

  // When completely offline
  return (
    <div className="inline-flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-900 border border-amber-300 shadow-sm animate-in fade-in">
      <WifiOff className="h-3.5 w-3.5 text-amber-600 animate-bounce" />
      <span>Offline Mode</span>
      <span className="rounded bg-amber-200/80 px-1.5 py-0.2 text-[10px] text-amber-950 font-bold">
        {pendingCount} queued
      </span>
      <span className="hidden md:inline text-[11px] font-normal text-amber-800">
        (Billing works offline, auto-syncs when online)
      </span>
    </div>
  );
}

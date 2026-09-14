"use client";

import { useEffect, useState } from "react";
import { WifiOff, ShoppingBag, RefreshCw, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadProductCatalog } from "@/lib/offline/product-cache";
import { isErpStaff } from "@/utils/roles";
import type { User } from "@/types/database";

export default function OfflinePage() {
  const [hasProductCache, setHasProductCache] = useState(false);
  const [hasStaffCache, setHasStaffCache] = useState(false);

  useEffect(() => {
    loadProductCatalog().then((items) => {
      if (items && items.length > 0) {
        setHasProductCache(true);
      }
    });

    try {
      const cached = localStorage.getItem("ogs-offline-auth-profile");
      if (cached) {
        const p = JSON.parse(cached) as User;
        if (p && isErpStaff(p.role)) {
          setHasStaffCache(true);
        }
      }
    } catch {}
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <WifiOff className="mb-4 h-16 w-16 text-gray-400" />
      <h1 className="text-2xl font-bold text-gray-900">You&apos;re Offline</h1>
      <p className="mt-2 max-w-sm text-gray-600">
        {hasProductCache
          ? "You can still browse products saved from your last visit."
          : "Please check your internet connection and try reconnecting."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {hasProductCache && (
          <Button href="/products" className="gap-2 bg-green-600 hover:bg-green-700">
            <ShoppingBag className="h-4 w-4" />
            Browse Saved Products
          </Button>
        )}
        {hasStaffCache && (
          <Button variant="outline" href="/admin/pos" className="gap-2 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100">
            <Monitor className="h-4 w-4" />
            Staff POS Billing (Offline)
          </Button>
        )}
        <Button variant="outline" type="button" onClick={() => window.location.reload()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry Connection
        </Button>
      </div>
    </div>
  );
}

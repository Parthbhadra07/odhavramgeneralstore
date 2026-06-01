"use client";

import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadProductCatalog } from "@/lib/offline/product-cache";

export default function OfflinePage() {
  const hasCache = typeof window !== "undefined" && loadProductCatalog()?.length;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <WifiOff className="mb-4 h-16 w-16 text-gray-400" />
      <h1 className="text-2xl font-bold">You&apos;re Offline</h1>
      <p className="mt-2 max-w-sm text-gray-600">
        {hasCache
          ? "You can still browse products saved from your last visit."
          : "Please check your internet connection and try again."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {hasCache && (
          <Button href="/products">Browse cached products</Button>
        )}
        <Button variant="outline" type="button" onClick={() => window.location.reload()}>
          Retry connection
        </Button>
      </div>
    </div>
  );
}

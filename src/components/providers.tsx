"use client";

import { Toaster } from "sonner";
import { useCartSync } from "@/hooks/use-cart-sync";
import { CapacitorMobileProvider } from "@/components/mobile/capacitor-mobile-provider";

function CartSyncProvider({ children }: { children: React.ReactNode }) {
  useCartSync();
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartSyncProvider>
      <CapacitorMobileProvider>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </CapacitorMobileProvider>
    </CartSyncProvider>
  );
}

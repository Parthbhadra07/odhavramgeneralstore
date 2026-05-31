"use client";

import { Toaster } from "sonner";
import { useCartSync } from "@/hooks/use-cart-sync";

function CartSyncProvider({ children }: { children: React.ReactNode }) {
  useCartSync();
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartSyncProvider>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </CartSyncProvider>
  );
}

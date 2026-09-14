"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { isErpStaff } from "@/utils/roles";
import { Store, ShieldAlert, Loader2 } from "lucide-react";
import type { User } from "@/types/database";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, isStaff } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [isOfflineAllowed, setIsOfflineAllowed] = useState(false);
  const [offlineChecked, setOfflineChecked] = useState(false);

  useEffect(() => {
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    if (isOffline && pathname.startsWith("/admin/pos")) {
      try {
        const cached = localStorage.getItem("ogs-offline-auth-profile");
        if (cached) {
          const p = JSON.parse(cached) as User;
          if (p && isErpStaff(p.role)) {
            setIsOfflineAllowed(true);
            setOfflineChecked(true);
            return;
          }
        }
      } catch {}

      // Offline without staff session -> Cannot access POS!
      setIsOfflineAllowed(false);
      setOfflineChecked(true);
      startTransition(() => {
        router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
      });
      return;
    }

    setOfflineChecked(true);
  }, [pathname, router]);

  useEffect(() => {
    if (!offlineChecked || loading) return;

    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    if (isOffline && isOfflineAllowed) return;

    if (!user) {
      startTransition(() => {
        router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
      });
      return;
    }

    // If user is authenticated as customer, they are not allowed in admin routes
    if (profile && !isStaff) {
      startTransition(() => {
        router.replace("/");
      });
    }
  }, [user, profile, loading, isStaff, offlineChecked, isOfflineAllowed, pathname, router]);

  // Loading state while verifying auth & permissions
  if (!offlineChecked || loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-600 text-white shadow-md">
            <Store className="h-6 w-6" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-green-600" />
          <p className="text-sm font-medium text-gray-600">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  if (isOffline && !isOfflineAllowed && pathname.startsWith("/admin/pos")) {
    return null;
  }

  if (!user && !isOfflineAllowed) {
    return null;
  }

  // Denied screen for customer role trying to access admin
  if (user && profile && !isStaff) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border bg-white p-6 text-center shadow-lg">
          <ShieldAlert className="mx-auto mb-3 h-12 w-12 text-red-500" />
          <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-sm text-gray-600">
            You do not have staff or administrator privileges to view this section.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
          >
            Return to Store
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

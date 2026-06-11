"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminOrderNotificationsProvider } from "@/components/admin/admin-order-notifications-provider";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/utils/cn";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <AdminOrderNotificationsProvider>
<div className="flex w-full min-w-0 max-w-[100vw] overflow-x-hidden bg-gray-50">        {/* Mobile backdrop */}
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden",
            sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          aria-hidden={!sidebarOpen}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar drawer */}
        <AdminSidebar
          className={cn(
            "fixed left-0 top-16 z-50 flex h-[calc(100dvh-4rem)] w-[min(100vw-2rem,16rem)] flex-col transition-transform duration-300 ease-in-out lg:static lg:z-auto lg:h-auto lg:w-64 lg:translate-x-0 lg:shrink-0",
            sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
          )}
          onNavigate={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Sticky mobile admin header */}
          <header className="sticky top-16 z-30 flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-sm lg:hidden">            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100"              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <span className="truncate text-sm font-semibold text-green-800">              Admin — {APP_NAME}
            </span>
          </header>

          <main className="min-w-0 flex-1 overflow-x-hidden p-4 pb-28 sm:p-6 lg:pb-6">
            {children}
          </main>
        </div>
      </div>
    </AdminOrderNotificationsProvider>
  );
}

"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Store } from "lucide-react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminPrinterSettings } from "@/components/admin/admin-printer-settings";
import { DesktopInstallPrompt } from "@/components/admin/desktop-install-prompt";
import { FinancialYearSwitcher } from "@/components/admin/financial-year-switcher";
import { OfflineStatusBanner } from "@/components/erp/offline-status-banner";
import { AdminOrderNotificationsProvider } from "@/components/admin/admin-order-notifications-provider";
import { useDailyAutoRefill } from "@/hooks/use-daily-auto-refill";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/utils/cn";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Run automated daily refills for milk, bread, and essentials
  useDailyAutoRefill();

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
      <div className="flex w-full min-w-0 max-w-[100vw] overflow-x-hidden bg-gray-50">
        {/* Mobile backdrop */}
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden",
            sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          aria-hidden={!sidebarOpen}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar drawer — full height on mobile */}
        <AdminSidebar
          className={cn(
            "fixed left-0 top-0 z-50 flex h-dvh w-[min(100vw-2rem,16rem)] flex-col transition-transform duration-300 ease-in-out lg:static lg:z-auto lg:h-auto lg:w-64 lg:translate-x-0 lg:shrink-0",
            sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
          )}
          onNavigate={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Desktop admin header bar */}
          <header className="hidden lg:flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
            <div className="flex items-center gap-3">
              <OfflineStatusBanner compact />
            </div>
            <div className="flex items-center gap-3">
              <FinancialYearSwitcher />
              <DesktopInstallPrompt />
              <AdminPrinterSettings />
            </div>
          </header>

          {/* Mobile admin header — fixed at very top, left-aligned */}
          <header className="fixed inset-x-0 top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 shadow-sm lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="shrink-0 rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100"
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white">
                <Store className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight text-green-800">
                  Admin
                </p>
                <p className="truncate text-xs leading-tight text-gray-500">{APP_NAME}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <FinancialYearSwitcher compact />
              <OfflineStatusBanner compact />
              <DesktopInstallPrompt />
              <AdminPrinterSettings />
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-x-hidden p-4 pt-[4.5rem] pb-28 sm:p-6 sm:pt-[4.5rem] lg:p-6 lg:pb-6">
            {children}
          </main>
        </div>
      </div>
    </AdminOrderNotificationsProvider>
  );
}

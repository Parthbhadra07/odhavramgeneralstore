"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  BarChart3,
  Store,
  LogOut,
  Volume2,
  VolumeX,
  Monitor,
  Warehouse,
  Truck,
  Building2,
  UserCircle,
  Receipt,
  Wallet,
  Banknote,
  Settings,
  RotateCcw,
  Undo2,
  Wallet2,
  BookOpen,
  FileStack,
  CalendarClock,
  History,
  SlidersHorizontal,
  Archive,
  Bell,
  TrendingDown,
  Sparkles,
  Database,
  Printer,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/utils/cn";
import { authService } from "@/services/auth.service";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAdminOrderNotifications } from "@/hooks/use-admin-order-notifications";
import {
  playNewOrderSound,
  unlockNotificationAudio,
} from "@/utils/notification-sound";

const navGroups = [
  {
    label: "Overview",
    links: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/profit-loss", label: "Profit & Loss", icon: TrendingDown },
    ],
  },
  {
    label: "Sales",
    links: [
      { href: "/admin/pos", label: "POS Billing", icon: Monitor },
      { href: "/admin/sales-history", label: "Sales History", icon: FileStack },
      { href: "/admin/orders", label: "Online Orders", icon: ShoppingCart },
      { href: "/admin/sales-returns", label: "Sales Returns", icon: RotateCcw },
      { href: "/admin/refunds", label: "Refunds", icon: Wallet2 },
      { href: "/admin/cash-closing", label: "Cash Closing", icon: Banknote },
    ],
  },
  {
    label: "Inventory",
    links: [
      { href: "/admin/inventory", label: "Inventory", icon: Warehouse },
      { href: "/admin/stock-history", label: "Stock History", icon: History },
      { href: "/admin/stock-adjustment", label: "Stock Adjustment", icon: SlidersHorizontal },
      { href: "/admin/dead-stock", label: "Dead Stock", icon: Archive },
      { href: "/admin/barcode-labels", label: "Barcode Labels", icon: Printer },
      { href: "/admin/expiry", label: "Expiry", icon: CalendarClock },
      { href: "/admin/reorder", label: "Reorder AI", icon: Sparkles },
    ],
  },
  {
    label: "Purchasing",
    links: [
      { href: "/admin/purchases", label: "Purchases", icon: Truck },
      { href: "/admin/purchase-returns", label: "Purchase Returns", icon: Undo2 },
      { href: "/admin/suppliers", label: "Suppliers", icon: Building2 },
    ],
  },
  {
    label: "Catalog",
    links: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/categories", label: "Categories", icon: FolderTree },
    ],
  },
  {
    label: "People & Finance",
    links: [
      { href: "/admin/customers", label: "Customers", icon: UserCircle },
      { href: "/admin/credit", label: "Credit (Khatabook)", icon: BookOpen },
      { href: "/admin/expenses", label: "Expenses", icon: Receipt },
      { href: "/admin/users", label: "Users & Roles", icon: Wallet },
    ],
  },
  {
    label: "System",
    links: [
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/backup", label: "Backup", icon: Database },
    ],
  },
];

interface AdminSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function AdminSidebar({ className, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { soundEnabled, setSoundEnabled, newOrderCount } = useAdminOrderNotifications();

  const handleLogout = async () => {
    onNavigate?.();
    await authService.signOut();
    toast.success("Logged out");
    router.push("/auth/login");
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-gray-200 bg-white shadow-lg lg:shadow-none",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white">
          <Store className="h-4 w-4" />
        </div>
        <span className="text-sm font-bold leading-tight text-green-800">{APP_NAME}</span>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.links.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                const showBadge = href === "/admin/orders" && newOrderCount > 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-green-50 text-green-800"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{label}</span>
                    {showBadge && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                        {newOrderCount > 99 ? "99+" : newOrderCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t p-3">
        <button
          type="button"
          onClick={() => {
            const next = !soundEnabled;
            setSoundEnabled(next);
            if (next) {
              unlockNotificationAudio();
              playNewOrderSound();
              toast.success("Order alert sound on");
            } else {
              toast.message("Order alert sound off");
            }
          }}
          className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          {soundEnabled ? (
            <Volume2 className="h-4 w-4 text-green-600" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
          {soundEnabled ? "Order sound on" : "Order sound off"}
        </button>
        <Link
          href="/"
          onClick={onNavigate}
          className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          ← Back to Store
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}

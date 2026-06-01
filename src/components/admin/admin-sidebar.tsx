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
  Monitor,
  Warehouse,
  Truck,
  Building2,
  UserCircle,
  Receipt,
  Wallet,
  Banknote,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/utils/cn";
import { authService } from "@/services/auth.service";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/pos", label: "POS Billing", icon: Monitor },
  { href: "/admin/orders", label: "Online Orders", icon: ShoppingCart },
  { href: "/admin/inventory", label: "Inventory", icon: Warehouse },
  { href: "/admin/purchases", label: "Purchases", icon: Truck },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/suppliers", label: "Suppliers", icon: Building2 },
  { href: "/admin/customers", label: "Customers", icon: UserCircle },
  { href: "/admin/expenses", label: "Expenses", icon: Receipt },
  { href: "/admin/cash-closing", label: "Cash Closing", icon: Banknote },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/users", label: "Users", icon: Wallet },
];

interface AdminSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function AdminSidebar({ className, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

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
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-green-50 text-green-800"
                : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t p-3">
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

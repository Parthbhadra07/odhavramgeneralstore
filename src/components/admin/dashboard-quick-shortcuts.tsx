"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Monitor,
  Truck,
  BarChart3,
  TrendingDown,
  FileStack,
  BookOpen,
  Warehouse,
  Receipt,
  Banknote,
  ShoppingCart,
  ScanBarcode,
  Printer,
  CalendarClock,
  Sparkles,
  Command,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

interface DashboardQuickShortcutsProps {
  newOrderCount?: number;
}

interface ShortcutItem {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  icon: typeof Monitor;
  hotkey: string;
  secondaryHotkey?: string;
  category: "sales" | "purchases" | "accounts" | "inventory";
  colorClass: string;
  badge?: string | number;
  badgeColor?: string;
  primary?: boolean;
}

const SHORTCUTS: ShortcutItem[] = [
  {
    id: "sales-bill",
    href: "/admin/pos",
    title: "Sales Bill (POS)",
    subtitle: "Fast billing, barcode scan & thermal print",
    icon: Monitor,
    hotkey: "Alt+S",
    secondaryHotkey: "F1",
    category: "sales",
    colorClass: "from-emerald-600 to-green-600 text-white shadow-emerald-200",
    primary: true,
  },
  {
    id: "purchase-bill",
    href: "/admin/purchases",
    title: "Purchase Bill",
    subtitle: "Inward stock entry, supplier invoices & GST",
    icon: Truck,
    hotkey: "Alt+P",
    secondaryHotkey: "F2",
    category: "purchases",
    colorClass: "from-indigo-600 to-blue-600 text-white shadow-indigo-200",
    primary: true,
  },
  {
    id: "reports",
    href: "/admin/reports",
    title: "Reports & GST",
    subtitle: "Executive analytics, sales trend & GSTR summaries",
    icon: BarChart3,
    hotkey: "Alt+R",
    category: "accounts",
    colorClass: "from-sky-600 to-cyan-600 text-white shadow-sky-200",
    primary: true,
  },
  {
    id: "profit-loss",
    href: "/admin/profit-loss",
    title: "Profit & Loss",
    subtitle: "Trading account, gross & net profit accounting",
    icon: TrendingDown,
    hotkey: "Alt+L",
    category: "accounts",
    colorClass: "from-teal-600 to-emerald-700 text-white shadow-teal-200",
    primary: true,
  },
  {
    id: "sales-history",
    href: "/admin/sales-history",
    title: "Sales History",
    subtitle: "Search past invoices, reprint & share WhatsApp",
    icon: FileStack,
    hotkey: "Alt+H",
    category: "sales",
    colorClass: "from-cyan-700 to-blue-700 text-white shadow-cyan-200",
  },
  {
    id: "credit-khata",
    href: "/admin/credit",
    title: "Customer Khata",
    subtitle: "Udhar ledger, customer balances & recovery",
    icon: BookOpen,
    hotkey: "Alt+K",
    category: "accounts",
    colorClass: "from-rose-600 to-pink-600 text-white shadow-rose-200",
  },
  {
    id: "inventory",
    href: "/admin/inventory",
    title: "Inventory & Stock",
    subtitle: "Live inventory, low stock alert & price lookup",
    icon: Warehouse,
    hotkey: "Alt+I",
    category: "inventory",
    colorClass: "from-slate-700 to-gray-800 text-white shadow-slate-200",
  },
  {
    id: "expenses",
    href: "/admin/expenses",
    title: "Daily Expenses",
    subtitle: "Shop rent, electricity, packaging & petty cash",
    icon: Receipt,
    hotkey: "Alt+E",
    category: "accounts",
    colorClass: "from-amber-600 to-orange-600 text-white shadow-amber-200",
  },
  {
    id: "cash-closing",
    href: "/admin/cash-closing",
    title: "Cash Closing",
    subtitle: "Day-end register closing & cash drawer audit",
    icon: Banknote,
    hotkey: "Alt+C",
    category: "sales",
    colorClass: "from-emerald-700 to-teal-800 text-white shadow-emerald-200",
  },
  {
    id: "online-orders",
    href: "/admin/orders",
    title: "Online Orders",
    subtitle: "Web store orders, delivery & dispatch status",
    icon: ShoppingCart,
    hotkey: "Alt+O",
    category: "sales",
    colorClass: "from-blue-600 to-indigo-700 text-white shadow-blue-200",
  },
  {
    id: "quick-stock",
    href: "/admin/inventory/quick-stock",
    title: "Quick Stock Inward",
    subtitle: "1-Click barcode scanner for incoming cartons",
    icon: ScanBarcode,
    hotkey: "Alt+Q",
    category: "inventory",
    colorClass: "from-fuchsia-600 to-purple-700 text-white shadow-fuchsia-200",
  },
  {
    id: "barcode-labels",
    href: "/admin/barcode-labels",
    title: "Barcode Printing",
    subtitle: "Print custom product price stickers & labels",
    icon: Printer,
    hotkey: "Alt+B",
    category: "inventory",
    colorClass: "from-violet-600 to-purple-600 text-white shadow-violet-200",
  },
  {
    id: "expiry",
    href: "/admin/expiry",
    title: "Expiry Tracker",
    subtitle: "Batch expiry warnings & near-expiry clearance",
    icon: CalendarClock,
    hotkey: "Alt+X",
    category: "inventory",
    colorClass: "from-red-600 to-rose-700 text-white shadow-red-200",
  },
  {
    id: "reorder",
    href: "/admin/reorder",
    title: "AI Auto Reorder",
    subtitle: "Smart purchasing recommendations for low stock",
    icon: Sparkles,
    hotkey: "Alt+A",
    category: "purchases",
    colorClass: "from-amber-700 to-yellow-600 text-white shadow-amber-200",
  },
];

export function DashboardQuickShortcuts({ newOrderCount = 0 }: DashboardQuickShortcutsProps) {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Global Keyboard shortcuts listener on the dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input or textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const alt = e.altKey;
      const key = e.key.toLowerCase();

      if (e.key === "F1") {
        e.preventDefault();
        toast.info("Opening Sales Bill (POS)...");
        router.push("/admin/pos");
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        toast.info("Opening Purchase Bill...");
        router.push("/admin/purchases");
        return;
      }

      if (alt) {
        if (key === "s") {
          e.preventDefault();
          toast.info("Opening Sales Bill (POS)...");
          router.push("/admin/pos");
          return;
        }
        if (key === "p") {
          e.preventDefault();
          toast.info("Opening Purchase Bill...");
          router.push("/admin/purchases");
          return;
        }
        if (key === "r") {
          e.preventDefault();
          toast.info("Opening ERP Reports...");
          router.push("/admin/reports");
          return;
        }
        if (key === "l") {
          e.preventDefault();
          toast.info("Opening Profit & Loss Statement...");
          router.push("/admin/profit-loss");
          return;
        }
        if (key === "h") {
          e.preventDefault();
          toast.info("Opening Sales History...");
          router.push("/admin/sales-history");
          return;
        }
        if (key === "k") {
          e.preventDefault();
          toast.info("Opening Customer Khata...");
          router.push("/admin/credit");
          return;
        }
        if (key === "i") {
          e.preventDefault();
          toast.info("Opening Inventory & Stock...");
          router.push("/admin/inventory");
          return;
        }
        if (key === "e") {
          e.preventDefault();
          toast.info("Opening Daily Expenses...");
          router.push("/admin/expenses");
          return;
        }
        if (key === "c") {
          e.preventDefault();
          toast.info("Opening Cash Closing...");
          router.push("/admin/cash-closing");
          return;
        }
        if (key === "o") {
          e.preventDefault();
          toast.info("Opening Online Orders...");
          router.push("/admin/orders");
          return;
        }
        if (key === "q") {
          e.preventDefault();
          toast.info("Opening Quick Stock Inward...");
          router.push("/admin/inventory/quick-stock");
          return;
        }
        if (key === "b") {
          e.preventDefault();
          toast.info("Opening Barcode Labels...");
          router.push("/admin/barcode-labels");
          return;
        }
        if (key === "x") {
          e.preventDefault();
          toast.info("Opening Expiry Tracker...");
          router.push("/admin/expiry");
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const filteredShortcuts = SHORTCUTS.filter((item) => {
    if (selectedFilter === "all") return true;
    return item.category === selectedFilter;
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs transition-all">
      {/* Header with Title, Category Filter & Collapse Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 text-white shadow-xs">
            <Command className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Operations Command Center</span>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800 uppercase tracking-wide">
                Direct Tab Shortcuts
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              One-click instant access or press key combinations from anywhere on dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 max-w-full">
          {/* Category Tabs with horizontal touch scroll */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs overflow-x-auto scrollbar-none max-w-[calc(100vw-5rem)] sm:max-w-none whitespace-nowrap">
            {[
              { id: "all", label: "All Tabs" },
              { id: "sales", label: "Sales & POS" },
              { id: "purchases", label: "Purchases" },
              { id: "accounts", label: "Reports & Khata" },
              { id: "inventory", label: "Stock & Barcode" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedFilter(cat.id)}
                className={`rounded-lg px-2 sm:px-2.5 py-1 font-medium transition-all shrink-0 ${
                  selectedFilter === cat.id
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 transition shrink-0"
            title={isExpanded ? "Collapse Shortcuts" : "Expand Shortcuts"}
            aria-label="Toggle shortcut visibility"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main Grid of Shortcuts */}
      {isExpanded && (
        <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-7">
          {filteredShortcuts.map((item) => {
            const Icon = item.icon;
            const hasOrderBadge = item.id === "online-orders" && newOrderCount > 0;

            return (
              <Link
                key={item.id}
                href={item.href}
                className="group relative flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3.5 shadow-2xs transition-all hover:-translate-y-0.5 hover:border-green-500 hover:shadow-md"
              >
                {/* Top Row: Icon + Hotkey Badge */}
                <div className="flex items-start justify-between gap-1.5">
                  <div
                    className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br ${item.colorClass} shadow-xs transition-transform group-hover:scale-105`}
                  >
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>

                  <div className="flex flex-col items-end gap-0.5 sm:gap-1">
                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1 sm:px-1.5 py-0.5 font-mono text-[9px] sm:text-[10px] font-semibold text-slate-700 shadow-2xs group-hover:border-green-400 group-hover:bg-green-50 group-hover:text-green-800">
                      {item.hotkey}
                    </span>
                    {item.secondaryHotkey && (
                      <span className="hidden sm:inline-flex items-center rounded border border-slate-200 bg-white px-1 py-0.2 font-mono text-[9px] text-slate-500">
                        {item.secondaryHotkey}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Title + Description */}
                <div className="mt-2 sm:mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-green-700 transition-colors truncate">
                      {item.title}
                    </span>
                    {hasOrderBadge && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white animate-pulse">
                        {newOrderCount}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] sm:text-[11px] leading-snug text-slate-500 line-clamp-1 group-hover:text-slate-600">
                    {item.subtitle}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Keyboard Shortcut Banner Bar (Desktop only) */}
      <div className="mt-3 hidden md:flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 border border-slate-200/80">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-slate-800">⚡ Press key combination to navigate:</span>
          <span><kbd className="rounded border bg-white px-1 py-0.5 font-mono text-[11px] shadow-2xs font-semibold">F1</kbd> or <kbd className="rounded border bg-white px-1 py-0.5 font-mono text-[11px] shadow-2xs font-semibold">Alt+S</kbd> Sales Bill</span>
          <span><kbd className="rounded border bg-white px-1 py-0.5 font-mono text-[11px] shadow-2xs font-semibold">F2</kbd> or <kbd className="rounded border bg-white px-1 py-0.5 font-mono text-[11px] shadow-2xs font-semibold">Alt+P</kbd> Purchase Bill</span>
          <span><kbd className="rounded border bg-white px-1 py-0.5 font-mono text-[11px] shadow-2xs font-semibold">Alt+R</kbd> Reports</span>
          <span><kbd className="rounded border bg-white px-1 py-0.5 font-mono text-[11px] shadow-2xs font-semibold">Alt+L</kbd> Profit &amp; Loss</span>
          <span><kbd className="rounded border bg-white px-1 py-0.5 font-mono text-[11px] shadow-2xs font-semibold">Alt+K</kbd> Khata</span>
          <span><kbd className="rounded border bg-white px-1 py-0.5 font-mono text-[11px] shadow-2xs font-semibold">Alt+I</kbd> Inventory</span>
          <span><kbd className="rounded border bg-white px-1 py-0.5 font-mono text-[11px] shadow-2xs font-semibold">Alt+H</kbd> History</span>
          <span><kbd className="rounded border bg-white px-1 py-0.5 font-mono text-[11px] shadow-2xs font-semibold">Alt+E</kbd> Expenses</span>
          <span><kbd className="rounded border bg-white px-1 py-0.5 font-mono text-[11px] shadow-2xs font-semibold">Alt+C</kbd> Cash Closing</span>
        </div>
        <span className="text-[11px] text-slate-400 font-medium hidden lg:inline">
          Odhavram Store POS v0.2.0
        </span>
      </div>
    </div>
  );
}

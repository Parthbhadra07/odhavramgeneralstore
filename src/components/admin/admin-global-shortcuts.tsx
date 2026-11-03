"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Keyboard,
  X,
  Monitor,
  FileSpreadsheet,
  Truck,
  FileStack,
  RotateCcw,
  BookOpen,
  Warehouse,
  BarChart3,
  TrendingDown,
  LayoutDashboard,
  Receipt,
  Banknote,
  ShoppingCart,
  Printer,
  Package,
  ScanBarcode,
  Undo2,
  CalendarClock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils/cn";

export interface ShortcutDefinition {
  key: string;
  label: string;
  route: string;
  category: "Billing & Sales" | "Purchases & Stock" | "Accounts & Reports" | "General";
  icon: typeof Monitor;
  description: string;
}

export const ERP_SHORTCUTS: ShortcutDefinition[] = [
  {
    key: "Alt + 1",
    label: "POS Sales Bill",
    route: "/admin/pos",
    category: "Billing & Sales",
    icon: Monitor,
    description: "Fast retail billing, barcode scanner & thermal invoice",
  },
  {
    key: "Alt + 2",
    label: "Agency Billing",
    route: "/admin/agency-billing",
    category: "Billing & Sales",
    icon: FileSpreadsheet,
    description: "Wholesale agency billing & GST invoice printing",
  },
  {
    key: "Alt + 3",
    label: "Purchase Inward",
    route: "/admin/purchases",
    category: "Purchases & Stock",
    icon: Truck,
    description: "Vendor purchases, inward stock & supplier GST bills",
  },
  {
    key: "Alt + 4",
    label: "Sales History",
    route: "/admin/sales-history",
    category: "Billing & Sales",
    icon: FileStack,
    description: "Search past bills, reprint invoices & WhatsApp receipts",
  },
  {
    key: "Alt + 5",
    label: "Sales Returns",
    route: "/admin/sales-returns",
    category: "Billing & Sales",
    icon: RotateCcw,
    description: "Customer returns, refunds & credit note adjustment",
  },
  {
    key: "Alt + 6",
    label: "Customer Khata",
    route: "/admin/credit",
    category: "Accounts & Reports",
    icon: BookOpen,
    description: "Udhar ledger, party outstanding & recovery",
  },
  {
    key: "Alt + 7",
    label: "Inventory & Stock",
    route: "/admin/inventory",
    category: "Purchases & Stock",
    icon: Warehouse,
    description: "Stock levels, low-stock alerts & MRP editing",
  },
  {
    key: "Alt + 8",
    label: "Reports & GST",
    route: "/admin/reports",
    category: "Accounts & Reports",
    icon: BarChart3,
    description: "Executive sales reports & GSTR tax analytics",
  },
  {
    key: "Alt + 9",
    label: "Profit & Loss",
    route: "/admin/profit-loss",
    category: "Accounts & Reports",
    icon: TrendingDown,
    description: "Trading account, gross profit & net profit margins",
  },
  {
    key: "Alt + 0",
    label: "Dashboard",
    route: "/admin",
    category: "General",
    icon: LayoutDashboard,
    description: "Store analytics & summary overview",
  },
  {
    key: "Alt + E",
    label: "Daily Expenses",
    route: "/admin/expenses",
    category: "Accounts & Reports",
    icon: Receipt,
    description: "Petty cash, rent, electricity & shop overheads",
  },
  {
    key: "Alt + C",
    label: "Cash Closing",
    route: "/admin/cash-closing",
    category: "Billing & Sales",
    icon: Banknote,
    description: "Day-end cash drawer reconciliation & register closing",
  },
  {
    key: "Alt + O",
    label: "Online Orders",
    route: "/admin/orders",
    category: "Billing & Sales",
    icon: ShoppingCart,
    description: "Online web orders, packing & dispatch",
  },
  {
    key: "Alt + B",
    label: "Barcode Labels",
    route: "/admin/barcode-labels",
    category: "Purchases & Stock",
    icon: Printer,
    description: "Print barcode price stickers for products & shelves",
  },
  {
    key: "Alt + M",
    label: "Products Catalog",
    route: "/admin/products",
    category: "Purchases & Stock",
    icon: Package,
    description: "Product master, pricing & barcode directory",
  },
  {
    key: "Alt + Q",
    label: "Quick Stock Inward",
    route: "/admin/inventory/quick-stock",
    category: "Purchases & Stock",
    icon: ScanBarcode,
    description: "1-Click barcode scanner for fast carton stock inward",
  },
  {
    key: "Alt + J",
    label: "Purchase Returns",
    route: "/admin/purchase-returns",
    category: "Purchases & Stock",
    icon: Undo2,
    description: "Return damaged goods to suppliers with debit notes",
  },
  {
    key: "Alt + X",
    label: "Expiry Tracker",
    route: "/admin/expiry",
    category: "Purchases & Stock",
    icon: CalendarClock,
    description: "Expiring stock warnings & batch clearance",
  },
];

export function AdminGlobalShortcuts() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is pressing Ctrl or Meta (Command key on Mac)
      if (e.ctrlKey || e.metaKey) return;

      const tag = (e.target as HTMLElement)?.tagName;
      const isContentEditable = (e.target as HTMLElement)?.isContentEditable;
      const isTyping =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || isContentEditable;

      const key = e.key.toLowerCase();
      const isAlt = e.altKey;

      // Function keys work everywhere
      if (e.key === "F1") {
        e.preventDefault();
        toast.info("Opening POS Billing (F1 / Alt+1)...");
        router.push("/admin/pos");
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        toast.info("Opening Purchases (F2 / Alt+3)...");
        router.push("/admin/purchases");
        return;
      }

      // Help Modal shortcut: Alt + / or Alt + ?
      if (isAlt && (e.key === "/" || e.key === "?")) {
        e.preventDefault();
        setShowModal((prev) => !prev);
        return;
      }

      // Pressing Escape closes the shortcuts modal
      if (e.key === "Escape" && showModal) {
        setShowModal(false);
        return;
      }

      // Alt + Key combinations
      if (isAlt) {
        // Numbered shortcuts Alt+1 through Alt+0 (Primary request)
        if (key === "1" || key === "s") {
          e.preventDefault();
          toast.info("Opening POS Billing (Alt+1)...");
          router.push("/admin/pos");
          return;
        }
        if (key === "2" || key === "a") {
          e.preventDefault();
          toast.info("Opening Agency Wholesale Billing (Alt+2)...");
          router.push("/admin/agency-billing");
          return;
        }
        if (key === "3" || key === "p") {
          e.preventDefault();
          toast.info("Opening Purchases (Alt+3)...");
          router.push("/admin/purchases");
          return;
        }
        if (key === "4" || key === "h") {
          e.preventDefault();
          toast.info("Opening Sales History (Alt+4)...");
          router.push("/admin/sales-history");
          return;
        }
        if (key === "5" || key === "u") {
          e.preventDefault();
          toast.info("Opening Sales Returns (Alt+5)...");
          router.push("/admin/sales-returns");
          return;
        }
        if (key === "6" || key === "k") {
          e.preventDefault();
          toast.info("Opening Customer Khata (Alt+6)...");
          router.push("/admin/credit");
          return;
        }
        if (key === "7" || key === "i") {
          e.preventDefault();
          toast.info("Opening Inventory & Stock (Alt+7)...");
          router.push("/admin/inventory");
          return;
        }
        if (key === "8" || key === "r") {
          e.preventDefault();
          toast.info("Opening Reports & GST (Alt+8)...");
          router.push("/admin/reports");
          return;
        }
        if (key === "9" || key === "l") {
          e.preventDefault();
          toast.info("Opening Profit & Loss (Alt+9)...");
          router.push("/admin/profit-loss");
          return;
        }
        if (key === "0" || key === "d") {
          e.preventDefault();
          toast.info("Opening ERP Dashboard (Alt+0)...");
          router.push("/admin");
          return;
        }

        // Additional letter shortcuts (if not typing in input)
        if (!isTyping) {
          if (key === "e") {
            e.preventDefault();
            toast.info("Opening Daily Expenses (Alt+E)...");
            router.push("/admin/expenses");
            return;
          }
          if (key === "c") {
            e.preventDefault();
            toast.info("Opening Cash Closing (Alt+C)...");
            router.push("/admin/cash-closing");
            return;
          }
          if (key === "o") {
            e.preventDefault();
            toast.info("Opening Online Orders (Alt+O)...");
            router.push("/admin/orders");
            return;
          }
          if (key === "b") {
            e.preventDefault();
            toast.info("Opening Barcode Labels (Alt+B)...");
            router.push("/admin/barcode-labels");
            return;
          }
          if (key === "m") {
            e.preventDefault();
            toast.info("Opening Products Catalog (Alt+M)...");
            router.push("/admin/products");
            return;
          }
          if (key === "q") {
            e.preventDefault();
            toast.info("Opening Quick Stock Inward (Alt+Q)...");
            router.push("/admin/inventory/quick-stock");
            return;
          }
          if (key === "j") {
            e.preventDefault();
            toast.info("Opening Purchase Returns (Alt+J)...");
            router.push("/admin/purchase-returns");
            return;
          }
          if (key === "x") {
            e.preventDefault();
            toast.info("Opening Expiry Tracker (Alt+X)...");
            router.push("/admin/expiry");
            return;
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, showModal]);

  return (
    <>
      {/* Help Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-gray-50 to-slate-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                  <Keyboard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">ERP Keyboard Shortcuts</h3>
                  <p className="text-xs text-gray-500">
                    Press these shortcut keys anywhere in the admin panel to jump instantly
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body with Categorized Grid */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {(
                [
                  "Billing & Sales",
                  "Purchases & Stock",
                  "Accounts & Reports",
                  "General",
                ] as const
              ).map((category) => {
                const items = ERP_SHORTCUTS.filter((s) => s.category === category);
                if (items.length === 0) return null;

                return (
                  <div key={category} className="space-y-2.5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                      {category}
                    </h4>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={item.key}
                            onClick={() => {
                              setShowModal(false);
                              router.push(item.route);
                            }}
                            className="group flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 p-3 hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700 group-hover:border-blue-400 group-hover:text-blue-700 transition">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-gray-900 group-hover:text-blue-900 truncate">
                                  {item.label}
                                </div>
                                <div className="text-[10.5px] text-gray-500 truncate">
                                  {item.description}
                                </div>
                              </div>
                            </div>
                            <kbd className="ml-2 shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-mono font-bold text-blue-700 shadow-2xs group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition">
                              {item.key}
                            </kbd>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/80 px-6 py-3 text-xs text-gray-500">
              <span>Press <kbd className="font-mono font-bold text-gray-700">Alt + /</kbd> anytime to open this helper</span>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-gray-800 transition"
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AdminShortcutsHelpButton({ compact }: { compact?: boolean }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // Trigger keyboard shortcut help event
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", altKey: true }));
        }}
        title="Keyboard Shortcuts (Alt + /)"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-blue-700 transition shadow-xs",
          compact && "px-2"
        )}
      >
        <Keyboard className="h-3.5 w-3.5 text-blue-600" />
        {!compact && <span>Shortcuts</span>}
        <kbd className="hidden sm:inline-block rounded bg-gray-100 px-1 text-[9.5px] font-mono text-gray-500">
          Alt+/
        </kbd>
      </button>
    </>
  );
}


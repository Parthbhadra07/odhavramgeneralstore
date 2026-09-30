"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Printer,
  Download,
  X,
  Search,
  Boxes,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { inventoryService } from "@/services/erp";
import { categoryService } from "@/services/category.service";
import { productService } from "@/services/product.service";
import type { ErpProduct } from "@/types/erp";
import type { Product, Category } from "@/types/database";
import { formatPrice } from "@/utils/format";

type AnyProduct = Product | ErpProduct;

interface StockVerificationModalProps {
  open: boolean;
  onClose: () => void;
  products?: AnyProduct[];
  categories?: Category[];
}

function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function printStockVerificationDocument(options: {
  storeName: string;
  storeAddress?: string | null;
  storeMobile?: string | null;
  currentDate: string;
  currentTime: string;
  auditorName: string;
  categoryMap: Map<string, string>;
  products: AnyProduct[];
  blindCount: boolean;
  showPrice: boolean;
}) {
  const {
    storeName,
    storeAddress,
    storeMobile,
    currentDate,
    currentTime,
    auditorName,
    categoryMap,
    products,
    blindCount,
    showPrice,
  } = options;

  const rowsHtml = products
    .map((p, idx) => {
      const catName = (p.category_id && categoryMap.get(p.category_id)) || "—";
      const isLoose = Boolean(
        p.is_loose ||
          p.unit?.toLowerCase() === "kg" ||
          p.unit?.toLowerCase() === "loose"
      );
      const unitSuffix = p.unit ? ` (${p.unit})` : "";
      const rate = Number((p as any).selling_price ?? p.price ?? 0);
      const barcodeSku = p.barcode || p.sku || "—";
      const stock = Number(p.stock ?? 0);

      return `
        <tr style="background-color: ${idx % 2 === 1 ? "#f8fafc" : "#ffffff"};">
          <td style="text-align: center; color: #475569; width: 30px; font-weight: 500;">${idx + 1}</td>
          <td style="font-family: monospace; font-size: 10px; width: 110px;">${escapeHtml(barcodeSku)}</td>
          <td>
            <strong>${escapeHtml(p.name)}</strong>
            <span style="font-size: 9.5px; color: #64748b;">${escapeHtml(unitSuffix)}${isLoose ? " [Loose]" : ""}</span>
          </td>
          <td style="font-size: 10px; color: #334155; width: 110px;">${escapeHtml(catName)}</td>
          ${
            showPrice
              ? `<td style="text-align: right; width: 65px; font-weight: 600;">₹${rate.toFixed(2)}</td>`
              : ""
          }
          ${
            !blindCount
              ? `<td style="text-align: center; width: 65px; font-weight: bold; background-color: #eff6ff;">${stock}</td>`
              : ""
          }
          <td style="text-align: center; width: 85px; background-color: #fffbeb;">
            <div style="height: 18px; border-bottom: 1px dashed #64748b; margin: 2px auto; width: 85%;"></div>
          </td>
          <td style="text-align: center; width: 60px;">
            <div style="height: 18px; border-bottom: 1px dashed #94a3b8; margin: 2px auto; width: 80%;"></div>
          </td>
          <td style="width: 100px;">
            <div style="height: 18px; border-bottom: 1px dashed #94a3b8; margin: 2px auto; width: 90%;"></div>
          </td>
        </tr>
      `;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Stock Verification Sheet - ${escapeHtml(storeName)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 10mm 10mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 0;
      font-size: 10.5px;
      line-height: 1.3;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .store-title {
      font-size: 18px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .store-sub {
      font-size: 10.5px;
      color: #333;
      margin: 2px 0;
    }
    .badge-title {
      display: inline-block;
      margin-top: 5px;
      padding: 3px 12px;
      border: 1.5px solid #000;
      background: #f1f5f9;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .meta-box {
      display: flex;
      justify-content: space-between;
      border: 1px solid #94a3b8;
      background: #f8fafc;
      padding: 5px 8px;
      margin-bottom: 10px;
      font-size: 10.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }
    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    th, td {
      border: 1px solid #1e293b;
      padding: 4px 5px;
      font-size: 10px;
      vertical-align: middle;
    }
    th {
      background-color: #e2e8f0 !important;
      font-weight: 700;
      text-align: left;
    }
    .sign-section {
      margin-top: 20px;
      border-top: 2px solid #000;
      padding-top: 10px;
      page-break-inside: avoid;
    }
    .sign-grid {
      display: flex;
      justify-content: space-between;
      gap: 15px;
    }
    .sign-cell {
      flex: 1;
      font-size: 10.5px;
    }
    .sign-line {
      margin-top: 26px;
      border-bottom: 1px solid #64748b;
      padding-bottom: 2px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="store-title">${escapeHtml(storeName)}</h1>
    ${storeAddress ? `<p class="store-sub">${escapeHtml(storeAddress)}</p>` : ""}
    ${storeMobile ? `<p class="store-sub">Ph: ${escapeHtml(storeMobile)}</p>` : ""}
    <div class="badge-title">PHYSICAL STOCK VERIFICATION &amp; AUDIT SHEET</div>
  </div>

  <div class="meta-box">
    <div><strong>Date:</strong> ${escapeHtml(currentDate)}</div>
    <div><strong>Time:</strong> ${escapeHtml(currentTime)}</div>
    <div><strong>Auditor:</strong> ${escapeHtml(auditorName || "_________________")}</div>
    <div><strong>Total Items:</strong> ${products.length} Products</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align: center; width: 30px;">#</th>
        <th style="width: 110px;">Barcode / SKU</th>
        <th>Product Name &amp; Unit</th>
        <th style="width: 110px;">Category</th>
        ${showPrice ? '<th style="text-align: right; width: 65px;">Rate</th>' : ""}
        ${!blindCount ? '<th style="text-align: center; width: 65px; background-color: #dbeafe;">System Qty</th>' : ""}
        <th style="text-align: center; width: 85px; background-color: #fef3c7;">Physical Count</th>
        <th style="text-align: center; width: 60px;">Diff (&plusmn;)</th>
        <th style="width: 100px;">Remarks / Expiry</th>
      </tr>
    </thead>
    <tbody>
      ${
        products.length === 0
          ? '<tr><td colspan="9" style="text-align: center; padding: 20px;">No products found for selected filters.</td></tr>'
          : rowsHtml
      }
    </tbody>
  </table>

  <div class="sign-section">
    <div class="sign-grid">
      <div class="sign-cell">
        <strong>Counted / Audited By:</strong>
        <div class="sign-line">Name &amp; Signature:</div>
        <div style="margin-top: 3px; color: #475569;">Date: ____/____/20____</div>
      </div>
      <div class="sign-cell">
        <strong>Verified By:</strong>
        <div class="sign-line">Store Clerk / Supervisor:</div>
        <div style="margin-top: 3px; color: #475569;">Date: ____/____/20____</div>
      </div>
      <div class="sign-cell">
        <strong>Approved By:</strong>
        <div class="sign-line">Store Manager / Owner:</div>
        <div style="margin-top: 3px; color: #475569;">Date: ____/____/20____</div>
      </div>
    </div>
    <div style="margin-top: 15px; text-align: center; font-size: 9.5px; color: #64748b;">
      Printed from Odhavram General Store POS &amp; Inventory Management System
    </div>
  </div>
</body>
</html>`;

  // Hidden print iframe ensures isolated multi-page print without modal/overflow clipping
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:-9999px;width:100%;height:100%;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    // Popup fallback
    const popup = window.open("", "_blank", "width=850,height=900");
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
    popup.close();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error("Print execution failed:", err);
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 2000);
    }
  };

  if (doc.readyState === "complete") {
    setTimeout(triggerPrint, 250);
  } else {
    iframe.onload = () => setTimeout(triggerPrint, 250);
  }
}

export function StockVerificationModal({
  open,
  onClose,
  products: initialProducts,
  categories: initialCategories,
}: StockVerificationModalProps) {
  const { settings } = useStoreSettings();
  const [products, setProducts] = useState<AnyProduct[]>(initialProducts || []);
  const [categories, setCategories] = useState<Category[]>(initialCategories || []);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "low_stock" | "zero_stock">("all");
  const [search, setSearch] = useState("");
  const [blindCount, setBlindCount] = useState(false);
  const [showPrice, setShowPrice] = useState(true);
  const [sortBy, setSortBy] = useState<"name" | "category" | "stock_asc" | "stock_desc">("name");
  const [auditorName, setAuditorName] = useState("");

  useEffect(() => {
    if (!open) return;

    if (initialProducts && initialProducts.length > 0) {
      setProducts(initialProducts);
      setLoading(false);
    } else {
      setLoading(true);
      inventoryService
        .listProducts()
        .then((data) => {
          if (data && data.length > 0) {
            setProducts(data);
          } else {
            return productService.getAll().then((p) => setProducts(p));
          }
        })
        .catch(() => {
          productService.getAll().then((p) => setProducts(p)).catch(() => {});
        })
        .finally(() => setLoading(false));
    }

    if (initialCategories && initialCategories.length > 0) {
      setCategories(initialCategories);
    } else {
      categoryService
        .getAll()
        .then((cats: Category[]) => setCategories(cats))
        .catch(() => {});
    }
  }, [open, initialProducts, initialCategories]);

  // Category map for quick lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Filtered & sorted products
  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      list = list.filter((p) => p.category_id === selectedCategory);
    }

    // Stock status filter
    if (stockFilter === "in_stock") {
      list = list.filter((p) => Number(p.stock) > 0);
    } else if (stockFilter === "low_stock") {
      list = list.filter((p) => {
        const s = Number(p.stock);
        const min = Number((p as any).min_stock_level ?? (p as any).reorder_level ?? 5);
        return s > 0 && s <= min;
      });
    } else if (stockFilter === "zero_stock") {
      list = list.filter((p) => Number(p.stock) <= 0);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === "name") {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (sortBy === "category") {
        const catA = (a.category_id && categoryMap.get(a.category_id)) || "";
        const catB = (b.category_id && categoryMap.get(b.category_id)) || "";
        if (catA !== catB) return catA.localeCompare(catB);
        return (a.name || "").localeCompare(b.name || "");
      }
      if (sortBy === "stock_asc") {
        return Number(a.stock) - Number(b.stock);
      }
      if (sortBy === "stock_desc") {
        return Number(b.stock) - Number(a.stock);
      }
      return 0;
    });

    return list;
  }, [products, search, selectedCategory, stockFilter, sortBy, categoryMap]);

  if (!open) return null;

  const currentDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const currentTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handlePrint = () => {
    printStockVerificationDocument({
      storeName: settings?.store_name || "ODHAVRAM GENERAL STORE",
      storeAddress: settings?.store_address,
      storeMobile: settings?.store_mobile,
      currentDate,
      currentTime,
      auditorName,
      categoryMap,
      products: filteredProducts,
      blindCount,
      showPrice,
    });
  };

  const handleExportCSV = () => {
    const headers = [
      "Sr No",
      "Barcode",
      "SKU",
      "Product Name",
      "Category",
      "Unit",
      "Price / MRP",
      "System Stock",
      "Physical Count",
      "Discrepancy",
      "Remarks / Notes",
    ];

    const rows = filteredProducts.map((p, idx) => {
      const cat = (p.category_id && categoryMap.get(p.category_id)) || "Uncategorized";
      const unit = p.unit || "pcs";
      const price = Number((p as any).selling_price ?? p.price ?? 0);
      const stock = blindCount ? "" : Number(p.stock);
      return [
        idx + 1,
        `"${p.barcode || ""}"`,
        `"${p.sku || ""}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${cat.replace(/"/g, '""')}"`,
        `"${unit}"`,
        price,
        stock,
        "", // Physical count blank
        "", // Discrepancy blank
        "", // Remarks blank
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `stock_verification_audit_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* Main Dialog Container */}
      <div className="flex h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Stock &amp; Product Verification Sheet
              </h2>
              <p className="text-xs text-slate-500">
                Print physical inventory checklist to verify store shelf stock manually
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-1.5 text-xs text-slate-700 hover:text-slate-900"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={loading}
              className="gap-1.5 bg-green-700 hover:bg-green-800 text-white font-semibold shadow-sm"
            >
              <Printer className="h-4 w-4" />
              Print Verification Sheet
            </Button>
            <button
              onClick={onClose}
              className="ml-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="border-b border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, barcode, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs focus:border-green-600 focus:outline-none"
              />
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-green-600 focus:outline-none bg-white text-slate-800"
              >
                <option value="all">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Stock Filter */}
            <div>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as any)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-green-600 focus:outline-none bg-white text-slate-800"
              >
                <option value="all">All Stock Statuses</option>
                <option value="in_stock">In Stock (&gt; 0)</option>
                <option value="low_stock">Low Stock / Reorder</option>
                <option value="zero_stock">Out of Stock (0)</option>
              </select>
            </div>

            {/* Sort Filter */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-green-600 focus:outline-none bg-white text-slate-800"
              >
                <option value="name">Sort: Product Name (A-Z)</option>
                <option value="category">Sort: Category</option>
                <option value="stock_asc">Sort: Stock (Low to High)</option>
                <option value="stock_desc">Sort: Stock (High to Low)</option>
              </select>
            </div>
          </div>

          {/* Additional Options */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={blindCount}
                  onChange={(e) => setBlindCount(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-green-700 focus:ring-green-600"
                />
                <span>Blind Count (Hide system stock for unbiased verification)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-green-700 focus:ring-green-600"
                />
                <span>Show Rate / MRP</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500">Auditor Name:</span>
              <input
                type="text"
                placeholder="e.g. Staff Name / ID"
                value={auditorName}
                onChange={(e) => setAuditorName(e.target.value)}
                className="rounded border border-slate-200 px-2 py-0.5 text-xs focus:border-green-600 focus:outline-none w-36"
              />
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">
                {filteredProducts.length} of {products.length} Products
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Screen Preview Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500">
              <RefreshCw className="h-6 w-6 animate-spin text-green-700" />
              <p className="text-sm">Loading inventory products...</p>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
              {/* Store & Sheet Header */}
              <div className="border-b-2 border-slate-900 pb-3 text-center">
                <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">
                  {settings?.store_name || "ODHAVRAM GENERAL STORE"}
                </h1>
                {settings?.store_address && (
                  <p className="text-xs text-slate-600">{settings.store_address}</p>
                )}
                {settings?.store_mobile && (
                  <p className="text-xs text-slate-600">Ph: {settings.store_mobile}</p>
                )}
                <div className="mt-2 inline-block rounded border border-slate-800 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-900">
                  PHYSICAL STOCK VERIFICATION &amp; AUDIT SHEET
                </div>
              </div>

              {/* Audit Metadata Info */}
              <div className="my-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-slate-200 bg-slate-50 p-2.5 rounded">
                <div>
                  <span className="font-semibold text-slate-500">Date:</span>{" "}
                  <span className="font-bold text-slate-900">{currentDate}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Time:</span>{" "}
                  <span className="font-bold text-slate-900">{currentTime}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Auditor:</span>{" "}
                  <span className="font-bold text-slate-900">
                    {auditorName || "_________________"}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Total Items:</span>{" "}
                  <span className="font-bold text-slate-900">
                    {filteredProducts.length} Products
                  </span>
                </div>
              </div>

              {/* Audit Table Preview */}
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="border border-slate-300 px-2 py-1.5 text-center w-8">#</th>
                    <th className="border border-slate-300 px-2 py-1.5 w-28">Barcode / SKU</th>
                    <th className="border border-slate-300 px-2 py-1.5">Product Name &amp; Unit</th>
                    <th className="border border-slate-300 px-2 py-1.5 w-28">Category</th>
                    {showPrice && (
                      <th className="border border-slate-300 px-2 py-1.5 text-right w-16">
                        Rate
                      </th>
                    )}
                    {!blindCount && (
                      <th className="border border-slate-300 px-2 py-1.5 text-center w-16 bg-blue-50/50">
                        System Qty
                      </th>
                    )}
                    <th className="border border-slate-300 px-2 py-1.5 text-center w-28 bg-amber-50/60 font-bold">
                      Physical Count
                    </th>
                    <th className="border border-slate-300 px-2 py-1.5 text-center w-20">
                      Diff (&plusmn;)
                    </th>
                    <th className="border border-slate-300 px-2 py-1.5 w-32">
                      Remarks / Expiry
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={showPrice ? (blindCount ? 7 : 8) : blindCount ? 6 : 7}
                        className="border border-slate-300 p-8 text-center text-slate-500"
                      >
                        No products match your selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p, idx) => {
                      const catName =
                        (p.category_id && categoryMap.get(p.category_id)) || "—";
                      const isLoose = Boolean(
                        p.is_loose ||
                          p.unit?.toLowerCase() === "kg" ||
                          p.unit?.toLowerCase() === "loose"
                      );
                      const unitSuffix = p.unit ? ` (${p.unit})` : "";
                      const rate = Number(
                        (p as any).selling_price ?? p.price ?? 0
                      );

                      return (
                        <tr
                          key={p.id}
                          className={idx % 2 === 1 ? "bg-slate-50/60" : "bg-white"}
                        >
                          <td className="border border-slate-300 px-1.5 py-1.5 text-center text-slate-500 font-medium">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5 font-mono text-[11px] text-slate-700">
                            {p.barcode || p.sku || "—"}
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5">
                            <span className="font-semibold text-slate-900">
                              {p.name}
                            </span>
                            <span className="ml-1 text-[10px] font-medium text-slate-500">
                              {unitSuffix}
                              {isLoose && " [Loose]"}
                            </span>
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5 text-slate-600 text-[11px]">
                            {catName}
                          </td>
                          {showPrice && (
                            <td className="border border-slate-300 px-2 py-1.5 text-right font-medium text-slate-800">
                              {formatPrice(rate)}
                            </td>
                          )}
                          {!blindCount && (
                            <td className="border border-slate-300 px-2 py-1.5 text-center font-bold text-slate-900 bg-blue-50/20">
                              {p.stock}
                            </td>
                          )}
                          <td className="border border-slate-300 px-2 py-1.5 text-center bg-amber-50/30">
                            <div className="h-5 w-full border-b border-dashed border-slate-400"></div>
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5 text-center">
                            <div className="h-5 w-full border-b border-dashed border-slate-300"></div>
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5">
                            <div className="h-5 w-full border-b border-dashed border-slate-300"></div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Bottom Sign-off Section */}
              <div className="mt-8 border-t-2 border-slate-800 pt-4 text-xs">
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="font-bold text-slate-800">Counted / Audited By:</p>
                    <p className="mt-6 border-b border-slate-400 pb-0.5 text-slate-600">
                      Name &amp; Signature:
                    </p>
                    <p className="mt-1 text-slate-500">Date: ____/____/20____</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Verified By:</p>
                    <p className="mt-6 border-b border-slate-400 pb-0.5 text-slate-600">
                      Store Clerk / Supervisor:
                    </p>
                    <p className="mt-1 text-slate-500">Date: ____/____/20____</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Approved By:</p>
                    <p className="mt-6 border-b border-slate-400 pb-0.5 text-slate-600">
                      Store Manager / Owner:
                    </p>
                    <p className="mt-1 text-slate-500">Date: ____/____/20____</p>
                  </div>
                </div>
                <p className="mt-6 text-center text-[10px] text-slate-400">
                  Printed from Odhavram General Store POS &amp; Inventory Management System
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import { Sparkles, TrendingUp, Printer, Building2, Filter, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { reorderService, supplierService } from "@/services/erp";
import type { ReorderSuggestion, SalesForecast } from "@/services/erp/reorder.service";
import type { Supplier } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { formatPrice, formatDate } from "@/utils/format";
import { printSystematicDocument } from "@/utils/document-print";

export default function ReorderPage() {
  const [allSuggestions, setAllSuggestions] = useState<ReorderSuggestion[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("all");
  const [forecast, setForecast] = useState<SalesForecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      reorderService.getSuggestions(),
      reorderService.forecast(),
      supplierService.list(),
    ])
      .then(([s, f, suppList]) => {
        setAllSuggestions(s);
        setForecast(f);
        setSuppliers(suppList);
      })
      .catch((err) => {
        toast.error("Failed to load reorder recommendations: " + (err?.message || "Unknown error"));
      })
      .finally(() => setLoading(false));
  }, []);

  // Filtered suggestions based on active supplier selection
  const filteredSuggestions = useMemo(() => {
    if (selectedSupplierId === "all") return allSuggestions;
    if (selectedSupplierId === "unassigned") {
      return allSuggestions.filter((item) => !item.supplierId);
    }
    return allSuggestions.filter((item) => item.supplierId === selectedSupplierId);
  }, [allSuggestions, selectedSupplierId]);

  // Supplier shortage counts
  const supplierStats = useMemo(() => {
    const counts = new Map<string, number>();
    let unassigned = 0;
    for (const item of allSuggestions) {
      if (item.supplierId) {
        counts.set(item.supplierId, (counts.get(item.supplierId) ?? 0) + 1);
      } else {
        unassigned++;
      }
    }
    return { counts, unassigned };
  }, [allSuggestions]);

  const activeSupplier = useMemo(() => {
    if (selectedSupplierId === "all" || selectedSupplierId === "unassigned") return null;
    return suppliers.find((s) => s.id === selectedSupplierId) ?? null;
  }, [suppliers, selectedSupplierId]);

  const printReorderSheet = () => {
    if (filteredSuggestions.length === 0) {
      toast.error("No reorder suggestions to print for this selection.");
      return;
    }
    const totalUnits = filteredSuggestions.reduce((s, x) => s + (x.suggestedPurchase || 0), 0);
    const isSupplierSpecific = !!activeSupplier;

    printSystematicDocument({
      docTitle: isSupplierSpecific
        ? `PURCHASE ORDER INDENT — ${activeSupplier.name.toUpperCase()}`
        : "PURCHASE REORDER RECOMMENDATIONS / PO INDENT",
      docBadge: isSupplierSpecific ? "VENDOR PURCHASE ORDER" : "PURCHASE PLANNING STATEMENT",
      docNumber: `PO-INDENT-${new Date().toISOString().slice(0, 10)}${
        activeSupplier ? `-${activeSupplier.name.slice(0, 4).toUpperCase()}` : ""
      }`,
      partyTitle: isSupplierSpecific ? "Supplier / Wholesale Distributor" : undefined,
      partyDetails: isSupplierSpecific
        ? {
            name: activeSupplier.name,
            mobile: activeSupplier.mobile || undefined,
            gstin: activeSupplier.gst_number || undefined,
            address: activeSupplier.address || undefined,
            extra: activeSupplier.outstanding_amount > 0 ? `Current Outstanding Due: ${formatPrice(activeSupplier.outstanding_amount)}` : undefined,
          }
        : undefined,
      metadata: [
        { label: "Target Supplier", value: activeSupplier ? activeSupplier.name : "All Distributors" },
        { label: "Shortage Products Count", value: filteredSuggestions.length },
        { label: "Total Suggested Purchase Units", value: `${totalUnits} units` },
        { label: "Forecast Next Week", value: forecast ? formatPrice(forecast.nextWeekSales) : "—" },
        { label: "Forecast Next Month", value: forecast ? formatPrice(forecast.nextMonthSales) : "—" },
        { label: "Date", value: formatDate(new Date().toISOString()) },
      ],
      columns: [
        { header: "Product Name", width: isSupplierSpecific ? "42%" : "30%" },
        ...(!isSupplierSpecific ? [{ header: "Mapped Supplier", width: "20%" }] : []),
        { header: "Current Stock", align: "center", width: "12%" },
        { header: "Avg Daily Sales", align: "center", width: "12%" },
        { header: "Days Left", align: "center", width: "12%" },
        { header: "Suggested PO Qty", align: "right", width: "14%" },
      ],
      rows: filteredSuggestions.map((s) => ({
        cells: [
          s.productName,
          ...(!isSupplierSpecific ? [s.supplierName || "Unassigned"] : []),
          s.currentStock,
          s.avgDailySales,
          s.daysOfStockLeft ?? "Critical",
          `${s.suggestedPurchase} units`,
        ],
      })),
      summaryRows: [
        { label: "Products Requiring Inward Purchase", value: String(filteredSuggestions.length) },
        {
          label: "Total Units Recommended to Purchase",
          value: `${totalUnits} units`,
          isBold: true,
          isHighlight: true,
        },
      ],
      notes: [
        "Generated using AI 30-day velocity learning & supplier mapping.",
        isSupplierSpecific
          ? `Please supply the above quantities at approved rates to Odhavram General Store.`
          : "Submit item batches to respective wholesale distributors.",
      ],
      signatories: ["Store Manager / Stock In-Charge", "Purchase Officer / Proprietor"],
    });
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Sparkles className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm font-medium text-gray-500">
          Analyzing supplier associations and product depletion velocity…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="admin-page-title mb-1 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-green-600" />
            Smart Reorder &amp; Supplier AI
          </h1>
          <p className="text-sm text-gray-600">
            Learns supplier associations from past purchase entries and auto-filters products for 1-click POs
          </p>
        </div>
        {filteredSuggestions.length > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={printReorderSheet}
            className="gap-1.5 font-bold shadow-xs hover:border-emerald-500 hover:text-emerald-700"
          >
            <Printer className="h-4 w-4 text-emerald-600" />
            <span>
              {activeSupplier ? `Print PO for ${activeSupplier.name}` : "Print Reorder Sheet"}
            </span>
          </Button>
        )}
      </div>

      {/* AI SUPPLIER SELECTOR BAR */}
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-slate-50 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Supplier / Vendor Filter
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Which supplier are you ordering from today?
              </h3>
            </div>
          </div>

          {/* Supplier Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-emerald-700 hidden sm:inline" />
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="h-10 w-full sm:w-80 rounded-xl border border-emerald-300 bg-white px-3.5 py-1 text-sm font-semibold text-slate-800 shadow-xs focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">
                📦 All Suppliers ({allSuggestions.length} shortage items)
              </option>
              {suppliers.map((s) => {
                const count = supplierStats.counts.get(s.id) ?? 0;
                return (
                  <option key={s.id} value={s.id}>
                    🏢 {s.name} ({count} shortage item{count === 1 ? "" : "s"})
                  </option>
                );
              })}
              {supplierStats.unassigned > 0 && (
                <option value="unassigned">
                  ⚠️ Unassigned Products ({supplierStats.unassigned} items)
                </option>
              )}
            </select>
          </div>
        </div>

        {/* Selected Supplier Highlight Box */}
        {activeSupplier && (
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-200/60 pt-3 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Active Vendor: {activeSupplier.name}
              </span>
              {activeSupplier.mobile && <span>📞 {activeSupplier.mobile}</span>}
              {activeSupplier.gst_number && <span className="text-slate-500">GST: {activeSupplier.gst_number}</span>}
            </div>
            <div>
              Outstanding Payable:{" "}
              <strong className={activeSupplier.outstanding_amount > 0 ? "text-amber-700" : "text-emerald-700"}>
                {formatPrice(activeSupplier.outstanding_amount)}
              </strong>
            </div>
          </div>
        )}
      </div>

      {forecast && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="admin-card p-4">
            <p className="flex items-center gap-1 text-sm text-gray-600">
              <TrendingUp className="h-4 w-4" /> Predicted Next Week Sales
            </p>
            <p className="mt-1 text-2xl font-bold text-green-800">{formatPrice(forecast.nextWeekSales)}</p>
          </div>
          <div className="admin-card p-4">
            <p className="text-sm text-gray-600">Predicted Next Month Sales</p>
            <p className="mt-1 text-2xl font-bold text-green-800">{formatPrice(forecast.nextMonthSales)}</p>
            <p className="text-xs text-gray-400">Based on last {forecast.basedOnDays} days</p>
          </div>
        </div>
      )}

      {/* REORDER SUGGESTIONS TABLE WITH INTERNAL SCROLLBAR */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
        <div className="max-h-[calc(100vh-320px)] min-h-[300px] overflow-y-auto overscroll-contain scrollbar-thin">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur-xs shadow-2xs text-xs font-semibold uppercase tracking-wider text-gray-700">
              <tr>
                <th className="p-3 text-left">Product</th>
                {selectedSupplierId === "all" && (
                  <th className="p-3 text-left">Supplier / Vendor</th>
                )}
                <th className="p-3 text-right">Current Stock</th>
                <th className="p-3 text-right">Avg Daily Sales</th>
                <th className="p-3 text-right">Days Left</th>
                <th className="p-3 text-right text-emerald-700 font-bold">Suggested PO Qty</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuggestions.map((s) => (
                <tr key={s.productId} className="border-t hover:bg-gray-50/80 transition-colors">
                  <td className="p-3 font-medium text-gray-900">{s.productName}</td>
                  {selectedSupplierId === "all" && (
                    <td className="p-3">
                      {s.supplierName ? (
                        <button
                          type="button"
                          onClick={() => setSelectedSupplierId(s.supplierId || "all")}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors cursor-pointer"
                          title="Click to filter exclusively for this supplier"
                        >
                          <Building2 className="h-3 w-3 text-slate-400" />
                          <span>{s.supplierName}</span>
                        </button>
                      ) : (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                          Unassigned
                        </span>
                      )}
                    </td>
                  )}
                  <td className="p-3 text-right">
                    <span className={s.currentStock <= s.reorderLevel ? "font-bold text-red-600" : ""}>
                      {s.currentStock}
                    </span>
                  </td>
                  <td className="p-3 text-right">{s.avgDailySales}</td>
                  <td className="p-3 text-right">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        (s.daysOfStockLeft ?? 999) <= 3
                          ? "bg-red-100 text-red-700"
                          : (s.daysOfStockLeft ?? 999) <= 7
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {s.daysOfStockLeft !== null ? `${s.daysOfStockLeft}d left` : "Critical"}
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold text-emerald-700 text-base">
                    {s.suggestedPurchase} units
                  </td>
                </tr>
              ))}
              {filteredSuggestions.length === 0 && (
                <tr>
                  <td colSpan={selectedSupplierId === "all" ? 6 : 5} className="p-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-8 w-8 text-gray-300" />
                      <p className="font-semibold text-slate-700">
                        {activeSupplier
                          ? `No shortage items for ${activeSupplier.name}`
                          : "All products adequately stocked. No urgent purchases needed."}
                      </p>
                      <p className="text-xs text-slate-400">
                        Products with stock above reorder level do not require PO generation right now.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredSuggestions.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-2.5 text-xs text-gray-600 flex items-center justify-between">
            <span className="font-medium">
              Showing {filteredSuggestions.length} recommendation{filteredSuggestions.length === 1 ? "" : "s"}
              {activeSupplier ? ` for ${activeSupplier.name}` : ""}
            </span>
            <span className="text-slate-500">
              Total Recommended Inward:{" "}
              <strong className="text-emerald-700 font-bold">
                {filteredSuggestions.reduce((sum, item) => sum + item.suggestedPurchase, 0)} units
              </strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

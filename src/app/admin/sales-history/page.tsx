"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Receipt,
  Search,
  Filter,
  Download,
  Eye,
  Printer,
  MessageCircle,
  Clock,
  Calendar,
  IndianRupee,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { posService } from "@/services/erp";
import type { PosSale, PosSaleFilters, PosSalesHistoryStats } from "@/types/erp";
import { StatCard } from "@/components/admin/stat-card";
import { ResponsiveTable } from "@/components/admin/responsive-table";
import { BillDetailModal } from "@/components/admin/bill-detail-modal";
import { Modal } from "@/components/admin/modal";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField, SelectField } from "@/components/admin/form-field";
import { formatPrice, formatDate } from "@/utils/format";
import { POS_PAYMENT_METHODS, POS_PAYMENT_LABELS } from "@/lib/erp/constants";
import { openWhatsAppShare, invoiceShareMessage } from "@/utils/whatsapp";
import { downloadCsv } from "@/utils/export";
import {
  getActiveFinancialYearCode,
  getFYDateRange,
  getFinancialYearList,
} from "@/utils/financial-year";

const defaultFilters: PosSaleFilters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  customerName: "",
  customerMobile: "",
  billNumber: "",
  paymentMethod: undefined,
  minAmount: undefined,
  maxAmount: undefined,
  creditOnly: false,
  cancelledOnly: false,
};

export default function SalesHistoryPage() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState<PosSalesHistoryStats | null>(null);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [filters, setFilters] = useState<PosSaleFilters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [quickView, setQuickView] = useState<"all" | "today" | "current_fy" | "last10">("all");

  const [saleToDelete, setSaleToDelete] = useState<PosSale | null>(null);
  const [restoreStockOnDelete, setRestoreStockOnDelete] = useState(true);
  const [deletingSale, setDeletingSale] = useState(false);

  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [clearConfirmationText, setClearConfirmationText] = useState("");
  const [clearingAll, setClearingAll] = useState(false);

  const buildQuery = useCallback((): PosSaleFilters => {
    const q: PosSaleFilters = { ...filters, limit: 200 };
    if (quickView === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      q.dateFrom = start.toISOString();
    } else if (quickView === "current_fy") {
      const activeFY = getActiveFinancialYearCode();
      const range = getFYDateRange(activeFY);
      q.dateFrom = `${range.startDate}T00:00:00.000Z`;
      q.dateTo = `${range.endDate}T23:59:59.999Z`;
    }
    if (quickView === "last10") {
      q.limit = 10;
    }
    return q;
  }, [filters, quickView]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, bills] = await Promise.all([
        posService.getHistoryStats(),
        posService.searchBills(buildQuery()),
      ]);
      setStats(s);
      setSales(bills.filter((b) => b.sale_status !== "held"));
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const updateFilter = <K extends keyof PosSaleFilters>(key: K, value: PosSaleFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setQuickView("all");
  };

  const exportBills = () => {
    if (!sales.length) {
      toast.message("No bills to export");
      return;
    }
    downloadCsv(
      `sales-history-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Bill Number",
        "Date",
        "Customer",
        "Mobile",
        "Payment",
        "Subtotal",
        "Discount",
        "GST",
        "Total",
        "Status",
      ],
      sales.map((s) => [
        s.bill_number,
        formatDate(s.created_at),
        s.customer_name ?? "Walk-in",
        s.customer_mobile ?? "",
        POS_PAYMENT_LABELS[s.payment_method],
        s.subtotal,
        Number(s.discount) + Number(s.loyalty_discount ?? 0),
        Number(s.cgst) + Number(s.sgst) + Number(s.igst),
        s.total_amount,
        s.sale_status,
      ])
    );
    toast.success("Exported to CSV");
  };

  const confirmDeleteSale = async () => {
    if (!saleToDelete) return;
    setDeletingSale(true);
    try {
      await posService.deleteSale(saleToDelete.id, {
        restoreStock: saleToDelete.sale_status === "completed" ? restoreStockOnDelete : false,
      });
      toast.success(`Bill ${saleToDelete.bill_number} deleted permanently`);
      setSaleToDelete(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete bill");
    } finally {
      setDeletingSale(false);
    }
  };

  const handleClearAll = async () => {
    if (clearConfirmationText.trim() !== "CLEAR") return;
    setClearingAll(true);
    try {
      await posService.clearAllSalesAndStock();
      toast.success("All sales bills and stock cleared successfully");
      setShowClearAllModal(false);
      setClearConfirmationText("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear data");
    } finally {
      setClearingAll(false);
    }
  };

  const shareBill = (sale: PosSale) => {
    const msg = invoiceShareMessage(sale.bill_number, formatPrice(Number(sale.total_amount)));
    openWhatsAppShare(msg, sale.customer_mobile ?? undefined);
  };

  if (loading && !stats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="admin-page-title">Sales History</h1>
          <p className="mt-1 text-sm text-gray-600">
            View, search, filter & reprint past bills
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => {
                setClearConfirmationText("");
                setShowClearAllModal(true);
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Clear All Bills & Stock
            </Button>
          )}
          <Button variant="outline" onClick={exportBills}>
            <Download className="mr-1 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {stats && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Today's Sales" value={formatPrice(stats.todaysSales)} icon={IndianRupee} />
          <StatCard label="This Month" value={formatPrice(stats.monthSales)} icon={Calendar} color="bg-blue-600" />
          <StatCard label="Total Bills" value={stats.totalBills} icon={Receipt} color="bg-purple-600" />
          <StatCard label="Avg Bill Value" value={formatPrice(stats.averageBillValue)} icon={Receipt} color="bg-amber-600" />
          <StatCard label="Credit Bills" value={stats.creditBills} icon={Receipt} color="bg-red-600" />
          <StatCard label="Cash Bills" value={stats.cashBills} icon={Receipt} color="bg-green-700" />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search bill#, customer, mobile, product, barcode…"
            value={filters.search ?? ""}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-9"
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="mr-1 h-4 w-4" />
          Filters
        </Button>
        <Button size="sm" onClick={load}>
          Search
        </Button>
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant={quickView === "all" ? "primary" : "outline"}
            onClick={() => setQuickView("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={quickView === "last10" ? "primary" : "outline"}
            onClick={() => setQuickView("last10")}
          >
            <Clock className="mr-1 h-3 w-3" />
            Last 10
          </Button>
          <Button
            size="sm"
            variant={quickView === "today" ? "primary" : "outline"}
            onClick={() => setQuickView("today")}
          >
            Today
          </Button>
          <Button
            size="sm"
            variant={quickView === "current_fy" ? "primary" : "outline"}
            onClick={() => setQuickView("current_fy")}
          >
            <Calendar className="mr-1 h-3 w-3" />
            FY {getActiveFinancialYearCode().replace("FY", "")}
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="admin-card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <FormField label="Financial Year Preset">
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                const range = getFYDateRange(e.target.value);
                updateFilter("dateFrom", `${range.startDate}T00:00:00`);
                updateFilter("dateTo", `${range.endDate}T23:59:59`);
              }}
            >
              <option value="">Select FY...</option>
              {getFinancialYearList(4, 2).map((fy) => (
                <option key={fy.code} value={fy.code}>
                  {fy.label} {fy.isCurrent ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Date From">
            <Input
              type="date"
              value={filters.dateFrom?.slice(0, 10) ?? ""}
              onChange={(e) =>
                updateFilter("dateFrom", e.target.value ? `${e.target.value}T00:00:00` : "")
              }
            />
          </FormField>
          <FormField label="Date To">
            <Input
              type="date"
              value={filters.dateTo?.slice(0, 10) ?? ""}
              onChange={(e) =>
                updateFilter("dateTo", e.target.value ? `${e.target.value}T23:59:59` : "")
              }
            />
          </FormField>
          <FormField label="Customer Name">
            <Input
              value={filters.customerName ?? ""}
              onChange={(e) => updateFilter("customerName", e.target.value)}
            />
          </FormField>
          <FormField label="Mobile">
            <Input
              value={filters.customerMobile ?? ""}
              onChange={(e) => updateFilter("customerMobile", e.target.value)}
            />
          </FormField>
          <FormField label="Bill Number">
            <Input
              value={filters.billNumber ?? ""}
              onChange={(e) => updateFilter("billNumber", e.target.value)}
            />
          </FormField>
          <SelectField
            label="Payment Method"
            value={filters.paymentMethod ?? ""}
            onChange={(v) =>
              updateFilter("paymentMethod", (v || undefined) as PosSaleFilters["paymentMethod"])
            }
            options={POS_PAYMENT_METHODS.map((m) => ({ value: m, label: POS_PAYMENT_LABELS[m] }))}
          />
          <FormField label="Min Amount">
            <Input
              type="number"
              value={filters.minAmount ?? ""}
              onChange={(e) =>
                updateFilter("minAmount", e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </FormField>
          <FormField label="Max Amount">
            <Input
              type="number"
              value={filters.maxAmount ?? ""}
              onChange={(e) =>
                updateFilter("maxAmount", e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.creditOnly ?? false}
              onChange={(e) => updateFilter("creditOnly", e.target.checked)}
            />
            Credit bills only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.cancelledOnly ?? false}
              onChange={(e) => updateFilter("cancelledOnly", e.target.checked)}
            />
            Cancelled bills
          </label>
        </div>
      )}

      <ResponsiveTable
        data={sales}
        loading={loading}
        keyExtractor={(s) => s.id}
        emptyMessage="No bills found. Try adjusting filters."
        columns={[
          {
            key: "bill",
            header: "Bill #",
            mobilePrimary: true,
            cell: (s) => (
              <div>
                <p className="font-mono font-medium">{s.bill_number}</p>
                <p className="text-xs text-gray-500">{formatDate(s.created_at)}</p>
              </div>
            ),
          },
          {
            key: "customer",
            header: "Customer",
            cell: (s) => (
              <div>
                <p>{s.customer_name ?? "Walk-in"}</p>
                {s.customer_mobile && (
                  <p className="text-xs text-gray-500">{s.customer_mobile}</p>
                )}
              </div>
            ),
          },
          {
            key: "payment",
            header: "Payment",
            hideOnMobile: true,
            cell: (s) => POS_PAYMENT_LABELS[s.payment_method],
          },
          {
            key: "total",
            header: "Amount",
            cell: (s) => (
              <span className="font-bold">{formatPrice(Number(s.total_amount))}</span>
            ),
          },
          {
            key: "discount",
            header: "Discount",
            hideOnMobile: true,
            cell: (s) =>
              formatPrice(Number(s.discount) + Number(s.loyalty_discount ?? 0)),
          },
          {
            key: "gst",
            header: "GST",
            hideOnMobile: true,
            cell: (s) =>
              formatPrice(Number(s.cgst) + Number(s.sgst) + Number(s.igst)),
          },
          {
            key: "status",
            header: "Status",
            cell: (s) => (
              <Badge
                variant={
                  s.sale_status === "cancelled"
                    ? "danger"
                    : s.payment_method === "credit"
                      ? "warning"
                      : "success"
                }
              >
                {s.sale_status}
              </Badge>
            ),
          },
        ]}
        actions={(s) => (
          <div className="flex flex-wrap justify-end gap-1">
            <Button size="sm" variant="outline" onClick={() => setSelectedSaleId(s.id)}>
              <Eye className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedSaleId(s.id);
              }}
              title="Reprint"
            >
              <Printer className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => shareBill(s)} title="WhatsApp">
              <MessageCircle className="h-3 w-3" />
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => {
                  setSaleToDelete(s);
                  setRestoreStockOnDelete(s.sale_status === "completed");
                }}
                title="Permanently Delete Bill"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      />

      <BillDetailModal
        saleId={selectedSaleId}
        onClose={() => setSelectedSaleId(null)}
        onUpdated={load}
      />

      {/* Delete Single Bill Confirmation Modal */}
      {saleToDelete && (
        <Modal
          open={!!saleToDelete}
          onClose={() => setSaleToDelete(null)}
          title="Permanently Delete Bill"
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">
                  Permanently delete bill {saleToDelete.bill_number}?
                </p>
                <p className="mt-1 text-xs text-red-700">
                  This will completely remove this bill and its items from the database. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 rounded-lg border bg-gray-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Bill Number:</span>
                <span className="font-mono font-medium">{saleToDelete.bill_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Customer:</span>
                <span className="font-medium">{saleToDelete.customer_name ?? "Walk-in"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date:</span>
                <span>{formatDate(saleToDelete.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount:</span>
                <span className="font-bold">{formatPrice(Number(saleToDelete.total_amount))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span className="font-medium capitalize">{saleToDelete.sale_status}</span>
              </div>
            </div>

            {saleToDelete.sale_status === "completed" ? (
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={restoreStockOnDelete}
                  onChange={(e) => setRestoreStockOnDelete(e.target.checked)}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span>Restore inventory stock for items in this bill</span>
              </label>
            ) : (
              <p className="text-xs italic text-gray-500">
                Stock was already restored when this bill was cancelled.
              </p>
            )}

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                disabled={deletingSale}
                onClick={() => setSaleToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={deletingSale}
                onClick={confirmDeleteSale}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Permanently Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Clear All Sales & Stock Confirmation Modal */}
      {showClearAllModal && (
        <Modal
          open={showClearAllModal}
          onClose={() => setShowClearAllModal(false)}
          title="Clear All Sales Bills & Reset Stock"
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">
                  Reset entire sales history and set stock to 0?
                </p>
                <p className="mt-1 text-xs text-red-700">
                  This will delete ALL POS sales bills, returns, refunds, customer credit/loyalty entries linked to sales, reset bill numbering to 1, and reset all inventory stock counts to 0.
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Type <span className="font-mono font-bold text-red-600">CLEAR</span> below to confirm this action:
            </p>
            <Input
              value={clearConfirmationText}
              onChange={(e) => setClearConfirmationText(e.target.value)}
              placeholder="Type CLEAR to confirm"
              className="font-mono"
            />

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                disabled={clearingAll}
                onClick={() => {
                  setShowClearAllModal(false);
                  setClearConfirmationText("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={clearConfirmationText.trim() !== "CLEAR"}
                loading={clearingAll}
                onClick={handleClearAll}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Clear All Data
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

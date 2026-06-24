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
} from "lucide-react";
import { toast } from "sonner";
import { posService } from "@/services/erp";
import type { PosSale, PosSaleFilters, PosSalesHistoryStats } from "@/types/erp";
import { StatCard } from "@/components/admin/stat-card";
import { ResponsiveTable } from "@/components/admin/responsive-table";
import { BillDetailModal } from "@/components/admin/bill-detail-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField, SelectField } from "@/components/admin/form-field";
import { formatPrice, formatDate } from "@/utils/format";
import { POS_PAYMENT_METHODS, POS_PAYMENT_LABELS } from "@/lib/erp/constants";
import { openWhatsAppShare, invoiceShareMessage } from "@/utils/whatsapp";
import { downloadCsv } from "@/utils/export";

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
  const [stats, setStats] = useState<PosSalesHistoryStats | null>(null);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [filters, setFilters] = useState<PosSaleFilters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [quickView, setQuickView] = useState<"all" | "today" | "last10">("all");

  const buildQuery = useCallback((): PosSaleFilters => {
    const q: PosSaleFilters = { ...filters, limit: 200 };
    if (quickView === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      q.dateFrom = start.toISOString();
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
        <Button variant="outline" onClick={exportBills}>
          <Download className="mr-1 h-4 w-4" />
          Export Excel
        </Button>
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
        <div className="flex gap-1">
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
        </div>
      </div>

      {showFilters && (
        <div className="admin-card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
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
          </div>
        )}
      />

      <BillDetailModal
        saleId={selectedSaleId}
        onClose={() => setSelectedSaleId(null)}
        onUpdated={load}
      />

    </div>
  );
}

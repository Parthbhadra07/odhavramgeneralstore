"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IndianRupee,
  Users,
  AlertCircle,
  TrendingUp,
  Calendar,
  FileText,
  Plus,
  Search,
  Pencil,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { creditService } from "@/services/erp";
import { useStoreSettings } from "@/hooks/use-store-settings";
import type { CreditDashboardStats, CreditLedgerEntry, Customer } from "@/types/erp";
import { StatCard } from "@/components/admin/stat-card";
import { ResponsiveTable } from "@/components/admin/responsive-table";
import { SimpleBarChart } from "@/components/admin/charts/simple-bar-chart";
import { SimpleLineChart } from "@/components/admin/charts/simple-line-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatDate } from "@/utils/format";
import { downloadCsv } from "@/utils/export";
import {
  emptyPartyForm,
  KhataPartyForm,
  KhataPartyLedger,
  KhataVoucherForm,
  partyToForm,
} from "@/components/erp/khata-party-book";

type PartyFilter = "all" | "due" | "advance" | "settled" | "blocked";

function partyBalanceCell(balance: number) {
  if (Math.abs(balance) < 0.005) {
    return <span className="font-medium text-green-700">Settled</span>;
  }
  if (balance > 0) {
    return (
      <span className="font-bold text-red-700">
        You’ll get {formatPrice(balance)}
      </span>
    );
  }
  return (
    <span className="font-bold text-blue-700">
      You’ll give {formatPrice(Math.abs(balance))}
    </span>
  );
}

export default function CreditManagementPage() {
  const { settings } = useStoreSettings();
  const [stats, setStats] = useState<CreditDashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<Awaited<
    ReturnType<typeof creditService.getAnalytics>
  > | null>(null);
  const [reminders, setReminders] = useState<Awaited<
    ReturnType<typeof creditService.getReminders>
  > | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [partyFilter, setPartyFilter] = useState<PartyFilter>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPartyForm, setShowPartyForm] = useState<"create" | "edit" | null>(null);
  const [quickVoucher, setQuickVoucher] = useState<{
    customer: Customer;
    mode: "gave" | "got";
  } | null>(null);
  const [reportTab, setReportTab] = useState<"ledger" | "reports">("ledger");

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a, r, c] = await Promise.all([
        creditService.getDashboardStats(),
        creditService.getAnalytics(),
        creditService.getReminders(),
        creditService.listParties(search || undefined, partyFilter),
      ]);
      setStats(s);
      setAnalytics(a);
      setReminders(r);
      setCustomers(c);
    } finally {
      setLoading(false);
    }
  }, [search, partyFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openLedger = async (customer: Customer) => {
    const latest = (await creditService.getCustomer(customer.id)) ?? customer;
    setSelectedCustomer(latest);
    const entries = await creditService.getLedger(latest.id);
    setLedger(entries);
  };

  const refreshOpenLedger = async () => {
    if (!selectedCustomer) {
      await load();
      return;
    }
    await load();
    await openLedger(selectedCustomer);
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
          <h1 className="admin-page-title">Khatabook</h1>
          <p className="mt-1 text-sm text-gray-600">
            Party ledger like Tally / Khatabook — add parties, edit entries, and track
            closing balance
          </p>
        </div>
        <Button onClick={() => setShowPartyForm("create")}>
          <Plus className="mr-1 h-4 w-4" />
          New Party
        </Button>
      </div>

      {stats && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Total Udhaar Given"
            value={formatPrice(stats.totalCreditGiven)}
            icon={IndianRupee}
          />
          <StatCard
            label="Total Collected"
            value={formatPrice(stats.totalCreditCollected)}
            icon={TrendingUp}
            color="bg-blue-600"
          />
          <StatCard
            label="You’ll Get"
            value={formatPrice(stats.outstandingBalance)}
            icon={Users}
            color="bg-amber-600"
          />
          <StatCard
            label="Overdue"
            value={formatPrice(stats.overdueAmount)}
            icon={AlertCircle}
            color="bg-red-600"
          />
          <StatCard
            label="Parties with Due"
            value={stats.activeCreditCustomers}
            icon={Users}
            color="bg-purple-600"
          />
          <StatCard
            label="Today’s Collection"
            value={formatPrice(stats.todaysCollection)}
            icon={Calendar}
            color="bg-green-700"
          />
        </div>
      )}

      {reminders &&
        (reminders.overdue.length > 0 || reminders.dueToday.length > 0) && (
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="admin-card border-l-4 border-l-red-500 p-4">
              <p className="text-sm font-semibold text-red-700">
                Overdue ({reminders.overdue.length})
              </p>
              <p className="text-xs text-gray-600">Bills past due date</p>
            </div>
            <div className="admin-card border-l-4 border-l-amber-500 p-4">
              <p className="text-sm font-semibold text-amber-700">
                Due Today ({reminders.dueToday.length})
              </p>
            </div>
            <div className="admin-card border-l-4 border-l-blue-500 p-4">
              <p className="text-sm font-semibold text-blue-700">
                Due Tomorrow ({reminders.dueTomorrow.length})
              </p>
            </div>
          </div>
        )}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {analytics && (
          <>
            <div className="admin-card p-4 sm:p-5">
              <h2 className="admin-section-title mb-4">Monthly Udhaar</h2>
              <SimpleBarChart
                data={analytics.monthlyCreditSales}
                formatValue={(v) => formatPrice(v)}
              />
            </div>
            <div className="admin-card p-4 sm:p-5">
              <h2 className="admin-section-title mb-4">Collection Trend</h2>
              <SimpleLineChart
                data={analytics.collectionTrend}
                formatValue={(v) => formatPrice(v)}
              />
              <p className="mt-2 text-sm text-gray-600">
                Recovery rate: <strong>{analytics.recoveryRate}%</strong>
              </p>
            </div>
          </>
        )}
      </div>

      {analytics && analytics.topDebtors.length > 0 && (
        <div className="admin-card mb-6 p-4 sm:p-5">
          <h2 className="admin-section-title mb-3">Top Parties (you’ll get)</h2>
          <div className="flex flex-wrap gap-2">
            {analytics.topDebtors.map((d) => (
              <Badge key={d.name} variant="warning">
                {d.name}: {formatPrice(d.balance)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search party name or mobile…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All parties"],
              ["due", "You’ll get"],
              ["advance", "You’ll give"],
              ["settled", "Settled"],
              ["blocked", "Blocked"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={partyFilter === id ? "primary" : "outline"}
              onClick={() => setPartyFilter(id)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={reportTab === "ledger" ? "primary" : "outline"}
            onClick={() => setReportTab("ledger")}
          >
            Parties
          </Button>
          <Button
            size="sm"
            variant={reportTab === "reports" ? "primary" : "outline"}
            onClick={() => setReportTab("reports")}
          >
            Reports
          </Button>
        </div>
      </div>

      {reportTab === "ledger" ? (
        <ResponsiveTable
          data={customers}
          loading={loading}
          keyExtractor={(c) => c.id}
          emptyMessage="No parties yet. Tap New Party to open a khata."
          onRowClick={(c) => void openLedger(c)}
          columns={[
            {
              key: "name",
              header: "Party",
              mobilePrimary: true,
              cell: (c) => (
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.mobile}</p>
                  {c.gst_number && (
                    <p className="text-xs text-gray-400">GSTIN {c.gst_number}</p>
                  )}
                </div>
              ),
            },
            {
              key: "balance",
              header: "Net balance",
              cell: (c) => partyBalanceCell(c.credit_balance),
            },
            {
              key: "limit",
              header: "Credit Limit",
              hideOnMobile: true,
              cell: (c) => formatPrice(c.credit_limit ?? 0),
            },
            {
              key: "status",
              header: "Status",
              hideOnMobile: true,
              cell: (c) => (
                <Badge variant={c.account_status === "blocked" ? "danger" : "success"}>
                  {c.account_status ?? "active"}
                </Badge>
              ),
            },
            {
              key: "lastPay",
              header: "Last Collection",
              hideOnMobile: true,
              cell: (c) => (c.last_payment_date ? formatDate(c.last_payment_date) : "—"),
            },
          ]}
          actions={(c) => (
            <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="outline" onClick={() => void openLedger(c)}>
                Ledger
              </Button>
              <Button
                size="sm"
                variant="ghost"
                title="You gave (udhaar)"
                onClick={() => setQuickVoucher({ customer: c, mode: "gave" })}
              >
                <ArrowUpRight className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                title="You got (collection)"
                onClick={() => setQuickVoucher({ customer: c, mode: "got" })}
              >
                <ArrowDownLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                title="Edit party"
                onClick={() => {
                  setSelectedCustomer(c);
                  setShowPartyForm("edit");
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            "Daily Collection Report",
            "Monthly Collection Report",
            "Outstanding Report",
            "Overdue Report",
            "Customer Ledger Report",
            "Payment History Report",
          ].map((title) => (
            <button
              key={title}
              type="button"
              className="admin-card p-4 text-left transition hover:border-green-300 hover:shadow-md"
              onClick={() => {
                if (customers.length === 0) {
                  toast.message("No parties to export");
                  return;
                }
                downloadCsv(
                  `${title.toLowerCase().replace(/\s+/g, "-")}.csv`,
                  ["Name", "Mobile", "GSTIN", "Net Balance", "Credit Limit", "Last Collection"],
                  customers.map((c) => [
                    c.name,
                    c.mobile,
                    c.gst_number ?? "",
                    c.credit_balance,
                    c.credit_limit ?? 0,
                    c.last_payment_date ? formatDate(c.last_payment_date) : "",
                  ])
                );
                toast.success(`${title} exported`);
              }}
            >
              <FileText className="mb-2 h-5 w-5 text-green-600" />
              <p className="font-medium">{title}</p>
              <p className="text-xs text-gray-500">Export to Excel (CSV)</p>
            </button>
          ))}
        </div>
      )}

      {selectedCustomer && showPartyForm !== "edit" && (
        <KhataPartyLedger
          customer={selectedCustomer}
          ledger={ledger}
          settings={settings}
          onClose={() => {
            setSelectedCustomer(null);
            setLedger([]);
          }}
          onRefresh={() => void refreshOpenLedger()}
          onEditParty={() => setShowPartyForm("edit")}
        />
      )}

      {showPartyForm && (
        <KhataPartyForm
          title={showPartyForm === "create" ? "New party" : `Edit — ${selectedCustomer?.name ?? "Party"}`}
          initial={
            showPartyForm === "edit" && selectedCustomer
              ? partyToForm(selectedCustomer)
              : emptyPartyForm()
          }
          partyId={showPartyForm === "edit" ? selectedCustomer?.id : undefined}
          allowOpening={showPartyForm === "create"}
          onClose={() => setShowPartyForm(null)}
          onSaved={async (customer) => {
            setShowPartyForm(null);
            await load();
            await openLedger(customer);
          }}
        />
      )}

      {quickVoucher && (
        <KhataVoucherForm
          customer={quickVoucher.customer}
          mode={quickVoucher.mode}
          onClose={() => setQuickVoucher(null)}
          onSaved={async () => {
            const id = quickVoucher.customer.id;
            setQuickVoucher(null);
            await load();
            const updated = await creditService.getCustomer(id);
            if (updated) await openLedger(updated);
          }}
        />
      )}
    </div>
  );
}

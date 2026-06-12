"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IndianRupee,
  Users,
  AlertCircle,
  TrendingUp,
  Calendar,
  FileText,
  MessageCircle,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { creditService, customerService } from "@/services/erp";
import { useStoreSettings } from "@/hooks/use-store-settings";
import type { CreditDashboardStats, CreditLedgerEntry, Customer } from "@/types/erp";
import { StatCard } from "@/components/admin/stat-card";
import { ResponsiveTable } from "@/components/admin/responsive-table";
import { Modal } from "@/components/admin/modal";
import { FormField, SelectField } from "@/components/admin/form-field";
import { SimpleBarChart } from "@/components/admin/charts/simple-bar-chart";
import { SimpleLineChart } from "@/components/admin/charts/simple-line-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatDate } from "@/utils/format";
import { POS_PAYMENT_METHODS, POS_PAYMENT_LABELS } from "@/lib/erp/constants";
import {
  buildCreditStatementText,
  printCreditStatementHtml,
} from "@/utils/credit-statement";
import { openWhatsAppShare } from "@/utils/whatsapp";
import { downloadCsv } from "@/utils/export";

export default function CreditManagementPage() {
  const { settings } = useStoreSettings();
  const [stats, setStats] = useState<CreditDashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof creditService.getAnalytics>> | null>(null);
  const [reminders, setReminders] = useState<Awaited<ReturnType<typeof creditService.getReminders>> | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [reportTab, setReportTab] = useState<"ledger" | "reports">("ledger");

  const [creditForm, setCreditForm] = useState({
    customerId: "",
    amount: "",
    dueDate: "",
    notes: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "cash",
    notes: "",
    fullSettlement: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a, r, c, all] = await Promise.all([
        creditService.getDashboardStats(),
        creditService.getAnalytics(),
        creditService.getReminders(),
        creditService.listCreditCustomers(search || undefined),
        customerService.list(),
      ]);
      setStats(s);
      setAnalytics(a);
      setReminders(r);
      setCustomers(c);
      setAllCustomers(all);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const openProfile = async (customer: Customer) => {
    setSelectedCustomer(customer);
    const entries = await creditService.getLedger(customer.id);
    setLedger([...entries].reverse());
  };

  const handleCreditSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(creditForm.amount);
    if (!creditForm.customerId || amount <= 0) {
      toast.error("Select customer and enter amount");
      return;
    }
    try {
      await creditService.createManualCreditSale({
        customerId: creditForm.customerId,
        amount,
        dueDate: creditForm.dueDate || undefined,
        notes: creditForm.notes || undefined,
      });
      toast.success("Credit sale recorded");
      setShowCreditForm(false);
      setCreditForm({ customerId: "", amount: "", dueDate: "", notes: "" });
      load();
      if (selectedCustomer?.id === creditForm.customerId) {
        const updated = await creditService.getCustomer(creditForm.customerId);
        if (updated) openProfile(updated);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const balance = selectedCustomer.credit_balance;
    const amount = paymentForm.fullSettlement
      ? balance
      : Number(paymentForm.amount);
    if (amount <= 0) {
      toast.error("Enter valid amount");
      return;
    }
    try {
      await creditService.recordPayment(
        selectedCustomer.id,
        amount,
        POS_PAYMENT_LABELS[paymentForm.paymentMethod as keyof typeof POS_PAYMENT_LABELS],
        paymentForm.notes || undefined
      );
      toast.success(paymentForm.fullSettlement ? "Full settlement recorded" : "Partial payment recorded");
      setShowPaymentForm(false);
      const updated = await creditService.getCustomer(selectedCustomer.id);
      if (updated) openProfile(updated);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const shareStatement = () => {
    if (!selectedCustomer) return;
    const text = buildCreditStatementText(
      selectedCustomer,
      ledger,
      settings,
      0,
      selectedCustomer.credit_balance
    );
    openWhatsAppShare(text, selectedCustomer.mobile);
  };

  const exportLedger = () => {
    if (!selectedCustomer) return;
    downloadCsv(
      `ledger-${selectedCustomer.mobile}.csv`,
      ["Date", "Description", "Debit", "Credit", "Balance", "Notes"],
      ledger.map((e) => [
        formatDate(e.date),
        e.description,
        e.debit,
        e.credit,
        e.runningBalance,
        e.notes ?? "",
      ])
    );
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
          <h1 className="admin-page-title">Credit Management</h1>
          <p className="mt-1 text-sm text-gray-600">Khatabook-style customer ledger & collections</p>
        </div>
        <Button onClick={() => setShowCreditForm(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Credit Entry
        </Button>
      </div>

      {stats && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total Credit Given" value={formatPrice(stats.totalCreditGiven)} icon={IndianRupee} />
          <StatCard label="Total Collected" value={formatPrice(stats.totalCreditCollected)} icon={TrendingUp} color="bg-blue-600" />
          <StatCard label="Outstanding" value={formatPrice(stats.outstandingBalance)} icon={Users} color="bg-amber-600" />
          <StatCard label="Overdue" value={formatPrice(stats.overdueAmount)} icon={AlertCircle} color="bg-red-600" />
          <StatCard label="Active Credit Customers" value={stats.activeCreditCustomers} icon={Users} color="bg-purple-600" />
          <StatCard label="Today's Collection" value={formatPrice(stats.todaysCollection)} icon={Calendar} color="bg-green-700" />
        </div>
      )}

      {reminders && (reminders.overdue.length > 0 || reminders.dueToday.length > 0) && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="admin-card border-l-4 border-l-red-500 p-4">
            <p className="text-sm font-semibold text-red-700">Overdue ({reminders.overdue.length})</p>
            <p className="text-xs text-gray-600">Customers past due date</p>
          </div>
          <div className="admin-card border-l-4 border-l-amber-500 p-4">
            <p className="text-sm font-semibold text-amber-700">Due Today ({reminders.dueToday.length})</p>
          </div>
          <div className="admin-card border-l-4 border-l-blue-500 p-4">
            <p className="text-sm font-semibold text-blue-700">Due Tomorrow ({reminders.dueTomorrow.length})</p>
          </div>
        </div>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {analytics && (
          <>
            <div className="admin-card p-4 sm:p-5">
              <h2 className="admin-section-title mb-4">Monthly Credit Sales</h2>
              <SimpleBarChart data={analytics.monthlyCreditSales} formatValue={(v) => formatPrice(v)} />
            </div>
            <div className="admin-card p-4 sm:p-5">
              <h2 className="admin-section-title mb-4">Collection Trend</h2>
              <SimpleLineChart data={analytics.collectionTrend} formatValue={(v) => formatPrice(v)} />
              <p className="mt-2 text-sm text-gray-600">
                Recovery rate: <strong>{analytics.recoveryRate}%</strong>
              </p>
            </div>
          </>
        )}
      </div>

      {analytics && analytics.topDebtors.length > 0 && (
        <div className="admin-card mb-6 p-4 sm:p-5">
          <h2 className="admin-section-title mb-3">Top Debtors</h2>
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
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={reportTab === "ledger" ? "primary" : "outline"}
            onClick={() => setReportTab("ledger")}
          >
            Customers
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
          emptyMessage="No customers with outstanding credit."
          columns={[
            {
              key: "name",
              header: "Customer",
              mobilePrimary: true,
              cell: (c) => (
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.mobile}</p>
                </div>
              ),
            },
            {
              key: "balance",
              header: "Outstanding",
              cell: (c) => (
                <span className="font-bold text-amber-700">{formatPrice(c.credit_balance)}</span>
              ),
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
              header: "Last Payment",
              hideOnMobile: true,
              cell: (c) => (c.last_payment_date ? formatDate(c.last_payment_date) : "—"),
            },
          ]}
          actions={(c) => (
            <Button size="sm" variant="outline" onClick={() => openProfile(c)}>
              View Ledger
            </Button>
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
                  toast.message("No credit customers to export");
                  return;
                }
                downloadCsv(
                  `${title.toLowerCase().replace(/\s+/g, "-")}.csv`,
                  ["Name", "Mobile", "Outstanding", "Credit Limit", "Last Payment"],
                  customers.map((c) => [
                    c.name,
                    c.mobile,
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

      {/* Customer Profile Modal */}
      <Modal
        open={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        title={selectedCustomer ? `${selectedCustomer.name} — Credit Profile` : ""}
        size="xl"
      >
        {selectedCustomer && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs text-gray-500">Outstanding</p>
                <p className="text-lg font-bold text-amber-800">
                  {formatPrice(selectedCustomer.credit_balance)}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Credit Limit</p>
                <p className="text-lg font-bold">{formatPrice(selectedCustomer.credit_limit ?? 0)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Mobile</p>
                <p className="font-medium">{selectedCustomer.mobile}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Last Payment</p>
                <p className="font-medium">
                  {selectedCustomer.last_payment_date
                    ? formatDate(selectedCustomer.last_payment_date)
                    : "—"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setShowPaymentForm(true)}>
                Collect Payment
              </Button>
              <Button size="sm" variant="outline" onClick={() => printCreditStatementHtml(selectedCustomer, ledger, settings)}>
                <FileText className="mr-1 h-4 w-4" />
                Print Statement
              </Button>
              <Button size="sm" variant="outline" onClick={shareStatement}>
                <MessageCircle className="mr-1 h-4 w-4" />
                WhatsApp Share
              </Button>
              <Button size="sm" variant="outline" onClick={exportLedger}>
                Export Ledger
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-right">Debit</th>
                    <th className="p-3 text-right">Credit</th>
                    <th className="p-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="p-3 whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="p-3">
                        {e.description}
                        {e.notes && <p className="text-xs text-gray-500">{e.notes}</p>}
                      </td>
                      <td className="p-3 text-right text-red-700">
                        {e.debit > 0 ? formatPrice(e.debit) : "—"}
                      </td>
                      <td className="p-3 text-right text-green-700">
                        {e.credit > 0 ? formatPrice(e.credit) : "—"}
                      </td>
                      <td className="p-3 text-right font-bold">{formatPrice(e.runningBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Credit Entry Modal */}
      <Modal open={showCreditForm} onClose={() => setShowCreditForm(false)} title="Create Credit Sale" size="md">
        <form onSubmit={handleCreditSale} className="space-y-4">
          <SelectField
            label="Customer"
            value={creditForm.customerId}
            onChange={(v) => setCreditForm((f) => ({ ...f, customerId: v }))}
            options={allCustomers.map((c) => ({
              value: c.id,
              label: `${c.name} (${c.mobile})`,
            }))}
            required
          />
          <FormField label="Amount" required>
            <Input
              type="number"
              min={1}
              value={creditForm.amount}
              onChange={(e) => setCreditForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </FormField>
          <FormField label="Due Date">
            <Input
              type="date"
              value={creditForm.dueDate}
              onChange={(e) => setCreditForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </FormField>
          <FormField label="Notes">
            <Input
              value={creditForm.notes}
              onChange={(e) => setCreditForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </FormField>
          <Button type="submit" variant="primary" className="w-full">
            Record Credit Sale
          </Button>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal
        open={showPaymentForm}
        onClose={() => setShowPaymentForm(false)}
        title="Collect Payment"
        size="md"
      >
        <form onSubmit={handlePayment} className="space-y-4">
          <p className="text-sm text-gray-600">
            Outstanding: <strong>{formatPrice(selectedCustomer?.credit_balance ?? 0)}</strong>
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={paymentForm.fullSettlement}
              onChange={(e) =>
                setPaymentForm((f) => ({ ...f, fullSettlement: e.target.checked }))
              }
            />
            Full Settlement
          </label>
          {!paymentForm.fullSettlement && (
            <FormField label="Partial Amount" required>
              <Input
                type="number"
                min={1}
                max={selectedCustomer?.credit_balance}
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </FormField>
          )}
          <SelectField
            label="Payment Method"
            value={paymentForm.paymentMethod}
            onChange={(v) => setPaymentForm((f) => ({ ...f, paymentMethod: v }))}
            options={[
              ...POS_PAYMENT_METHODS.filter((m) => m !== "credit").map((m) => ({
                value: m,
                label: POS_PAYMENT_LABELS[m],
              })),
              { value: "bank_transfer", label: "Bank Transfer" },
            ]}
            placeholder=""
          />
          <FormField label="Notes">
            <Input
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </FormField>
          <Button type="submit" variant="primary" className="w-full">
            Record Payment
          </Button>
        </form>
      </Modal>
    </div>
  );
}

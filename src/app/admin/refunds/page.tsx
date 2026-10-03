"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { refundService } from "@/services/erp";
import type { Refund, RefundStatus } from "@/types/erp";
import {
  REFUND_STATUS_LABELS,
  REFUND_METHOD_LABELS,
} from "@/lib/erp/constants";
import { Button } from "@/components/ui/button";
import { formatPrice, formatDate } from "@/utils/format";
import { printSystematicDocument } from "@/utils/document-print";
import { toast } from "sonner";

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [filter, setFilter] = useState<RefundStatus | "all">("all");

  const load = () => {
    refundService
      .list(filter === "all" ? undefined : { status: filter })
      .then(setRefunds);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const updateStatus = async (id: string, status: RefundStatus) => {
    try {
      await refundService.updateStatus(id, status);
      toast.success(`Refund ${REFUND_STATUS_LABELS[status]}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const printRefundVoucher = (r: Refund) => {
    const voucherNo = `REF-${r.id.slice(0, 8).toUpperCase()}`;
    printSystematicDocument(
      {
        docTitle: "CUSTOMER REFUND PAYMENT VOUCHER",
        docBadge: "PAYMENT DISBURSEMENT RECORD",
        docNumber: voucherNo,
        docDate: formatDate(r.created_at),
        partyTitle: "Customer Details",
        partyDetails: {
          name: r.customer_name ?? "Walk-in Customer",
        },
        metadata: [
          { label: "Return Reference #", value: r.sales_returns?.return_number ?? "Direct Customer Return" },
          { label: "Refund Payment Method", value: REFUND_METHOD_LABELS[r.refund_method] ?? r.refund_method },
          { label: "Processing Status", value: REFUND_STATUS_LABELS[r.status] ?? r.status },
        ],
        columns: [
          { header: "#", width: "40px", align: "center" },
          { header: "Disbursement Particulars", align: "left" },
          { header: "Return Reference", align: "left" },
          { header: "Payment Mode", align: "left" },
          { header: "Refund Amount", align: "right" },
        ],
        rows: [
          {
            cells: [
              1,
              `Customer Refund Disbursement (${REFUND_STATUS_LABELS[r.status]})`,
              r.sales_returns?.return_number ?? "Counter Return",
              REFUND_METHOD_LABELS[r.refund_method] ?? r.refund_method,
              formatPrice(r.amount),
            ],
          },
        ],
        summaryRows: [
          { label: "Total Refund Paid", value: formatPrice(r.amount), isBold: true, isHighlight: true },
        ],
        notes: [
          "Amount disbursed to the customer in full satisfaction of merchandise returned.",
          "Payment authorized as per Odhavram General Store return & refund policies.",
        ],
        signatories: ["Cashier Disbursed By", "Customer Received Sign", "Manager Authorization"],
      },
      voucherNo
    );
  };

  const printRefundsRegister = () => {
    printSystematicDocument(
      {
        docTitle: "CUSTOMER REFUNDS AUDIT REGISTER",
        docBadge: "AUDIT & ACCOUNTS COPY",
        docDate: new Date().toLocaleDateString("en-IN", { dateStyle: "medium" }),
        metadata: [
          { label: "Status Filter", value: filter === "all" ? "All Statuses" : REFUND_STATUS_LABELS[filter] },
        ],
        columns: [
          { header: "#", width: "35px", align: "center" },
          { header: "Date", align: "left" },
          { header: "Customer", align: "left" },
          { header: "Return #", align: "left" },
          { header: "Method", align: "left" },
          { header: "Status", align: "left" },
          { header: "Amount", align: "right" },
        ],
        rows: refunds.map((r, idx) => ({
          cells: [
            idx + 1,
            formatDate(r.created_at),
            r.customer_name ?? "Walk-in",
            r.sales_returns?.return_number ?? "—",
            REFUND_METHOD_LABELS[r.refund_method] ?? r.refund_method,
            REFUND_STATUS_LABELS[r.status],
            formatPrice(r.amount),
          ],
        })),
        summaryRows: [
          { label: "Total Refund Entries", value: `${refunds.length} records`, isBold: true },
          { label: "Total Refunds Value", value: formatPrice(refunds.reduce((acc, r) => acc + Number(r.amount || 0), 0)), isBold: true, isHighlight: true },
        ],
        notes: [
          "Complete ledger of customer refund disbursements and payout status.",
        ],
      },
      "Customer-Refunds-Register"
    );
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Refund Management</h1>
          <p className="text-sm text-gray-600">Track and process customer refunds &amp; disbursements</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {refunds.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={printRefundsRegister}
              className="gap-1.5 font-bold"
            >
              <Printer className="h-4 w-4 text-emerald-600" />
              <span>Print Refunds Summary</span>
            </Button>
          )}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as RefundStatus | "all")}
            className="rounded-lg border px-3 py-2 text-sm bg-white"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col">
        <div className="overflow-x-auto max-h-[calc(100vh-270px)] min-h-[300px] overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur-xs text-left shadow-2xs font-semibold text-gray-700">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th>Customer</th>
                <th>Return #</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {refunds.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-gray-50/80">
                  <td className="p-3 text-gray-600">{formatDate(r.created_at)}</td>
                  <td className="p-3 font-medium text-slate-900">{r.customer_name ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">
                    {r.sales_returns?.return_number ?? "—"}
                  </td>
                  <td className="p-3 text-gray-600">
                    {REFUND_METHOD_LABELS[r.refund_method] ?? r.refund_method}
                  </td>
                  <td className="p-3 font-bold text-slate-900">{formatPrice(r.amount)}</td>
                  <td className="p-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        r.status === "paid"
                          ? "bg-green-100 text-green-800 border border-green-200"
                          : r.status === "pending"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : r.status === "rejected"
                              ? "bg-red-100 text-red-800 border border-red-200"
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}
                    >
                      {REFUND_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => printRefundVoucher(r)}
                        className="gap-1 text-xs"
                        title="Print Refund Disbursement Voucher"
                      >
                        <Printer className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Print</span>
                      </Button>
                      {r.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(r.id, "approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateStatus(r.id, "rejected")}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {r.status === "approved" && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(r.id, "paid")}
                        >
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {refunds.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-gray-500">
                    No refund records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200/80 bg-gray-50/90 px-4 py-2 text-[11px] text-gray-500 font-medium shrink-0">
          <span>Showing <strong>{refunds.length}</strong> refund record(s)</span>
          <span className="text-gray-400">Scroll inside table to view all items</span>
        </div>
      </div>
    </div>
  );
}

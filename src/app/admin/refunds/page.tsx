"use client";

import { useEffect, useState } from "react";
import { refundService } from "@/services/erp";
import type { Refund, RefundStatus } from "@/types/erp";
import {
  REFUND_STATUS_LABELS,
  REFUND_METHOD_LABELS,
} from "@/lib/erp/constants";
import { Button } from "@/components/ui/button";
import { formatPrice, formatDate } from "@/utils/format";
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

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Refund Management</h1>
          <p className="text-sm text-gray-600">Track and process customer refunds</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as RefundStatus | "all")}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th>Customer</th>
              <th>Return #</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{formatDate(r.created_at)}</td>
                <td className="p-3">{r.customer_name ?? "—"}</td>
                <td className="p-3 font-mono text-xs">
                  {r.sales_returns?.return_number ?? "—"}
                </td>
                <td className="p-3">
                  {REFUND_METHOD_LABELS[r.refund_method] ?? r.refund_method}
                </td>
                <td className="p-3 font-medium">{formatPrice(r.amount)}</td>
                <td className="p-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      r.status === "paid"
                        ? "bg-green-100 text-green-800"
                        : r.status === "pending"
                          ? "bg-amber-100 text-amber-800"
                          : r.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {REFUND_STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
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
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No refunds found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

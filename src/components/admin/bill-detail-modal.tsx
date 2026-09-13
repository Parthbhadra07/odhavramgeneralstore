"use client";

import { useEffect, useState } from "react";
import { Copy, RotateCcw, XCircle, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/admin/modal";
import { ReceiptActions } from "@/components/erp/receipt-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { posService } from "@/services/erp";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { receiptFromPosSale } from "@/utils/receipt";
import { formatPrice, formatDate } from "@/utils/format";
import { POS_PAYMENT_LABELS } from "@/lib/erp/constants";
import { useAuth } from "@/hooks/use-auth";
import type { PosSale } from "@/types/erp";

interface BillDetailModalProps {
  saleId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export function BillDetailModal({ saleId, onClose, onUpdated }: BillDetailModalProps) {
  const { settings } = useStoreSettings();
  const { isAdmin } = useAuth();
  const [sale, setSale] = useState<PosSale | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [restoreStockOnDelete, setRestoreStockOnDelete] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!saleId) {
      setSale(null);
      setShowDeleteConfirm(false);
      return;
    }
    setLoading(true);
    posService
      .getById(saleId)
      .then((data) => {
        setSale(data);
        if (data) {
          setRestoreStockOnDelete(data.sale_status === "completed");
        }
      })
      .finally(() => setLoading(false));
  }, [saleId]);

  const handleDelete = async () => {
    if (!sale) return;
    setDeleting(true);
    try {
      await posService.deleteSale(sale.id, {
        restoreStock: sale.sale_status === "completed" ? restoreStockOnDelete : false,
      });
      toast.success(`Bill ${sale.bill_number} deleted permanently`);
      setShowDeleteConfirm(false);
      onUpdated?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete bill");
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = async () => {
    if (!sale || !confirm("Cancel this bill? Stock will be restored.")) return;
    try {
      await posService.cancelBill(sale.id);
      toast.success("Bill cancelled");
      onUpdated?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    }
  };

  const handleConvertCredit = async () => {
    if (!sale || !confirm("Convert this bill to credit sale?")) return;
    try {
      await posService.convertToCredit(sale.id);
      toast.success("Converted to credit");
      const updated = await posService.getById(sale.id);
      setSale(updated);
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDuplicate = () => {
    if (!sale) return;
    sessionStorage.setItem("pos-duplicate-sale", JSON.stringify(sale));
    window.location.href = "/admin/pos";
    toast.message("Bill loaded in POS for duplication");
  };

  if (!saleId) return null;

  const receiptData = sale ? receiptFromPosSale(sale) : null;
  return (
    <Modal open={!!saleId} onClose={onClose} title="Bill Details" size="xl">
      {loading && <p className="text-sm text-gray-500">Loading bill…</p>}
      {!loading && sale && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{sale.bill_number}</h3>
              <p className="text-sm text-gray-500">{formatDate(sale.created_at)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={sale.sale_status === "cancelled" ? "danger" : "default"}>
                {sale.sale_status}
              </Badge>
              <Badge variant="info">
                {POS_PAYMENT_LABELS[sale.payment_method]}
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase text-gray-500">Store</p>
              <p className="mt-1 font-medium">{settings?.store_name}</p>
              <p className="text-sm text-gray-600">{settings?.store_address}</p>
              {settings?.gst_number && (
                <p className="text-sm text-gray-600">GST: {settings.gst_number}</p>
              )}
            </div>
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase text-gray-500">Customer</p>
              <p className="mt-1 font-medium">{sale.customer_name ?? "Walk-in"}</p>
              {sale.customer_mobile && (
                <p className="text-sm text-gray-600">{sale.customer_mobile}</p>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Rate</th>
                  <th className="p-3 text-right">GST</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(sale.pos_sale_items ?? []).map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3">
                      <p>{item.product_name}</p>
                      {item.barcode && (
                        <p className="font-mono text-xs text-gray-500">{item.barcode}</p>
                      )}
                    </td>
                    <td className="p-3 text-right">{item.quantity}</td>
                    <td className="p-3 text-right">{formatPrice(Number(item.rate))}</td>
                    <td className="p-3 text-right">{item.gst_percentage}%</td>
                    <td className="p-3 text-right font-medium">
                      {formatPrice(Number(item.rate) * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border bg-green-50 p-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPrice(Number(sale.subtotal))}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <span>
                  {formatPrice(Number(sale.discount) + Number(sale.loyalty_discount ?? 0))}
                </span>
              </div>
              <div className="flex justify-between text-sm italic text-gray-600">
                <span>Inclusive of GST</span>
                <span>—</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span>Grand Total</span>
                <span>{formatPrice(Number(sale.total_amount))}</span>
              </div>
              {sale.payment_method === "credit" && (
                <div className="flex justify-between text-amber-700">
                  <span>Due Amount</span>
                  <span>{formatPrice(Number(sale.total_amount))}</span>
                </div>
              )}
            </div>
          </div>

          {receiptData && (
            <ReceiptActions
              data={receiptData}
              settings={settings}
              defaultWidth={settings?.receipt_width ?? "80mm"}
              receiptId={`bill-receipt-${sale.id}`}
            />
          )}

          {showDeleteConfirm && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-red-900">
                    Permanently Delete Bill {sale.bill_number}?
                  </p>
                  <p className="text-red-700 mt-1">
                    This will permanently remove this bill from the database. This action cannot be undone.
                  </p>
                  {sale.sale_status === "completed" ? (
                    <label className="mt-3 flex items-center gap-2 font-medium text-gray-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={restoreStockOnDelete}
                        onChange={(e) => setRestoreStockOnDelete(e.target.checked)}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span>Restore inventory stock for items in this bill</span>
                    </label>
                  ) : (
                    <p className="mt-2 text-xs text-gray-600 italic">
                      Stock was already restored when this bill was cancelled.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-red-200">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={deleting}
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={deleting}
                  onClick={handleDelete}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Confirm Permanent Delete
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleDuplicate}>
                <Copy className="mr-1 h-4 w-4" />
                Duplicate Invoice
              </Button>
              {sale.sale_status === "completed" && sale.payment_method !== "credit" && sale.customer_id && (
                <Button size="sm" variant="outline" onClick={handleConvertCredit}>
                  <RotateCcw className="mr-1 h-4 w-4" />
                  Convert to Credit
                </Button>
              )}
              {isAdmin && sale.sale_status === "completed" && (
                <Button size="sm" variant="outline" className="text-amber-700 hover:bg-amber-50" onClick={handleCancel}>
                  <XCircle className="mr-1 h-4 w-4" />
                  Cancel Bill
                </Button>
              )}
            </div>

            {isAdmin && !showDeleteConfirm && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  setRestoreStockOnDelete(sale.sale_status === "completed");
                  setShowDeleteConfirm(true);
                }}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete Bill
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

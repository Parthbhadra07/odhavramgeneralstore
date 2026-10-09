"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Printer,
  Save,
  Search,
  AlertTriangle,
  Minus,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/admin/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, SelectField } from "@/components/admin/form-field";
import { posService, inventoryService } from "@/services/erp";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { printAgencyGstInvoice } from "@/utils/agency-invoice-print";
import { lineItemInclusiveGst } from "@/utils/gst";
import { formatPrice } from "@/utils/format";
import { POS_PAYMENT_LABELS } from "@/lib/erp/constants";
import type { PosSale, PosPaymentMethod, ErpProduct } from "@/types/erp";

interface EditableItem {
  id?: string;
  productId: string;
  productName: string;
  barcode: string | null;
  lotId?: string | null;
  quantity: number;
  rate: number;
  gstPercentage: number;
  unit?: string | null;
  packMultiplier?: number | null;
}

interface EditBillModalProps {
  saleId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function EditBillModal({
  saleId,
  open,
  onClose,
  onUpdated,
}: EditBillModalProps) {
  const { settings } = useStoreSettings();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sale, setSale] = useState<PosSale | null>(null);

  // Bill metadata form state
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState<number>(0);
  const [roundOff, setRoundOff] = useState<boolean>(true);

  // Line items state
  const [items, setItems] = useState<EditableItem[]>([]);

  // Product search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ErpProduct[]>([]);
  const [searching, setSearching] = useState(false);

  // Load sale data when modal opens
  useEffect(() => {
    if (!open || !saleId) {
      setSale(null);
      setItems([]);
      return;
    }

    setLoading(true);
    posService
      .getById(saleId)
      .then((data) => {
        if (!data) {
          toast.error("Sale not found");
          onClose();
          return;
        }
        setSale(data);
        setCustomerName(data.customer_name ?? "");
        setCustomerMobile(data.customer_mobile ?? "");
        setPaymentMethod(data.payment_method);
        setNotes(data.notes ?? "");
        setDiscount(Number(data.discount || 0));
        setRoundOff(data.round_off !== undefined && Number(data.round_off) !== 0);

        const loadedItems: EditableItem[] = (data.pos_sale_items ?? []).map((it) => ({
          id: it.id,
          productId: it.product_id,
          productName: it.product_name,
          barcode: it.barcode,
          lotId: it.lot_id,
          quantity: Number(it.quantity) || 1,
          rate: Number(it.rate) || 0,
          gstPercentage: Number(it.gst_percentage) || 5,
          unit: it.unit,
          packMultiplier: it.pack_multiplier,
        }));
        setItems(loadedItems);
      })
      .catch((err) => {
        toast.error("Failed to load sale: " + (err instanceof Error ? err.message : String(err)));
        onClose();
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, saleId, onClose]);

  // Live product search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await inventoryService.listProducts({
          search: searchQuery.trim(),
        });
        setSearchResults(res.slice(0, 8));
      } catch (e) {
        console.error("Product search failed:", e);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddProduct = (product: ErpProduct) => {
    // If product is already in bill, increase its quantity
    const existingIndex = items.findIndex((i) => i.productId === product.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      setItems(updated);
      toast.success(`Increased quantity of ${product.name}`);
    } else {
      const newItem: EditableItem = {
        productId: product.id,
        productName: product.name,
        barcode: product.barcode || null,
        quantity: 1,
        rate: Number(product.selling_price || product.price || 0),
        gstPercentage: Number(product.gst_percentage || 5),
        unit: product.unit || "pcs",
        packMultiplier: 1,
      };
      setItems([...items, newItem]);
      toast.success(`Added ${product.name}`);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleUpdateItem = (index: number, updates: Partial<EditableItem>) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error("A bill must have at least one product item");
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Calculations
  const totals = useMemo(() => {
    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;

    for (const it of items) {
      const lineGross = Math.round(Number(it.rate || 0) * Number(it.quantity || 0) * 100) / 100;
      const gst = lineItemInclusiveGst(
        Number(it.rate || 0),
        Number(it.quantity || 0),
        Number(it.gstPercentage || 0)
      );
      subtotal += lineGross;
      cgst += gst.cgst;
      sgst += gst.sgst;
    }

    const disc = Math.max(0, Number(discount || 0));
    const rawTotal = Math.max(0, Math.round((subtotal - disc) * 100) / 100);
    const finalTotal = roundOff ? Math.round(rawTotal) : rawTotal;
    const roundOffVal = roundOff ? Math.round((finalTotal - rawTotal) * 100) / 100 : 0;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalGst: Math.round((cgst + sgst) * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      rawTotal,
      roundOffVal,
      grandTotal: finalTotal,
    };
  }, [items, discount, roundOff]);

  const saveBill = async (andPrint = false) => {
    if (!sale) return;
    if (items.length === 0) {
      toast.error("Bill cannot be empty");
      return;
    }

    for (const it of items) {
      if (it.quantity <= 0) {
        toast.error(`Quantity for ${it.productName} must be greater than 0`);
        return;
      }
      if (it.rate < 0) {
        toast.error(`Rate for ${it.productName} cannot be negative`);
        return;
      }
    }

    setSaving(true);
    try {
      const updated = await posService.updateSale(sale.id, {
        customerName: customerName.trim() || null,
        customerMobile: customerMobile.trim() || null,
        paymentMethod,
        notes: notes.trim() || null,
        discount: Number(discount) || 0,
        roundOff,
        items: items.map((it) => ({
          id: it.id,
          productId: it.productId,
          productName: it.productName,
          barcode: it.barcode,
          lotId: it.lotId,
          quantity: it.quantity,
          rate: it.rate,
          gstPercentage: it.gstPercentage,
          unit: it.unit,
          packMultiplier: it.packMultiplier,
        })),
      });

      toast.success(`Bill #${updated.bill_number} updated successfully!`);

      if (andPrint) {
        printAgencyGstInvoice(updated, { settings });
      }

      onUpdated?.();
      onClose();
    } catch (err) {
      toast.error("Failed to update bill: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  if (!open || !saleId) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={sale ? `Edit Bill — #${sale.bill_number}` : "Edit Bill"}
      size="xl"
    >
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500">
          Loading bill details…
        </div>
      ) : !sale ? (
        <div className="py-8 text-center text-sm text-red-500">
          Bill not found.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Customer & Bill Meta Section */}
          <div className="grid gap-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Customer Name">
              <Input
                placeholder="Walk-in Customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </FormField>

            <FormField label="Mobile Number">
              <Input
                placeholder="10-digit mobile"
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
              />
            </FormField>

            <SelectField
              label="Payment Method"
              value={paymentMethod}
              onChange={(val) => setPaymentMethod(val as PosPaymentMethod)}
              options={Object.entries(POS_PAYMENT_LABELS).map(([val, lbl]) => ({
                value: val,
                label: lbl,
              }))}
            />

            <FormField label="Remarks / Notes">
              <Input
                placeholder="Optional notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </FormField>
          </div>

          {/* Add Product Search Bar */}
          <div className="relative">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700">
              Add Products to Bill
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search product by name, barcode or SKU to add…"
                className="pl-9 pr-4 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Dropdown Suggestions */}
            {searchResults.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-xl">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleAddProduct(product)}
                    className="flex w-full items-center justify-between border-b px-4 py-2.5 text-left text-sm transition hover:bg-emerald-50"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500 font-mono">
                        {product.barcode ? `Barcode: ${product.barcode}` : ""}
                        {product.unit ? ` (${product.unit})` : ""} &bull; Stock:{" "}
                        <span className={product.stock <= 5 ? "font-bold text-red-600" : "font-bold text-emerald-700"}>
                          {product.stock}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-700">
                        {formatPrice(Number(product.selling_price || product.price || 0))}
                      </p>
                      <span className="inline-flex items-center text-xs text-blue-600">
                        <Plus className="mr-0.5 h-3 w-3" /> Add to bill
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900">
                Line Items ({items.length})
              </h4>
              <span className="text-xs text-gray-500">
                You can adjust quantity, rate, and GST per item
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="bg-gray-100 text-xs font-semibold text-gray-700">
                  <tr>
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5 text-left">Product Name</th>
                    <th className="p-2.5 text-center w-36">Quantity</th>
                    <th className="p-2.5 text-right w-28">Rate (₹)</th>
                    <th className="p-2.5 text-center w-24">GST %</th>
                    <th className="p-2.5 text-right w-28">Total</th>
                    <th className="p-2.5 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {items.map((item, idx) => {
                    const lineTotal = Math.round(Number(item.rate || 0) * Number(item.quantity || 0) * 100) / 100;
                    return (
                      <tr key={item.id ?? `new-${idx}`} className="hover:bg-gray-50/70 transition">
                        <td className="p-2.5 text-center text-xs text-gray-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-2.5">
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          {item.barcode && (
                            <p className="font-mono text-xs text-gray-400">
                              {item.barcode}
                            </p>
                          )}
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateItem(idx, {
                                  quantity: Math.max(0.1, Number((item.quantity - 1).toFixed(2))),
                                })
                              }
                              className="rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-100 active:scale-95"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateItem(idx, {
                                  quantity: Math.max(0.01, Number(e.target.value)),
                                })
                              }
                              className="w-16 rounded border border-gray-300 px-1 py-1 text-center text-sm font-semibold focus:border-emerald-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateItem(idx, {
                                  quantity: Number((item.quantity + 1).toFixed(2)),
                                })
                              }
                              className="rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-100 active:scale-95"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.rate}
                            onChange={(e) =>
                              handleUpdateItem(idx, {
                                rate: Math.max(0, Number(e.target.value)),
                              })
                            }
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm font-medium focus:border-emerald-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <select
                            value={item.gstPercentage}
                            onChange={(e) =>
                              handleUpdateItem(idx, {
                                gstPercentage: Number(e.target.value),
                              })
                            }
                            className="rounded border border-gray-300 px-1.5 py-1 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </td>
                        <td className="p-2.5 text-right font-bold text-gray-900">
                          {formatPrice(lineTotal)}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 transition"
                            title="Remove Item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Section */}
          <div className="grid gap-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">
                  Bill Discount (₹):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  className="w-32 rounded border border-gray-300 bg-white px-2 py-1 text-sm font-semibold focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="roundOffCheck"
                  checked={roundOff}
                  onChange={(e) => setRoundOff(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label
                  htmlFor="roundOffCheck"
                  className="text-xs font-medium text-gray-700 cursor-pointer select-none"
                >
                  Apply standard Round Off to nearest rupee
                </label>
              </div>

              {sale.sale_status === "completed" && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800 flex items-start gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    Any changes to product quantities will automatically sync inventory stock
                    and update customer ledger balances.
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5 text-sm sm:text-right">
              <div className="flex justify-between sm:justify-end sm:gap-6">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold text-gray-900">
                  {formatPrice(totals.subtotal)}
                </span>
              </div>
              <div className="flex justify-between sm:justify-end sm:gap-6">
                <span className="text-gray-600">Discount:</span>
                <span className="font-semibold text-red-600">
                  - {formatPrice(Number(discount || 0))}
                </span>
              </div>
              <div className="flex justify-between sm:justify-end sm:gap-6 text-xs text-gray-500">
                <span>Inclusive GST (CGST + SGST):</span>
                <span>{formatPrice(totals.totalGst)}</span>
              </div>
              {totals.roundOffVal !== 0 && (
                <div className="flex justify-between sm:justify-end sm:gap-6 text-xs text-gray-500">
                  <span>Round Off:</span>
                  <span>{totals.roundOffVal > 0 ? `+${totals.roundOffVal}` : totals.roundOffVal}</span>
                </div>
              )}
              <div className="flex justify-between sm:justify-end sm:gap-6 border-t border-emerald-300 pt-2 text-base font-extrabold text-emerald-900">
                <span>Grand Total:</span>
                <span>{formatPrice(totals.grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-1.5 font-bold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                loading={saving}
                onClick={() => saveBill(true)}
              >
                <Printer className="h-4 w-4" />
                <span>Save &amp; Print Tax Invoice</span>
              </Button>
              <Button
                variant="primary"
                className="gap-1.5 font-bold"
                loading={saving}
                onClick={() => saveBill(false)}
              >
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

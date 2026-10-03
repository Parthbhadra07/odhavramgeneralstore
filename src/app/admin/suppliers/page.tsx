"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Plus, Printer, Receipt, CheckCircle2, Trash2, FileText, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supplierService } from "@/services/erp";
import type { Supplier, SupplierPayment, SupplierWithStats } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveTable } from "@/components/admin/responsive-table";
import { ActionButton } from "@/components/admin/action-button";
import { AdminFab } from "@/components/admin/admin-fab";
import { Modal } from "@/components/admin/modal";
import { formatPrice, formatDate } from "@/utils/format";
import { printSystematicDocument } from "@/utils/document-print";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [ledgerSupplier, setLedgerSupplier] = useState<SupplierWithStats | null>(null);
  const [ledger, setLedger] = useState<
    {
      date: string;
      type: string;
      reference: string;
      debit: number;
      credit: number;
      paymentId?: string;
      paymentMethod?: string;
      notes?: string | null;
    }[]
  >([]);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    gst_number: "",
    address: "",
    email: "",
  });
  const [payForm, setPayForm] = useState({
    supplierId: "",
    amount: 0,
    paymentMethod: "cash",
    referenceNumber: "",
    notes: "",
  });
  const [supplierBills, setSupplierBills] = useState<
    {
      id: string;
      bill_number: string;
      invoice_date: string;
      total_amount: number;
      payment_type?: string;
      notes?: string | null;
      paidAmount: number;
      pendingAmount: number;
      isFullySettled: boolean;
    }[]
  >([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState<string>("");

  const [lastReceipt, setLastReceipt] = useState<{
    payment: {
      id?: string;
      amount: number;
      payment_method?: string;
      reference_number?: string | null;
      notes?: string | null;
      payment_date?: string;
    };
    supplier: SupplierWithStats;
  } | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    supplierService.listWithStats().then(setSuppliers).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openForm = () => {
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const printSupplierPaymentReceipt = (
    payment: {
      id?: string;
      amount: number;
      payment_method?: string;
      reference_number?: string | null;
      notes?: string | null;
      payment_date?: string;
    },
    supplier?: Supplier | SupplierWithStats | null
  ) => {
    if (!supplier) {
      toast.error("Supplier details not found");
      return;
    }
    const receiptNo = payment.reference_number || `RCPT-SUPP-${Date.now().toString().slice(-6)}`;
    const payDate = payment.payment_date || new Date().toISOString().slice(0, 10);
    const balanceAfter = Math.max(0, Number(supplier.outstanding_amount ?? 0) - Number(payment.amount));

    printSystematicDocument({
      docTitle: "SUPPLIER PAYMENT DISBURSEMENT RECEIPT / VOUCHER",
      docBadge: "ACCOUNTS PAYMENT VOUCHER",
      docNumber: receiptNo,
      docDate: formatDate(payDate),
      partyTitle: "Supplier / Beneficiary Details",
      partyDetails: {
        name: supplier.name,
        mobile: supplier.mobile || undefined,
        gstin: supplier.gst_number || undefined,
        address: supplier.address || undefined,
        extra: `Remaining Balance: ${formatPrice(balanceAfter)}`,
      },
      metadata: [
        { label: "Receipt / Voucher #", value: receiptNo },
        { label: "Payment Date", value: formatDate(payDate) },
        { label: "Payment Mode", value: (payment.payment_method || "cash").toUpperCase() },
        { label: "Beneficiary Vendor", value: supplier.name },
        { label: "Updated Outstanding Due", value: formatPrice(balanceAfter) },
      ],
      columns: [
        { header: "#", width: "40px", align: "center" },
        { header: "Disbursement Particulars", width: "50%", align: "left" },
        { header: "Payment Mode", width: "20%", align: "center" },
        { header: "Amount Paid", width: "25%", align: "right" },
      ],
      rows: [
        {
          cells: [
            1,
            `Payment towards inward purchases ledger account${payment.notes ? ` (${payment.notes})` : ""}`,
            (payment.payment_method || "cash").toUpperCase(),
            formatPrice(payment.amount),
          ],
        },
      ],
      summaryRows: [
        {
          label: "Total Amount Disbursed",
          value: formatPrice(payment.amount),
          isBold: true,
          isHighlight: true,
        },
        {
          label: "Remaining Balance Due",
          value: formatPrice(balanceAfter),
        },
      ],
      notes: [
        "Official disbursement receipt issued by Odhavram General Store accounts department.",
        "Payment disbursed and credited against wholesale inward purchases ledger.",
        payment.notes ? `Remarks: ${payment.notes}` : "Verified and recorded in accounting books.",
      ],
      signatories: ["Authorized Signatory (Odhavram Store)", "Receiver Signature (Supplier / Representative)"],
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    try {
      await supplierService.upsert(form);
      toast.success("Supplier added");
      setForm({ name: "", mobile: "", gst_number: "", address: "", email: "" });
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleSupplierChange = async (supplierId: string) => {
    setSelectedBillId("");
    const supp = suppliers.find((x) => x.id === supplierId);
    setPayForm((prev) => ({
      ...prev,
      supplierId,
      amount: supp && supp.outstanding_amount > 0 ? supp.outstanding_amount : 0,
      referenceNumber: "",
      notes: "",
    }));

    if (!supplierId) {
      setSupplierBills([]);
      return;
    }

    setLoadingBills(true);
    try {
      const bills = await supplierService.getSupplierBillsWithBalances(supplierId);
      setSupplierBills(bills);
    } catch {
      setSupplierBills([]);
    } finally {
      setLoadingBills(false);
    }
  };

  const handleBillSelect = (billId: string) => {
    setSelectedBillId(billId);
    if (!billId) {
      const supp = suppliers.find((x) => x.id === payForm.supplierId);
      setPayForm((prev) => ({
        ...prev,
        amount: supp?.outstanding_amount || 0,
        referenceNumber: "",
        notes: "On-account balance payment",
      }));
      return;
    }

    const bill = supplierBills.find((b) => b.id === billId);
    if (bill) {
      const amountToPay = bill.pendingAmount > 0 ? bill.pendingAmount : Number(bill.total_amount);
      setPayForm((prev) => ({
        ...prev,
        amount: amountToPay,
        referenceNumber: `Bill #${bill.bill_number}`,
        notes:
          bill.pendingAmount > 0
            ? `Full settlement for Bill #${bill.bill_number}`
            : `Payment for Bill #${bill.bill_number}`,
      }));
    }
  };

  const handleDeletePayment = async (paymentId?: string, amount?: number) => {
    if (!paymentId) {
      toast.error("Payment ID not found");
      return;
    }
    if (
      !confirm(
        `Delete this payment receipt of ${formatPrice(amount || 0)}?\n\nThis will restore ${formatPrice(
          amount || 0
        )} back to the supplier's outstanding payable balance.`
      )
    ) {
      return;
    }
    try {
      await supplierService.deletePayment(paymentId);
      toast.success("Payment receipt deleted and supplier balance restored");
      if (lastReceipt?.payment && lastReceipt.payment.id === paymentId) {
        setLastReceipt(null);
      }
      load();
      if (ledgerSupplier) {
        const entries = await supplierService.getLedger(ledgerSupplier.id);
        setLedger(entries);
      }
      if (payForm.supplierId) {
        const bills = await supplierService.getSupplierBillsWithBalances(payForm.supplierId);
        setSupplierBills(bills);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete payment receipt");
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm.supplierId || payForm.amount <= 0) {
      toast.error("Select supplier and enter payment amount");
      return;
    }
    const targetSupplier = suppliers.find((s) => s.id === payForm.supplierId);
    const selectedBill = supplierBills.find((b) => b.id === selectedBillId);

    try {
      const payment = await supplierService.recordPayment({
        supplierId: payForm.supplierId,
        amount: payForm.amount,
        paymentMethod: payForm.paymentMethod || "cash",
        referenceNumber:
          payForm.referenceNumber || (selectedBill ? `Bill #${selectedBill.bill_number}` : undefined),
        notes:
          payForm.notes ||
          (selectedBill ? `Settlement for Bill #${selectedBill.bill_number}` : undefined),
        purchaseBillId: selectedBillId || undefined,
      });

      toast.success(`Payment of ${formatPrice(payForm.amount)} recorded! Generating receipt...`);

      // Automatically print payment receipt
      printSupplierPaymentReceipt(payment, targetSupplier);

      if (targetSupplier) {
        setLastReceipt({
          payment,
          supplier: targetSupplier,
        });
      }

      setPayForm({ supplierId: "", amount: 0, paymentMethod: "cash", referenceNumber: "", notes: "" });
      setSelectedBillId("");
      setSupplierBills([]);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    }
  };

  const viewLedger = async (supplier: SupplierWithStats) => {
    setLedgerSupplier(supplier);
    const entries = await supplierService.getLedger(supplier.id);
    setLedger(entries);
  };

  const printSuppliersRegister = () => {
    if (suppliers.length === 0) {
      toast.error("No suppliers found to print.");
      return;
    }
    const totalOutstanding = suppliers.reduce((s, x) => s + (x.outstanding_amount || 0), 0);
    const totalPurchases = suppliers.reduce((s, x) => s + (x.total_purchases || 0), 0);

    printSystematicDocument({
      docTitle: "SUPPLIERS DIRECTORY & OUTSTANDING AUDIT STATEMENT",
      docBadge: "ACCOUNTS AUDIT COPY",
      docNumber: `SUPP-REG-${new Date().toISOString().slice(0, 10)}`,
      metadata: [
        { label: "Total Registered Suppliers", value: suppliers.length },
        { label: "Total Outstanding Due", value: formatPrice(totalOutstanding) },
        { label: "Lifetime Total Purchases", value: formatPrice(totalPurchases) },
        { label: "Generated Date", value: formatDate(new Date().toISOString()) },
      ],
      columns: [
        { header: "Supplier / Vendor", width: "22%" },
        { header: "Mobile", width: "14%" },
        { header: "GSTIN", width: "16%" },
        { header: "Purchases Qty", align: "center", width: "12%" },
        { header: "Total Purchases", align: "right", width: "18%" },
        { header: "Outstanding Due", align: "right", width: "18%" },
      ],
      rows: suppliers.map((s) => ({
        cells: [
          s.name,
          s.mobile || "—",
          s.gst_number || "—",
          s.purchase_count,
          formatPrice(s.total_purchases),
          s.outstanding_amount > 0 ? formatPrice(s.outstanding_amount) : "Settled",
        ],
      })),
      summaryRows: [
        { label: "Total Suppliers", value: String(suppliers.length) },
        {
          label: "Total Outstanding Due to Suppliers",
          value: formatPrice(totalOutstanding),
          isBold: true,
          isHighlight: true,
        },
        { label: "Total Purchases Value", value: formatPrice(totalPurchases) },
      ],
      notes: [
        "Official Odhavram General Store Supplier / Vendor Audit Register.",
      ],
      signatories: ["Accounts Clerk", "Store Proprietor"],
    });
  };

  const printSupplierLedger = () => {
    if (!ledgerSupplier) return;
    const totalDebit = ledger.reduce((s, e) => s + (e.debit || 0), 0);
    const totalCredit = ledger.reduce((s, e) => s + (e.credit || 0), 0);

    printSystematicDocument({
      docTitle: "SUPPLIER ACCOUNT STATEMENT / VENDOR LEDGER",
      docBadge: "OFFICIAL AUDIT COPY",
      docNumber: `SUPP-LEDGER-${ledgerSupplier.id.slice(0, 8).toUpperCase()}`,
      partyTitle: "Supplier / Vendor Details",
      partyDetails: {
        name: ledgerSupplier.name,
        mobile: ledgerSupplier.mobile || undefined,
        gstin: ledgerSupplier.gst_number || undefined,
        address: ledgerSupplier.address || undefined,
        extra: `Total Inward Purchases: ${formatPrice(ledgerSupplier.total_purchases)}`,
      },
      metadata: [
        { label: "Supplier Name", value: ledgerSupplier.name },
        { label: "Outstanding Due", value: formatPrice(ledgerSupplier.outstanding_amount) },
        { label: "Total Purchases Inward", value: formatPrice(totalDebit) },
        { label: "Total Payments Made", value: formatPrice(totalCredit) },
      ],
      columns: [
        { header: "Date", width: "15%" },
        { header: "Particulars / Type", width: "25%" },
        { header: "Reference / Bill No", width: "24%" },
        { header: "Inward Purchase (+)", align: "right", width: "18%" },
        { header: "Payment Made (-)", align: "right", width: "18%" },
      ],
      rows: ledger.map((e) => ({
        cells: [
          formatDate(e.date),
          e.type.toUpperCase(),
          e.reference || "—",
          e.debit > 0 ? formatPrice(e.debit) : "—",
          e.credit > 0 ? formatPrice(e.credit) : "—",
        ],
      })),
      summaryRows: [
        { label: "Total Inward Purchases", value: formatPrice(totalDebit) },
        { label: "Total Payments Disbursed", value: formatPrice(totalCredit) },
        {
          label: "Current Balance Due",
          value: formatPrice(ledgerSupplier.outstanding_amount),
          isBold: true,
          isHighlight: true,
        },
      ],
      notes: [
        "Please reconcile with your vendor account copy.",
        "Any discrepancies should be submitted within 7 working days.",
      ],
      signatories: ["Supplier / Authorized Representative", "Store In-Charge / Accountant"],
    });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="admin-page-title">Supplier Management</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Track suppliers, outstanding, and purchase history
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {suppliers.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={printSuppliersRegister}
              className="gap-1.5 font-bold"
            >
              <Printer className="h-4 w-4 text-emerald-600" />
              <span>Print Suppliers Directory</span>
            </Button>
          )}
          <Button onClick={openForm} className="hidden lg:inline-flex">
            <Plus className="mr-1 h-4 w-4" />
            Add Supplier
          </Button>
        </div>
      </div>

      <AdminFab label="Add Supplier" icon={Plus} onClick={openForm} />

      {showForm && (
        <div ref={formRef} className="admin-card mb-6 p-4 sm:p-6">
          <h2 className="admin-section-title mb-4">Add Supplier</h2>
          <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Supplier Name"
              placeholder="Company name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Mobile"
              placeholder="Contact number"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            />
            <Input
              label="GST Number"
              placeholder="GSTIN"
              value={form.gst_number}
              onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              placeholder="email@supplier.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Address"
              placeholder="Full address"
              className="sm:col-span-2"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit">Add Supplier</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* RECORD PAYMENT & INSTANT RECEIPT GENERATION */}
      <div className="admin-card mb-6 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Record Vendor Payment &amp; Bill Settlement</h3>
              <p className="text-xs text-slate-500">
                Settle specific purchase bills (full/partial) or pay against general on-account balance with instant receipt
              </p>
            </div>
          </div>
          {lastReceipt && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => printSupplierPaymentReceipt(lastReceipt.payment, lastReceipt.supplier)}
                className="gap-1.5 text-xs text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 font-bold"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Last Receipt ({formatPrice(lastReceipt.payment.amount)})</span>
              </Button>
              {lastReceipt.payment.id && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeletePayment(lastReceipt.payment.id, lastReceipt.payment.amount)}
                  className="gap-1 text-xs text-red-700 border-red-300 bg-red-50 hover:bg-red-100 font-bold"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Receipt</span>
                </Button>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handlePayment} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">1. Select Supplier</label>
              <select
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 focus:border-emerald-600 focus:outline-none"
                value={payForm.supplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
                required
              >
                <option value="">Choose supplier to pay...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.outstanding_amount > 0 ? `(Due: ${formatPrice(s.outstanding_amount)})` : "(Settled)"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                2. Settle Bill (or On-Account)
              </label>
              <select
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 focus:border-emerald-600 focus:outline-none"
                value={selectedBillId}
                onChange={(e) => handleBillSelect(e.target.value)}
                disabled={!payForm.supplierId || loadingBills}
              >
                <option value="">📋 General On-Account Balance</option>
                {loadingBills && <option disabled>Loading bills...</option>}
                {supplierBills.map((b) => (
                  <option key={b.id} value={b.id}>
                    📄 Bill #{b.bill_number} ({formatDate(b.invoice_date)}) — Due: {formatPrice(b.pendingAmount)} of {formatPrice(b.total_amount)} {b.isFullySettled ? "✓ Settled" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Input
                label="3. Amount (₹)"
                type="number"
                min={1}
                step="any"
                placeholder="0.00"
                value={payForm.amount || ""}
                onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">4. Payment Mode</label>
              <select
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 focus:border-emerald-600 focus:outline-none"
                value={payForm.paymentMethod}
                onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
              >
                <option value="cash">💵 Cash</option>
                <option value="upi">📱 UPI / QR</option>
                <option value="bank_transfer">🏦 Bank Transfer (NEFT/IMPS)</option>
                <option value="cheque">📄 Cheque</option>
              </select>
            </div>
          </div>

          {/* Quick settlement action buttons */}
          {payForm.supplierId && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-200 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-slate-600">Quick Settlement:</span>
                {selectedBillId ? (
                  <>
                    {(() => {
                      const bill = supplierBills.find((b) => b.id === selectedBillId);
                      if (!bill) return null;
                      const half = Math.round((bill.pendingAmount / 2) * 100) / 100;
                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setPayForm((prev) => ({
                                ...prev,
                                amount: bill.pendingAmount > 0 ? bill.pendingAmount : Number(bill.total_amount),
                                notes: `Full settlement for Bill #${bill.bill_number}`,
                              }));
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2.5 py-1 font-bold shadow-2xs hover:bg-emerald-700 cursor-pointer"
                          >
                            <span>⚡ Full Bill ({formatPrice(bill.pendingAmount > 0 ? bill.pendingAmount : bill.total_amount)})</span>
                          </button>
                          {bill.pendingAmount > 10 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPayForm((prev) => ({
                                  ...prev,
                                  amount: half,
                                  notes: `Partial settlement (50%) for Bill #${bill.bill_number}`,
                                }));
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 font-bold hover:bg-amber-200 cursor-pointer"
                            >
                              <span>Partial 50% ({formatPrice(half)})</span>
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    {(() => {
                      const supp = suppliers.find((x) => x.id === payForm.supplierId);
                      if (!supp || supp.outstanding_amount <= 0) return (
                        <span className="text-emerald-700 font-medium">✓ No outstanding balance due</span>
                      );
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setPayForm((prev) => ({
                              ...prev,
                              amount: supp.outstanding_amount,
                              notes: "Full account balance settlement",
                            }));
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2.5 py-1 font-bold shadow-2xs hover:bg-emerald-700 cursor-pointer"
                        >
                          <span>⚡ Pay Full Balance ({formatPrice(supp.outstanding_amount)})</span>
                        </button>
                      );
                    })()}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ref # (UTR/Cheque/Bill)"
                  value={payForm.referenceNumber}
                  onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs sm:w-44 focus:border-emerald-600 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Notes / Remarks"
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs sm:w-48 focus:border-emerald-600 focus:outline-none"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  <span>Record &amp; Print</span>
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>

      <ResponsiveTable
        loading={loading}
        data={suppliers}
        keyExtractor={(s) => s.id}
        emptyMessage="No suppliers added yet."
        columns={[
          {
            key: "name",
            header: "Name",
            mobilePrimary: true,
            cell: (s) => <span className="font-medium">{s.name}</span>,
          },
          { key: "mobile", header: "Mobile", cell: (s) => s.mobile ?? "—" },
          {
            key: "gst",
            header: "GST",
            hideOnMobile: true,
            cell: (s) => (
              <span className="font-mono text-xs">{s.gst_number ?? "—"}</span>
            ),
          },
          {
            key: "outstanding",
            header: "Outstanding",
            cell: (s) => (
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                {formatPrice(s.outstanding_amount)}
              </span>
            ),
          },
          {
            key: "purchases",
            header: "Total Purchases",
            cell: (s) => formatPrice(s.total_purchases),
          },
          {
            key: "count",
            header: "Purchase Count",
            hideOnMobile: true,
            cell: (s) => s.purchase_count,
          },
          {
            key: "last",
            header: "Last Purchase",
            cell: (s) =>
              s.last_purchase_date ? formatDate(s.last_purchase_date) : "—",
          },
        ]}
        actions={(s) => (
          <ActionButton
            icon={Eye}
            label="View Ledger"
            onClick={() => viewLedger(s)}
            variant="primary"
          />
        )}
      />

      <Modal
        open={!!ledgerSupplier}
        onClose={() => setLedgerSupplier(null)}
        title={`Ledger — ${ledgerSupplier?.name ?? ""}`}
        size="lg"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <div>
            Outstanding Due:{" "}
            <strong className="text-amber-900 dark:text-amber-300">
              {formatPrice(ledgerSupplier?.outstanding_amount ?? 0)}
            </strong>
          </div>
          {ledgerSupplier && (
            <Button
              size="sm"
              variant="outline"
              onClick={printSupplierLedger}
              className="gap-1 bg-white text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Systematic Statement</span>
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto overscroll-contain scrollbar-thin space-y-2 pr-1">
          {ledger.map((entry, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm dark:border-gray-700 bg-white"
            >
              <div>
                <p className="font-medium capitalize">{entry.type}</p>
                <p className="text-gray-500">{formatDate(entry.date)} · {entry.reference}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  {entry.debit > 0 && (
                    <p className="font-semibold text-red-600">+{formatPrice(entry.debit)}</p>
                  )}
                  {entry.credit > 0 && (
                    <p className="font-semibold text-green-600">−{formatPrice(entry.credit)}</p>
                  )}
                </div>
                {entry.type === "payment" && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        printSupplierPaymentReceipt(
                          {
                            id: entry.paymentId,
                            amount: entry.credit,
                            payment_method: entry.paymentMethod || "cash",
                            reference_number: entry.reference,
                            notes: entry.notes,
                            payment_date: entry.date,
                          },
                          ledgerSupplier
                        )
                      }
                      className="h-7 gap-1 px-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                      title="Print Disbursement Receipt"
                    >
                      <Receipt className="h-3 w-3" />
                      <span>Receipt</span>
                    </Button>
                    {entry.paymentId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeletePayment(entry.paymentId, entry.credit)}
                        className="h-7 gap-1 px-2 text-xs font-bold text-red-700 border-red-200 hover:bg-red-50 cursor-pointer"
                        title="Delete Payment Receipt & Restore Balance"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {ledger.length === 0 && (
            <p className="text-center text-gray-500 py-6">No ledger entries yet.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

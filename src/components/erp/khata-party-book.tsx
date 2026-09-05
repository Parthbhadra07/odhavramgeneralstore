"use client";

import { useState } from "react";
import { Pencil, Trash2, ArrowDownLeft, ArrowUpRight, FileText, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { creditService, customerService } from "@/services/erp";
import type { CreditLedgerEntry, Customer } from "@/types/erp";
import { Modal } from "@/components/admin/modal";
import { FormField, SelectField } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice, formatDate } from "@/utils/format";
import { isValidMobile } from "@/utils/phone";
import { POS_PAYMENT_METHODS, POS_PAYMENT_LABELS } from "@/lib/erp/constants";
import {
  buildCreditStatementText,
  printCreditStatementHtml,
} from "@/utils/credit-statement";
import { openWhatsAppShare } from "@/utils/whatsapp";
import { downloadCsv } from "@/utils/export";
import type { StoreSettings } from "@/types/erp";

export type PartyFormValues = {
  name: string;
  mobile: string;
  email: string;
  address: string;
  gst_number: string;
  credit_limit: string;
  account_status: "active" | "blocked" | "closed";
  notes: string;
  openingBalance: string;
};

export const emptyPartyForm = (): PartyFormValues => ({
  name: "",
  mobile: "",
  email: "",
  address: "",
  gst_number: "",
  credit_limit: "",
  account_status: "active",
  notes: "",
  openingBalance: "",
});

export function partyToForm(c: Customer): PartyFormValues {
  return {
    name: c.name,
    mobile: c.mobile,
    email: c.email ?? "",
    address: c.address ?? "",
    gst_number: c.gst_number ?? "",
    credit_limit: String(c.credit_limit ?? 0),
    account_status: (c.account_status ?? "active") as PartyFormValues["account_status"],
    notes: c.notes ?? "",
    openingBalance: "",
  };
}

export function KhataPartyForm({
  title,
  initial,
  partyId,
  allowOpening,
  onClose,
  onSaved,
}: {
  title: string;
  initial: PartyFormValues;
  partyId?: string;
  allowOpening?: boolean;
  onClose: () => void;
  onSaved: (customer: Customer) => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Party name is required");
      return;
    }
    if (!isValidMobile(form.mobile)) {
      toast.error("Enter a valid 10-digit mobile");
      return;
    }
    setSaving(true);
    try {
      let customer: Customer;
      if (partyId) {
        customer = await customerService.updateById(partyId, {
          name: form.name,
          mobile: form.mobile,
          email: form.email || null,
          address: form.address || null,
          gst_number: form.gst_number || null,
          credit_limit: Number(form.credit_limit) || 0,
          account_status: form.account_status,
          notes: form.notes || null,
        });
      } else {
        customer = await customerService.createParty({
          name: form.name,
          mobile: form.mobile,
          email: form.email || null,
          address: form.address || null,
          gst_number: form.gst_number || null,
          credit_limit: Number(form.credit_limit) || 0,
          notes: form.notes || null,
        });
        if (form.account_status !== "active") {
          customer = await customerService.updateById(customer.id, {
            account_status: form.account_status,
          });
        }
        const opening = Number(form.openingBalance);
        if (allowOpening && Number.isFinite(opening) && opening !== 0) {
          await creditService.recordVoucher({
            customerId: customer.id,
            type: opening > 0 ? "credit" : "payment",
            amount: Math.abs(opening),
            description: "Opening balance",
            notes: "Opening balance",
          });
          const refreshed = await creditService.getCustomer(customer.id);
          if (refreshed) customer = refreshed;
        }
      }
      toast.success("Party saved");
      onSaved(customer);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save party");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title} size="md">
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <FormField label="Party name" required className="sm:col-span-2">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Customer / firm name"
          />
        </FormField>
        <FormField label="Mobile" required>
          <Input
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            placeholder="10-digit mobile"
          />
        </FormField>
        <FormField label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </FormField>
        <FormField label="GSTIN">
          <Input
            value={form.gst_number}
            onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
          />
        </FormField>
        <FormField label="Credit limit (₹)">
          <Input
            type="number"
            min={0}
            value={form.credit_limit}
            onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
          />
        </FormField>
        <SelectField
          label="Account status"
          value={form.account_status}
          onChange={(v) =>
            setForm({
              ...form,
              account_status: v as PartyFormValues["account_status"],
            })
          }
          options={[
            { value: "active", label: "Active" },
            { value: "blocked", label: "Blocked" },
            { value: "closed", label: "Closed" },
          ]}
          placeholder=""
        />
        {allowOpening && (
          <FormField
            label="Opening balance (₹)"
            hint="Positive = they owe you (udhaar). Negative = you owe them (advance)."
          >
            <Input
              type="number"
              step="0.01"
              value={form.openingBalance}
              onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
            />
          </FormField>
        )}
        <FormField label="Address" className="sm:col-span-2">
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </FormField>
        <FormField label="Notes" className="sm:col-span-2">
          <Input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </FormField>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" loading={saving}>
            Save Party
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

type VoucherKind = "credit" | "payment" | "adjust";

export function KhataVoucherForm({
  customer,
  mode,
  entry,
  onClose,
  onSaved,
}: {
  customer: Customer;
  mode: "gave" | "got" | "edit";
  entry?: CreditLedgerEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const defaultType: VoucherKind =
    mode === "got" ? "payment" : mode === "gave" ? "credit" : (entry?.type as VoucherKind) || "credit";
  const [type, setType] = useState<VoucherKind>(defaultType);
  const [amount, setAmount] = useState(
    String(entry ? Math.max(entry.debit, entry.credit) : "")
  );
  const [date, setDate] = useState(
    (entry?.date ?? new Date().toISOString()).slice(0, 10)
  );
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [dueDate, setDueDate] = useState(entry?.dueDate?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);

  const title =
    mode === "edit"
      ? "Edit voucher"
      : mode === "got"
        ? `You got — ${customer.name}`
        : `You gave — ${customer.name}`;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter amount");
      return;
    }
    setSaving(true);
    try {
      if (mode === "edit" && entry) {
        await creditService.updateLedgerEntry(entry.id, {
          amount: value,
          type,
          notes: notes || null,
          description: description || null,
          date,
          dueDate: dueDate || null,
          paymentMethod: type === "payment" ? paymentMethod : null,
        });
        toast.success("Voucher updated");
      } else {
        await creditService.recordVoucher({
          customerId: customer.id,
          type,
          amount: value,
          date,
          notes: notes || undefined,
          description:
            description ||
            (type === "credit" ? "You gave" : type === "payment" ? "You got" : "Adjustment"),
          paymentMethod: type === "payment" ? paymentMethod : undefined,
          dueDate: dueDate || undefined,
        });
        toast.success(type === "payment" ? "Collection recorded" : "Udhaar recorded");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save voucher");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title} size="md">
      <form onSubmit={save} className="space-y-3">
        <SelectField
          label="Voucher type"
          value={type}
          onChange={(v) => setType(v as VoucherKind)}
          options={[
            { value: "credit", label: "You gave (udhaar / debit)" },
            { value: "payment", label: "You got (collection / credit)" },
            { value: "adjust", label: "Journal adjustment" },
          ]}
          placeholder=""
        />
        <FormField label="Amount (₹)" required>
          <Input
            type="number"
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </FormField>
        <FormField label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
        {type === "credit" && (
          <FormField label="Due date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </FormField>
        )}
        {type === "payment" && (
          <SelectField
            label="Received via"
            value={paymentMethod}
            onChange={setPaymentMethod}
            options={[
              ...POS_PAYMENT_METHODS.filter((m) => m !== "credit").map((m) => ({
                value: m,
                label: POS_PAYMENT_LABELS[m],
              })),
              { value: "bank_transfer", label: "Bank Transfer" },
            ]}
            placeholder=""
          />
        )}
        <FormField label="Particulars">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Bill no. / narration"
          />
        </FormField>
        <FormField label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <div className="flex gap-2">
          <Button type="submit" loading={saving}>
            Save
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function KhataPartyLedger({
  customer,
  ledger,
  settings,
  onClose,
  onRefresh,
  onEditParty,
}: {
  customer: Customer;
  ledger: CreditLedgerEntry[];
  settings?: StoreSettings | null;
  onClose: () => void;
  onRefresh: () => void;
  onEditParty: () => void;
}) {
  const [voucher, setVoucher] = useState<{
    mode: "gave" | "got" | "edit";
    entry?: CreditLedgerEntry;
  } | null>(null);

  const remove = async (entry: CreditLedgerEntry) => {
    if (!confirm("Delete this voucher? Closing balance will be recalculated.")) return;
    try {
      await creditService.deleteLedgerEntry(entry.id);
      toast.success("Voucher deleted");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`${customer.name} — Party ledger`}
        size="xl"
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-gray-600">
                {customer.mobile}
                {customer.address ? ` · ${customer.address}` : ""}
              </p>
              {customer.gst_number && (
                <p className="text-xs text-gray-500">GSTIN {customer.gst_number}</p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={onEditParty}>
              <Pencil className="mr-1 h-4 w-4" />
              Edit party
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div
              className={
                customer.credit_balance > 0
                  ? "rounded-lg bg-red-50 p-3"
                  : customer.credit_balance < 0
                    ? "rounded-lg bg-blue-50 p-3"
                    : "rounded-lg bg-green-50 p-3"
              }
            >
              <p className="text-xs text-gray-500">
                {customer.credit_balance > 0
                  ? "You will get"
                  : customer.credit_balance < 0
                    ? "You will give"
                    : "Closing balance"}
              </p>
              <p
                className={
                  customer.credit_balance > 0
                    ? "text-xl font-bold text-red-800"
                    : customer.credit_balance < 0
                      ? "text-xl font-bold text-blue-800"
                      : "text-xl font-bold text-green-800"
                }
              >
                {formatPrice(Math.abs(customer.credit_balance))}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Credit limit</p>
              <p className="text-lg font-bold">{formatPrice(customer.credit_limit ?? 0)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Last collection</p>
              <p className="font-medium">
                {customer.last_payment_date ? formatDate(customer.last_payment_date) : "—"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setVoucher({ mode: "gave" })}>
              <ArrowUpRight className="mr-1 h-4 w-4" />
              You gave
            </Button>
            <Button size="sm" variant="outline" onClick={() => setVoucher({ mode: "got" })}>
              <ArrowDownLeft className="mr-1 h-4 w-4" />
              You got
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => printCreditStatementHtml(customer, ledger, settings ?? null)}
            >
              <FileText className="mr-1 h-4 w-4" />
              Print
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                openWhatsAppShare(
                  buildCreditStatementText(
                    customer,
                    ledger,
                    settings ?? null,
                    0,
                    customer.credit_balance
                  ),
                  customer.mobile
                )
              }
            >
              <MessageCircle className="mr-1 h-4 w-4" />
              WhatsApp
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadCsv(
                  `khata-${customer.mobile}.csv`,
                  ["Date", "Particulars", "Debit", "Credit", "Balance", "Notes"],
                  ledger.map((e) => [
                    formatDate(e.date),
                    e.description,
                    e.debit,
                    e.credit,
                    e.runningBalance,
                    e.notes ?? "",
                  ])
                )
              }
            >
              Export
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Particulars</th>
                  <th className="p-3 text-right">Debit (gave)</th>
                  <th className="p-3 text-right">Credit (got)</th>
                  <th className="p-3 text-right">Balance</th>
                  <th className="p-3 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-500">
                      No vouchers yet. Add “You gave” or “You got”.
                    </td>
                  </tr>
                )}
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
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        className="mr-1 rounded p-1 text-gray-500 hover:bg-gray-100"
                        title="Edit"
                        onClick={() => setVoucher({ mode: "edit", entry: e })}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-red-600 hover:bg-red-50"
                        title="Delete"
                        onClick={() => remove(e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {settings?.store_name && (
            <p className="text-xs text-gray-400">Books of {settings.store_name}</p>
          )}
        </div>
      </Modal>
      {voucher && (
        <KhataVoucherForm
          customer={customer}
          mode={voucher.mode}
          entry={voucher.entry}
          onClose={() => setVoucher(null)}
          onSaved={() => {
            setVoucher(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
}

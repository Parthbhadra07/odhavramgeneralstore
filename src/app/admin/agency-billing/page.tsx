"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  Plus,
  Trash2,
  Printer,
  Save,
  CheckCircle2,
  Building2,
  Calendar,
  CreditCard,
  Percent,
  Receipt,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Truck,
  ArrowRight,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { posService } from "@/services/erp/pos.service";
import { inventoryService } from "@/services/erp/inventory.service";
import { customerService } from "@/services/erp/customer.service";
import { settingsService } from "@/services/erp/settings.service";
import { printAgencyGstInvoice } from "@/utils/agency-invoice-print";
import { formatPrice } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/cn";
import type {
  ErpProduct,
  Customer,
  PosCartLine,
  PosSale,
  StoreSettings,
  PosPaymentMethod,
  AgencyPendingBill,
} from "@/types/erp";

interface AgencyBillLine {
  id: string; // temporary client uuid
  productId: string;
  name: string;
  barcode: string | null;
  hsnCode: string;
  unit: string;
  quantity: number;
  rate: number; // inclusive selling rate
  mrp: number;
  discountPercent: number;
  gstPercentage: number; // verified product gst (0, 5, 12, 18, 28)
}

const GST_SLABS = [
  { value: 0, label: "0% - Exempt / Nil Rated", badge: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { value: 5, label: "5% - FMCG / Groceries", badge: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: 12, label: "12% - Packaged Goods", badge: "bg-indigo-100 text-indigo-800 border-indigo-300" },
  { value: 18, label: "18% - Household Goods", badge: "bg-purple-100 text-purple-800 border-purple-300" },
  { value: 28, label: "28% - Luxury / Aerated", badge: "bg-rose-100 text-rose-800 border-rose-300" },
];

export default function AgencyBillingPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  // Buyer / Consignee details
  const [buyerName, setBuyerName] = useState("");
  const [buyerMobile, setBuyerMobile] = useState("");
  const [buyerGstin, setBuyerGstin] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("24 - Gujarat");
  const [isInterState, setIsInterState] = useState(false);

  // Invoice parameters
  const [invoiceDate, setInvoiceDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [paymentTerms, setPaymentTerms] = useState("Immediate");
  const [vehicleNo, setVehicleNo] = useState("");
  const [salesman, setSalesman] = useState("");
  const [beat, setBeat] = useState("");
  const [billNotes, setBillNotes] = useState("");
  const [billDiscount, setBillDiscount] = useState<number>(0);

  // Pending Bills state (Matching FMCG Wholesale Bill Format)
  const [pendingBills, setPendingBills] = useState<AgencyPendingBill[]>([]);
  const [includePendingBills, setIncludePendingBills] = useState(true);
  const [showAddPendingModal, setShowAddPendingModal] = useState(false);
  const [manualPendingBook, setManualPendingBook] = useState("");
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState("");
  const [manualPendingBillNo, setManualPendingBillNo] = useState("");
  const [manualPendingBillDate, setManualPendingBillDate] = useState(() =>
    new Date().toLocaleDateString("en-IN")
  );
  const [manualPendingBillAmt, setManualPendingBillAmt] = useState("");
  const [manualPendingBalAmt, setManualPendingBalAmt] = useState("");
  const [manualPendingDays, setManualPendingDays] = useState("0");
  const [isPendingSectionExpanded, setIsPendingSectionExpanded] = useState(false);

  // Items in bill
  const [lines, setLines] = useState<AgencyBillLine[]>([]);

  // Search & auto-suggest state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ErpProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [partyBalance, setPartyBalance] = useState<number>(0);

  // Action states
  const [saving, setSaving] = useState(false);
  const [lastCreatedSale, setLastCreatedSale] = useState<PosSale | null>(null);
  const [recentAgencySales, setRecentAgencySales] = useState<PosSale[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    settingsService.get().then(setSettings).catch(() => {});
    loadRecentSales();
  }, []);

  const loadRecentSales = async () => {
    try {
      const res = await posService.searchBills({ limit: 10 });
      setRecentAgencySales(res);
    } catch {}
  };

  // Live product search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await inventoryService.listProducts({
          search: searchQuery.trim(),
        });
        setSearchResults(results.slice(0, 8));
      } catch (err) {
        console.error("Product search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Customer search
  useEffect(() => {
    if (!customerSearch.trim() || customerSearch.length < 2) {
      setCustomerResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await customerService.list(customerSearch.trim());
        setCustomerResults(res.slice(0, 5));
      } catch {}
    }, 200);

    return () => clearTimeout(timer);
  }, [customerSearch]);

  const handleSelectCustomer = async (c: Customer) => {
    setSelectedCustomerId(c.id);
    setSelectedCustomer(c);
    setBuyerName(c.name);
    setBuyerMobile(c.mobile);
    if (c.gst_number) setBuyerGstin(c.gst_number);
    if (c.address) setBuyerAddress(c.address);
    const bal = Number(c.credit_balance) || 0;
    setPartyBalance(bal);
    setCustomerSearch("");
    setCustomerResults([]);
    toast.success(`Selected party: ${c.name} (Balance: ₹${bal.toFixed(2)})`);

    // Auto-fetch pending bills for this customer
    try {
      const pBills = await customerService.getPendingBills(c.id);
      setPendingBills(pBills);
      setIncludePendingBills(pBills.length > 0);
    } catch {
      setPendingBills([]);
    }
  };

  // Auto-detect existing customer if mobile is typed manually
  useEffect(() => {
    if (selectedCustomerId) return;
    const cleanMobile = buyerMobile.trim();
    if (cleanMobile.length >= 10) {
      customerService
        .getByMobile(cleanMobile)
        .then(async (c) => {
          if (c) {
            setSelectedCustomerId(c.id);
            setSelectedCustomer(c);
            const bal = Number(c.credit_balance) || 0;
            setPartyBalance(bal);
            if (!buyerName.trim() || buyerName.trim() === "Customer") setBuyerName(c.name);
            if (!buyerGstin.trim() && c.gst_number) setBuyerGstin(c.gst_number);
            if (!buyerAddress.trim() && c.address) setBuyerAddress(c.address);
            toast.info(`Found registered party: ${c.name} (Balance: ₹${bal.toFixed(2)})`);

            try {
              const pBills = await customerService.getPendingBills(c.id);
              setPendingBills(pBills);
              setIncludePendingBills(pBills.length > 0);
            } catch {
              setPendingBills([]);
            }
          }
        })
        .catch(() => {});
    }
  }, [buyerMobile, selectedCustomerId, buyerName, buyerGstin, buyerAddress]);

  const handleAddManualPendingBill = () => {
    const amt = Number(manualPendingBillAmt);
    const pend = Number(manualPendingBalAmt) || amt;
    if (!manualPendingBillNo.trim() || isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid bill number and bill amount");
      return;
    }

    const newBill: AgencyPendingBill = {
      id: "manual-" + Date.now(),
      book: manualPendingBook.trim() || undefined,
      billNo: manualPendingBillNo.trim(),
      billDate: manualPendingBillDate.trim() || new Date().toLocaleDateString("en-IN"),
      billAmount: amt,
      pendingAmount: pend,
      days: Number(manualPendingDays) || 0,
    };

    setPendingBills((prev) => [...prev, newBill]);
    setIncludePendingBills(true);
    setShowAddPendingModal(false);
    setManualPendingBook("");
    setManualPendingBillNo("");
    setManualPendingBillAmt("");
    setManualPendingBalAmt("");
    setManualPendingDays("0");
    toast.success(`Added pending bill #${newBill.billNo}`);
  };

  const handleRemovePendingBill = (index: number) => {
    setPendingBills((prev) => prev.filter((_, i) => i !== index));
    toast.info("Removed pending bill entry");
  };

  const handleAddProduct = (p: ErpProduct) => {
    // Check if already in lines
    const existingIndex = lines.findIndex((l) => l.productId === p.id);
    if (existingIndex >= 0) {
      const updated = [...lines];
      updated[existingIndex].quantity += 1;
      setLines(updated);
      toast.success(`Increased quantity for ${p.name}`);
    } else {
      // Verified product GST %
      const verifiedGst =
        p.gst_percentage !== undefined && p.gst_percentage !== null
          ? Number(p.gst_percentage)
          : 0;

      const newLine: AgencyBillLine = {
        id: crypto.randomUUID(),
        productId: p.id,
        name: p.name,
        barcode: p.barcode || null,
        hsnCode: p.hsn_code || (p.barcode ? p.barcode.slice(0, 8) : "21039020"),
        unit: p.unit || "pcs",
        quantity: 1,
        rate: Number(p.selling_price || p.price || 0),
        mrp: Number(p.mrp || p.selling_price || p.price || 0),
        discountPercent: Number(p.discount_percent || 0),
        gstPercentage: verifiedGst,
      };

      setLines([...lines, newLine]);
      toast.success(
        `Added ${p.name} (GST verified: ${verifiedGst}%${verifiedGst === 0 ? " - Exempt" : ""})`
      );
    }

    setSearchQuery("");
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const updateLine = (id: string, updates: Partial<AgencyBillLine>) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  // Calculations: Accurate per-item GST Verification
  const {
    grossTotal,
    itemDiscountsTotal,
    taxableSubtotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    totalTax,
    netPayable,
    roundOff,
    gstSlabsBreakdown,
  } = useMemo(() => {
    let gross = 0;
    let itemDiscs = 0;
    let taxableSum = 0;
    let cgstSum = 0;
    let sgstSum = 0;
    let igstSum = 0;

    const slabs: Record<
      number,
      { taxable: number; cgst: number; sgst: number; igst: number; count: number }
    > = {};

    lines.forEach((l) => {
      const lineGross = Math.round(l.rate * l.quantity * 100) / 100;
      const lineDisc =
        l.discountPercent > 0
          ? Math.round(lineGross * (l.discountPercent / 100) * 100) / 100
          : 0;
      const lineNet = Math.max(0, Math.round((lineGross - lineDisc) * 100) / 100);

      gross += lineGross;
      itemDiscs += lineDisc;

      const gst = l.gstPercentage;
      let taxable = lineNet;
      let lineCgst = 0;
      let lineSgst = 0;
      let lineIgst = 0;

      if (gst > 0) {
        taxable = Math.round((lineNet / (1 + gst / 100)) * 100) / 100;
        const totalTaxAmt = Math.round((lineNet - taxable) * 100) / 100;

        if (isInterState) {
          lineIgst = totalTaxAmt;
        } else {
          const half = Math.round((totalTaxAmt / 2) * 100) / 100;
          lineCgst = half;
          lineSgst = half;
        }
      }

      taxableSum += taxable;
      cgstSum += lineCgst;
      sgstSum += lineSgst;
      igstSum += lineIgst;

      if (!slabs[gst]) {
        slabs[gst] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, count: 0 };
      }
      slabs[gst].taxable += taxable;
      slabs[gst].cgst += lineCgst;
      slabs[gst].sgst += lineSgst;
      slabs[gst].igst += lineIgst;
      slabs[gst].count += 1;
    });

    const netBeforeBillDisc = Math.max(0, gross - itemDiscs);
    const finalNetRaw = Math.max(0, netBeforeBillDisc - (billDiscount || 0));
    const rounded = Math.round(finalNetRaw);
    const roundOffDiff = Math.round((rounded - finalNetRaw) * 100) / 100;

    return {
      grossTotal: gross,
      itemDiscountsTotal: itemDiscs,
      taxableSubtotal: taxableSum,
      cgstTotal: cgstSum,
      sgstTotal: sgstSum,
      igstTotal: igstSum,
      totalTax: cgstSum + sgstSum + igstSum,
      netPayable: rounded,
      roundOff: roundOffDiff,
      gstSlabsBreakdown: slabs,
    };
  }, [lines, billDiscount, isInterState]);

  const handleSaveBill = async (andPrint = false) => {
    if (lines.length === 0) {
      toast.error("Please add at least one product to the agency invoice");
      return;
    }

    if (!buyerName.trim()) {
      toast.error("Buyer / Consignee name is required for wholesale agency billing");
      return;
    }

    setSaving(true);
    try {
      // 1. Resolve or Create the Party as a Customer
      let finalCustomerId = selectedCustomerId;
      let partyPrevBalance = partyBalance;

      if (!finalCustomerId) {
        // Look up by mobile or name first
        let existingCustomer: Customer | null = null;
        if (buyerMobile.trim()) {
          existingCustomer = await customerService.findForPos({ mobile: buyerMobile.trim() });
        }
        if (!existingCustomer && buyerName.trim()) {
          existingCustomer = await customerService.findForPos({ name: buyerName.trim() });
        }

        if (existingCustomer) {
          finalCustomerId = existingCustomer.id;
          partyPrevBalance = Number(existingCustomer.credit_balance) || 0;
          // Sync any new info (address or gstin) to existing record
          if (
            (buyerGstin.trim() && buyerGstin.trim() !== existingCustomer.gst_number) ||
            (buyerAddress.trim() && buyerAddress.trim() !== existingCustomer.address)
          ) {
            try {
              const updated = await customerService.updateById(existingCustomer.id, {
                name: buyerName.trim() || existingCustomer.name,
                gst_number: buyerGstin.trim() || existingCustomer.gst_number,
                address: buyerAddress.trim() || existingCustomer.address,
              });
              existingCustomer = updated;
            } catch (err) {
              console.warn("Could not sync customer details:", err);
            }
          }
        } else {
          // BRAND NEW PARTY: save them as a customer in the database!
          try {
            const rawMobile = buyerMobile.trim();
            const validMobile =
              rawMobile && rawMobile.length >= 10
                ? rawMobile
                : `999${Date.now().toString().slice(-7)}`;
            const createdParty = await customerService.upsert({
              name: buyerName.trim(),
              mobile: validMobile,
              gst_number: buyerGstin.trim() || null,
              address: buyerAddress.trim() || null,
              notes: "Auto-saved via Agency Wholesale Billing",
            });
            finalCustomerId = createdParty.id;
            partyPrevBalance = Number(createdParty.credit_balance) || 0;
            toast.success(`✨ New party "${buyerName.trim()}" saved to Customer directory!`);
          } catch (createErr) {
            console.warn("Could not auto-create customer record:", createErr);
          }
        }
      } else {
        // Customer was already selected from directory: update latest address/gstin if modified
        if (
          (buyerGstin.trim() && buyerGstin.trim() !== selectedCustomer?.gst_number) ||
          (buyerAddress.trim() && buyerAddress.trim() !== selectedCustomer?.address)
        ) {
          try {
            await customerService.updateById(finalCustomerId, {
              gst_number: buyerGstin.trim() || selectedCustomer?.gst_number,
              address: buyerAddress.trim() || selectedCustomer?.address,
            });
          } catch {}
        }
      }

      // Map to PosCartLine
      const cartLines: PosCartLine[] = lines.map((l) => ({
        productId: l.productId,
        name: l.name,
        barcode: l.barcode,
        unit: l.unit,
        quantity: l.quantity,
        rate: l.rate,
        discountPercent: l.discountPercent,
        gstPercentage: l.gstPercentage,
        hsnCode: l.hsnCode,
        mrp: l.mrp,
      }));

      // Full notes with agency metadata
      const agencyNotes = [
        buyerGstin ? `GSTIN: ${buyerGstin}` : "",
        buyerAddress ? `Address: ${buyerAddress}` : "",
        vehicleNo ? `Vehicle: ${vehicleNo}` : "",
        salesman ? `Salesman: ${salesman}` : "",
        beat ? `Beat: ${beat}` : "",
        paymentTerms ? `Terms: ${paymentTerms}` : "",
        billNotes ? `Remarks: ${billNotes}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const createdSale = await posService.createSale({
        lines: cartLines,
        paymentMethod,
        customerId: finalCustomerId || undefined,
        customerName: buyerName.trim(),
        customerMobile: buyerMobile.trim() || undefined,
        discount: Number(billDiscount) || 0,
        notes: agencyNotes || "Wholesale Agency Invoice",
        roundOff: true,
        billNumber: customInvoiceNumber.trim() || undefined,
        createdAt: invoiceDate ? new Date(invoiceDate).toISOString() : undefined,
      });

      setLastCreatedSale(createdSale);
      toast.success(`Agency Invoice ${createdSale.bill_number} created successfully!`);

      const billNet = Number(createdSale.total_amount) || netPayable;
      const closingBal =
        paymentMethod === "credit"
          ? partyPrevBalance + billNet
          : partyPrevBalance;

      if (andPrint) {
        await printAgencyGstInvoice(createdSale, {
          settings,
          buyerGstin: buyerGstin.trim() || undefined,
          buyerAddress: buyerAddress.trim() || undefined,
          vehicleNo: vehicleNo.trim() || undefined,
          salesman: salesman.trim() || undefined,
          beat: beat.trim() || undefined,
          billNumber: createdSale.bill_number,
          invoiceDate: invoiceDate
            ? new Date(invoiceDate).toLocaleDateString("en-IN")
            : undefined,
          dueDate: invoiceDate
            ? new Date(invoiceDate).toLocaleDateString("en-IN")
            : undefined,
          customerBalance: partyPrevBalance,
          partyPreviousBalance: partyPrevBalance,
          partyClosingBalance: closingBal,
          pendingBills: includePendingBills ? pendingBills : [],
          includePendingBills,
        });
      }

      // Reset form
      setLines([]);
      setBuyerName("");
      setBuyerMobile("");
      setBuyerGstin("");
      setBuyerAddress("");
      setSalesman("");
      setBeat("");
      setCustomInvoiceNumber("");
      setBillDiscount(0);
      setBillNotes("");
      setSelectedCustomerId(null);
      setSelectedCustomer(null);
      setPartyBalance(0);
      setPendingBills([]);
      loadRecentSales();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create agency bill";
      toast.error(msg);
      console.error("Agency billing error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleReprintSale = async (sale: PosSale) => {
    const parseNote = (prefix: string) => {
      if (!sale.notes) return undefined;
      const part = sale.notes.split("|").find((p) => p.trim().startsWith(prefix));
      return part ? part.replace(prefix, "").replace(":", "").trim() || undefined : undefined;
    };

    await printAgencyGstInvoice(sale, {
      settings,
      buyerGstin: parseNote("GSTIN"),
      buyerAddress: parseNote("Address"),
      vehicleNo: parseNote("Vehicle"),
      salesman: parseNote("Salesman"),
      beat: parseNote("Beat"),
      dueDate: sale.created_at
        ? new Date(sale.created_at).toLocaleDateString("en-IN")
        : undefined,
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 sm:p-6 border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                Agency / Wholesale GST Billing
              </h1>
              <p className="text-xs text-gray-500">
                Independent B2B wholesale invoice creation with verified product GST rates &amp; HSN codes
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/sales-history"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
          >
            <RotateCcw className="h-3.5 w-3.5 text-gray-500" />
            <span>Sales History</span>
          </Link>
          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
          >
            <Building2 className="h-3.5 w-3.5 text-gray-500" />
            <span>Bank &amp; GST Settings</span>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Columns: Buyer Details, Product Lookup & Line Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Buyer / Consignee Card */}
          <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-700" />
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                  1. Buyer / Consignee Details (B2B Agency)
                </h2>
              </div>

              {/* Quick Customer Search Input */}
              <div className="relative w-48 sm:w-64">
                <input
                  type="text"
                  placeholder="Lookup customer..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-2.5 py-1 text-xs focus:bg-white focus:outline-none focus:border-blue-600"
                />
                {customerResults.length > 0 && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-gray-200 bg-white shadow-xl py-1">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-xs transition flex justify-between"
                      >
                        <span className="font-bold text-gray-900">{c.name}</span>
                        <span className="text-gray-500">{c.mobile}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Party Status & Balance Banner */}
            {selectedCustomer ? (
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-blue-50/80 border border-blue-200">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                  <span className="text-xs font-bold text-blue-900">
                    Existing Party: {selectedCustomer.name}
                  </span>
                  <span className="text-xs text-blue-700">({selectedCustomer.mobile})</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] text-blue-600 font-semibold block uppercase">Party Balance</span>
                    <span className="text-xs font-black text-blue-950">
                      ₹{partyBalance.toFixed(2)} {partyBalance > 0 ? "(Due)" : partyBalance < 0 ? "(Advance)" : "(Settled)"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId(null);
                      setSelectedCustomer(null);
                      setPartyBalance(0);
                    }}
                    className="text-[11px] text-blue-700 hover:text-blue-900 underline font-medium"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : buyerName.trim() ? (
              <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/80 border border-emerald-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs">✨</span>
                  <span className="text-xs font-semibold text-emerald-800">
                    New Party: Details will be automatically saved to Customer Directory on billing
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                  Auto-Save Customer
                </span>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">
                  Buyer Business / Store Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="e.g. SHREE RAM GENERAL STORE"
                  className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-semibold uppercase focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">
                  Buyer Mobile / Phone
                </label>
                <input
                  type="tel"
                  value={buyerMobile}
                  onChange={(e) => setBuyerMobile(e.target.value)}
                  placeholder="e.g. 9825123456"
                  className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">
                  Buyer GSTIN (Optional)
                </label>
                <input
                  type="text"
                  value={buyerGstin}
                  onChange={(e) => setBuyerGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 24AAACR1234B1Z5"
                  className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-mono uppercase focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">
                  Place of Supply / State
                </label>
                <select
                  value={placeOfSupply}
                  onChange={(e) => {
                    setPlaceOfSupply(e.target.value);
                    setIsInterState(e.target.value !== "24 - Gujarat");
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-medium focus:border-blue-600 focus:outline-none"
                >
                  <option value="24 - Gujarat">24 - Gujarat (Intra-state CGST + SGST)</option>
                  <option value="27 - Maharashtra">27 - Maharashtra (Inter-state IGST)</option>
                  <option value="26 - DNH & Daman">26 - DNH &amp; Daman (Intra/Inter)</option>
                  <option value="Other">Other State (IGST)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-gray-600 block mb-1">
                  Buyer Address / Destination
                </label>
                <input
                  type="text"
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  placeholder="e.g. Shop 4, Station Road, Vapi, Gujarat - 396191"
                  className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">
                  Salesman (Optional)
                </label>
                <input
                  type="text"
                  value={salesman}
                  onChange={(e) => setSalesman(e.target.value)}
                  placeholder="e.g. HARISH:-9313083557"
                  className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">
                  Beat / Route (Optional)
                </label>
                <input
                  type="text"
                  value={beat}
                  onChange={(e) => setBeat(e.target.value)}
                  placeholder="e.g. HARIYA PARK+C.COLONY"
                  className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Pending Bills Section (Ultra-Compact Wholesale Layout) */}
          <section className="rounded-2xl border border-amber-100/80 bg-amber-50/20 p-3 sm:p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Receipt className="h-4 w-4 text-amber-700 shrink-0" />
                <span className="text-xs font-black text-gray-900 uppercase tracking-wide">
                  Pending Bills
                </span>
                {pendingBills.length > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-900">
                    {pendingBills.length} Bills • ₹
                    {pendingBills.reduce((s, b) => s + b.pendingAmount, 0).toFixed(2)} Due
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-400">
                    (None recorded)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                {pendingBills.length > 0 && (
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includePendingBills}
                      onChange={(e) => setIncludePendingBills(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span>Print on Bill</span>
                  </label>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddPendingModal(true)}
                  className="h-7 px-2 text-[11px] font-bold gap-1 border-amber-200 bg-white text-amber-900 hover:bg-amber-50"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Old Bill</span>
                </Button>
                {pendingBills.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsPendingSectionExpanded(!isPendingSectionExpanded)}
                    className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1 p-1"
                  >
                    <span>{isPendingSectionExpanded ? "Hide Details" : "View Details"}</span>
                    <ChevronDown
                      className={cn("h-3.5 w-3.5 transition-transform", isPendingSectionExpanded && "rotate-180")}
                    />
                  </button>
                )}
              </div>
            </div>

            {pendingBills.length > 0 && isPendingSectionExpanded && (
              <div className="overflow-x-auto rounded-xl border border-amber-200/80 bg-white max-h-52 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-amber-50/60 font-bold text-gray-700 uppercase text-[9.5px] border-b border-amber-100 sticky top-0">
                    <tr>
                      <th className="py-1.5 px-2.5">Book</th>
                      <th className="py-1.5 px-2.5">Bill No</th>
                      <th className="py-1.5 px-2.5 text-center">Bill Date</th>
                      <th className="py-1.5 px-2.5 text-right">Bill Amt</th>
                      <th className="py-1.5 px-2.5 text-right">Pend. Amt</th>
                      <th className="py-1.5 px-2.5 text-center">Days</th>
                      <th className="py-1.5 px-2.5 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingBills.map((b, idx) => (
                      <tr key={b.id || idx} className="hover:bg-amber-50/20">
                        <td className="py-1.5 px-2.5 font-bold text-gray-700">{b.book || "—"}</td>
                        <td className="py-1.5 px-2.5 font-semibold text-gray-900">{b.billNo}</td>
                        <td className="py-1.5 px-2.5 text-center text-gray-600">{b.billDate}</td>
                        <td className="py-1.5 px-2.5 text-right font-medium text-gray-900">
                          {formatPrice(b.billAmount)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-bold text-amber-950">
                          {formatPrice(b.pendingAmount)}
                        </td>
                        <td className="py-1.5 px-2.5 text-center text-gray-600">{b.days ?? 0}</td>
                        <td className="py-1.5 px-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemovePendingBill(idx)}
                            className="text-gray-400 hover:text-red-600 p-1 rounded transition"
                            title="Remove from print"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Summary Row */}
                    <tr className="bg-amber-50/70 font-bold text-gray-900 border-t border-amber-200">
                      <td className="py-1.5 px-2.5">Total</td>
                      <td className="py-1.5 px-2.5 font-black">{pendingBills.length} Bills</td>
                      <td className="py-1.5 px-2.5"></td>
                      <td className="py-1.5 px-2.5 text-right">
                        {formatPrice(pendingBills.reduce((s, b) => s + b.billAmount, 0))}
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-amber-950 font-black">
                        {formatPrice(pendingBills.reduce((s, b) => s + b.pendingAmount, 0))}
                      </td>
                      <td className="py-1.5 px-2.5 text-center">
                        Max {Math.max(...pendingBills.map((b) => b.days || 0), 0)}
                      </td>
                      <td></td>
                    </tr>
                    {/* Including This Bill Row */}
                    <tr className="bg-blue-50/80 font-black text-blue-950">
                      <td colSpan={2} className="py-1.5 px-2.5">
                        Including this Bill
                      </td>
                      <td className="py-1.5 px-2.5 text-center">{pendingBills.length + 1} Bills</td>
                      <td className="py-1.5 px-2.5 text-right">
                        {formatPrice(
                          pendingBills.reduce((s, b) => s + b.billAmount, 0) + netPayable
                        )}
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-blue-900 font-black">
                        {formatPrice(
                          pendingBills.reduce((s, b) => s + b.pendingAmount, 0) +
                            (paymentMethod === "credit" ? netPayable : 0)
                        )}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Product Scanner & Lookup */}
          <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-blue-700" />
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                  2. Product Search &amp; Barcode Scanner
                </h2>
              </div>
              <span className="text-[11px] text-gray-400">
                Scans automatically verify GST %
              </span>
            </div>

            <div className="relative">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 h-4 w-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Scan barcode or type product name (e.g. Parle-G, Fortune Oil, Basmati Rice)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border-2 border-blue-200 bg-blue-50/20 py-3 pl-10 pr-4 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Product Suggestion Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl p-1.5 space-y-1">
                  {searchResults.map((p) => {
                    const gst = Number(p.gst_percentage ?? 0);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProduct(p)}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-blue-50/60 transition flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-xs sm:text-sm text-gray-900 group-hover:text-blue-700 truncate">
                            {p.name}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Barcode: {p.barcode || "—"} &bull; Unit: {p.unit || "pcs"} &bull; Stock:{" "}
                            <span className={cn(p.stock <= 5 ? "text-amber-600 font-bold" : "text-gray-600")}>
                              {p.stock}
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-black border",
                              gst === 0
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : "bg-blue-100 text-blue-800 border-blue-300"
                            )}
                          >
                            {gst}% GST
                          </span>
                          <span className="font-black text-sm text-blue-950">
                            {formatPrice(p.selling_price || p.price)}
                          </span>
                          <span className="rounded-lg bg-blue-700 p-1 text-white opacity-0 group-hover:opacity-100 transition">
                            <Plus className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Line Items Table */}
          <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-blue-700" />
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                  3. Line Items &amp; Verified Product GST ({lines.length} items)
                </h2>
              </div>
              {lines.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLines([])}
                  className="text-xs font-bold text-red-600 hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {lines.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <FileText className="mx-auto h-12 w-12 text-gray-200 stroke-[1]" />
                <p className="mt-2 text-sm font-semibold text-gray-600">
                  No products added yet
                </p>
                <p className="text-xs text-gray-400">
                  Scan barcode or search above to add items with verified GST rates
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-2">#</th>
                      <th className="py-2.5 px-2 min-w-44">Product &amp; HSN</th>
                      <th className="py-2.5 px-2 text-center">Qty</th>
                      <th className="py-2.5 px-2 text-right">Rate (₹)</th>
                      <th className="py-2.5 px-2 text-right">MRP (₹)</th>
                      <th className="py-2.5 px-2 text-right">Dis %</th>
                      <th className="py-2.5 px-2 text-center min-w-28">Verified GST %</th>
                      <th className="py-2.5 px-2 text-right">Taxable</th>
                      <th className="py-2.5 px-2 text-right">Tax (₹)</th>
                      <th className="py-2.5 px-2 text-right">Total (₹)</th>
                      <th className="py-2.5 px-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lines.map((l, idx) => {
                      const lineGross = Math.round(l.rate * l.quantity * 100) / 100;
                      const lineDisc =
                        l.discountPercent > 0
                          ? Math.round(lineGross * (l.discountPercent / 100) * 100) / 100
                          : 0;
                      const lineNet = Math.max(0, Math.round((lineGross - lineDisc) * 100) / 100);

                      const gst = l.gstPercentage;
                      const taxable =
                        gst > 0
                          ? Math.round((lineNet / (1 + gst / 100)) * 100) / 100
                          : lineNet;
                      const taxAmt =
                        gst > 0 ? Math.round((lineNet - taxable) * 100) / 100 : 0;

                      return (
                        <tr key={l.id} className="hover:bg-gray-50/70 transition">
                          <td className="py-2.5 px-2 font-mono text-gray-400 text-center">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-2">
                            <p className="font-bold text-gray-900 leading-tight">
                              {l.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-gray-400">HSN:</span>
                              <input
                                type="text"
                                value={l.hsnCode}
                                onChange={(e) => updateLine(l.id, { hsnCode: e.target.value })}
                                className="w-20 rounded border border-gray-200 px-1 py-0.2 text-[10px] font-mono focus:outline-none"
                              />
                              <span className="text-[10px] text-gray-400">({l.unit})</span>
                            </div>
                          </td>

                          {/* Qty */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={l.quantity}
                              onChange={(e) =>
                                updateLine(l.id, {
                                  quantity: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                              className="w-14 rounded-lg border border-gray-200 p-1 text-center font-bold focus:border-blue-600 focus:outline-none"
                            />
                          </td>

                          {/* Rate */}
                          <td className="py-2.5 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={l.rate}
                              onChange={(e) =>
                                updateLine(l.id, {
                                  rate: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className="w-20 rounded-lg border border-gray-200 p-1 text-right font-semibold focus:border-blue-600 focus:outline-none"
                            />
                          </td>

                          {/* MRP */}
                          <td className="py-2.5 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={l.mrp}
                              onChange={(e) =>
                                updateLine(l.id, {
                                  mrp: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className="w-18 rounded-lg border border-gray-200 p-1 text-right text-gray-600 focus:outline-none"
                            />
                          </td>

                          {/* Discount % */}
                          <td className="py-2.5 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={l.discountPercent}
                              onChange={(e) =>
                                updateLine(l.id, {
                                  discountPercent: Math.min(
                                    100,
                                    Math.max(0, Number(e.target.value) || 0)
                                  ),
                                })
                              }
                              className="w-14 rounded-lg border border-gray-200 p-1 text-right font-medium focus:outline-none"
                            />
                          </td>

                          {/* Verified GST % Dropdown */}
                          <td className="py-2.5 px-2 text-center">
                            <select
                              value={l.gstPercentage}
                              onChange={(e) =>
                                updateLine(l.id, {
                                  gstPercentage: Number(e.target.value),
                                })
                              }
                              className={cn(
                                "rounded-lg border px-2 py-1 text-[11px] font-black focus:outline-none",
                                l.gstPercentage === 0
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                  : "bg-blue-50 text-blue-800 border-blue-300"
                              )}
                            >
                              {GST_SLABS.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Taxable Value */}
                          <td className="py-2.5 px-2 text-right font-medium text-gray-700">
                            {formatPrice(taxable)}
                          </td>

                          {/* Tax Amount */}
                          <td className="py-2.5 px-2 text-right font-semibold text-gray-700">
                            {formatPrice(taxAmt)}
                          </td>

                          {/* Line Net */}
                          <td className="py-2.5 px-2 text-right font-black text-blue-950">
                            {formatPrice(lineNet)}
                          </td>

                          {/* Remove */}
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeLine(l.id)}
                              className="text-gray-400 hover:text-red-600 transition p-1"
                              title="Delete row"
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
            )}
          </section>

          {/* 4. GST Slabs Verification Breakdown (User Requirement Highlight) */}
          <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                <h3 className="text-xs sm:text-sm font-black text-gray-900 uppercase tracking-wide">
                  Verified Product GST Breakdown (Tax Summary)
                </h3>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Product-level Tax Verification Active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-600 font-bold text-[10px] uppercase">
                    <th className="py-2 px-3 text-left">GST Rate Slab</th>
                    <th className="py-2 px-3 text-center">Item Count</th>
                    <th className="py-2 px-3 text-right">Taxable Value (₹)</th>
                    {!isInterState ? (
                      <>
                        <th className="py-2 px-3 text-right">SGST (₹)</th>
                        <th className="py-2 px-3 text-right">CGST (₹)</th>
                      </>
                    ) : (
                      <th className="py-2 px-3 text-right">IGST (₹)</th>
                    )}
                    <th className="py-2 px-3 text-right">Total Tax (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(gstSlabsBreakdown)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([pct, data]) => {
                      const slabNum = Number(pct);
                      return (
                        <tr key={pct} className="font-medium text-gray-800">
                          <td className="py-2 px-3">
                            <span
                              className={cn(
                                "inline-block rounded px-2 py-0.5 text-[10px] font-black border",
                                slabNum === 0
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-blue-100 text-blue-800 border-blue-300"
                              )}
                            >
                              {slabNum === 0 ? "0% (Exempt / Tax-Free)" : `${slabNum}% GST`}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">{data.count}</td>
                          <td className="py-2 px-3 text-right">{formatPrice(data.taxable)}</td>
                          {!isInterState ? (
                            <>
                              <td className="py-2 px-3 text-right">{formatPrice(data.sgst)}</td>
                              <td className="py-2 px-3 text-right">{formatPrice(data.cgst)}</td>
                            </>
                          ) : (
                            <td className="py-2 px-3 text-right">{formatPrice(data.igst)}</td>
                          )}
                          <td className="py-2 px-3 text-right font-bold text-gray-900">
                            {formatPrice(data.cgst + data.sgst + data.igst)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right 1 Column: Invoice Terms, Calculation & Action Buttons */}
        <div className="space-y-6">
          {/* Invoice Parameters */}
          <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
            <h2 className="text-xs font-black text-gray-900 uppercase tracking-wide border-b border-gray-100 pb-2">
              Invoice Settings
            </h2>

            <div>
              <label className="text-[11px] font-bold text-gray-600 block mb-1">
                Invoice / Bill Number (Optional)
              </label>
              <input
                type="text"
                value={customInvoiceNumber}
                onChange={(e) => setCustomInvoiceNumber(e.target.value)}
                placeholder="Leave blank to auto-generate"
                className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-mono uppercase focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-600 block mb-1">
                Invoice Date
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-semibold focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-600 block mb-1">
                Payment Terms / Mode
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PosPaymentMethod)}
                className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-semibold focus:border-blue-600 focus:outline-none"
              >
                <option value="cash">Cash Payment</option>
                <option value="credit">Credit (On Account / Khatabook)</option>
                <option value="upi">Online UPI / Bank Transfer</option>
                <option value="card">Card Payment</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-600 block mb-1">
                Vehicle No / Transporter
              </label>
              <input
                type="text"
                placeholder="e.g. GJ-15-XX-1234"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-mono uppercase focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-600 block mb-1">
                Invoice Remarks / Delivery Notes
              </label>
              <textarea
                rows={2}
                placeholder="Remarks printed on agency invoice..."
                value={billNotes}
                onChange={(e) => setBillNotes(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>
          </section>

          {/* Grand Total Calculation Card */}
          <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
            <h2 className="text-xs font-black text-gray-900 uppercase tracking-wide border-b border-gray-100 pb-2">
              Bill Calculation
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Gross Value</span>
                <span className="font-semibold text-gray-900">{formatPrice(grossTotal)}</span>
              </div>

              {itemDiscountsTotal > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Item Discounts</span>
                  <span>-{formatPrice(itemDiscountsTotal)}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                <span className="text-gray-600">Special Bill Discount (₹)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={billDiscount || ""}
                  onChange={(e) => setBillDiscount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-24 rounded-lg border border-gray-200 p-1 text-right text-xs font-bold focus:outline-none"
                />
              </div>

              <div className="flex justify-between text-gray-600 pt-1 border-t border-gray-100">
                <span>Taxable Amount</span>
                <span className="font-semibold text-gray-900">{formatPrice(taxableSubtotal)}</span>
              </div>

              {!isInterState ? (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>Total SGST (State Tax)</span>
                    <span className="font-semibold text-gray-900">{formatPrice(sgstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Total CGST (Central Tax)</span>
                    <span className="font-semibold text-gray-900">{formatPrice(cgstTotal)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-gray-600">
                  <span>Total IGST (Integrated Tax)</span>
                  <span className="font-semibold text-gray-900">{formatPrice(igstTotal)}</span>
                </div>
              )}

              {roundOff !== 0 && (
                <div className="flex justify-between text-gray-400">
                  <span>Round Off</span>
                  <span>{roundOff > 0 ? `+${roundOff.toFixed(2)}` : roundOff.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-black text-gray-900">Total Payable</span>
                <span className="text-2xl font-black text-blue-950">
                  {formatPrice(netPayable)}
                </span>
              </div>
            </div>

            {/* Party Balance Ledger Preview */}
            {(partyBalance !== 0 || paymentMethod === "credit" || selectedCustomer) && (
              <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-blue-800">
                  <span>Party Prev. Balance</span>
                  <span className="font-semibold">{formatPrice(partyBalance)}</span>
                </div>
                <div className="flex justify-between text-blue-800">
                  <span>Current Bill</span>
                  <span className="font-semibold">{formatPrice(netPayable)}</span>
                </div>
                <div className="flex justify-between text-blue-950 font-bold border-t border-blue-200/60 pt-1.5">
                  <span>Party Net Balance ({paymentMethod === "credit" ? "Credit Due" : "Settled"})</span>
                  <span className="text-sm font-black">
                    {formatPrice(paymentMethod === "credit" ? partyBalance + netPayable : partyBalance)}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <Button
                type="button"
                className="w-full font-bold shadow-md bg-blue-700 hover:bg-blue-800 text-white gap-2 py-3"
                loading={saving}
                onClick={() => handleSaveBill(true)}
              >
                <Printer className="h-4 w-4" />
                <span>Save &amp; Print Agency GST Invoice</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full font-bold border-gray-200 text-gray-700 hover:bg-gray-50 py-2.5"
                loading={saving}
                onClick={() => handleSaveBill(false)}
              >
                <Save className="h-4 w-4" />
                <span>Save Bill Only (No Print)</span>
              </Button>
            </div>
          </section>

          {/* Bank Details Verification */}
          {settings && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 text-xs space-y-1.5 text-gray-600">
              <div className="font-bold text-gray-900 flex items-center gap-1.5 mb-1">
                <Building2 className="h-3.5 w-3.5 text-blue-700" />
                <span>Printed Bank Details (On Invoice)</span>
              </div>
              <p>
                <b>Bank:</b> {settings.bank_name || "TAMILNAD MERCANTILE BANK LTD"}
              </p>
              <p>
                <b>A/C No:</b> {settings.bank_account_no || "391700050900006"}
              </p>
              <p>
                <b>IFSC:</b> {settings.bank_ifsc || "TMBL0000391"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 5. Recent Agency Bills History Table */}
      {recentAgencySales.length > 0 && (
        <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-blue-700" />
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                Recent Bills (Quick Reprint Agency Invoice)
              </h3>
            </div>
            <Link
              href="/admin/sales-history"
              className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"
            >
              <span>View All in Sales History</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                  <th className="py-2 px-2">Bill No</th>
                  <th className="py-2 px-2">Date &amp; Time</th>
                  <th className="py-2 px-2">Buyer / Customer</th>
                  <th className="py-2 px-2">Payment</th>
                  <th className="py-2 px-2 text-right">Amount</th>
                  <th className="py-2 px-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentAgencySales.slice(0, 5).map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50 transition">
                    <td className="py-2.5 px-2 font-mono font-bold text-blue-900">
                      {sale.bill_number}
                    </td>
                    <td className="py-2.5 px-2 text-gray-500">
                      {new Date(sale.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 px-2 font-medium text-gray-900">
                      {sale.customer_name || "Walk-in Buyer"}
                    </td>
                    <td className="py-2.5 px-2 uppercase font-semibold text-gray-600">
                      {sale.payment_method}
                    </td>
                    <td className="py-2.5 px-2 text-right font-black text-blue-950">
                      {formatPrice(sale.total_amount)}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs font-bold gap-1 text-blue-700 border-blue-200 hover:bg-blue-50"
                        onClick={() => handleReprintSale(sale)}
                      >
                        <Printer className="h-3 w-3" />
                        <span>Print Agency GST Bill</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal: Add Manual Pending Bill */}
      {showAddPendingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Add Previous Pending Bill</h3>
              <button
                type="button"
                onClick={() => setShowAddPendingModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Book / Prefix (Optional)</label>
                <input
                  type="text"
                  value={manualPendingBook}
                  onChange={(e) => setManualPendingBook(e.target.value)}
                  placeholder="e.g. Series or Book (Optional)"
                  className="w-full rounded-lg border border-gray-200 p-2 font-mono uppercase"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Bill No *</label>
                <input
                  type="text"
                  value={manualPendingBillNo}
                  onChange={(e) => setManualPendingBillNo(e.target.value)}
                  placeholder="e.g. Bill Number"
                  className="w-full rounded-lg border border-gray-200 p-2"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Bill Date (DD/MM/YYYY)</label>
                <input
                  type="text"
                  value={manualPendingBillDate}
                  onChange={(e) => setManualPendingBillDate(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="w-full rounded-lg border border-gray-200 p-2"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Days</label>
                <input
                  type="number"
                  value={manualPendingDays}
                  onChange={(e) => setManualPendingDays(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-200 p-2"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Bill Amount (₹) *</label>
                <input
                  type="number"
                  value={manualPendingBillAmt}
                  onChange={(e) => {
                    setManualPendingBillAmt(e.target.value);
                    if (!manualPendingBalAmt) setManualPendingBalAmt(e.target.value);
                  }}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-200 p-2"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Pending Amount (₹) *</label>
                <input
                  type="number"
                  value={manualPendingBalAmt}
                  onChange={(e) => setManualPendingBalAmt(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-200 p-2 font-bold text-amber-900"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddPendingModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                onClick={handleAddManualPendingBill}
              >
                Add Pending Bill
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { createClient } from "@/lib/supabase/client";
import type { PurchaseBill, PurchaseItem } from "@/types/erp";
import { lineItemGst } from "@/utils/gst";

export const purchaseService = {
  async list(): Promise<PurchaseBill[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("purchase_bills")
      .select("*, suppliers(*), purchase_items(*, products(name, sku))")
      .order("invoice_date", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PurchaseBill[];
  },

  async getById(id: string): Promise<PurchaseBill | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("purchase_bills")
      .select("*, suppliers(*), purchase_items(*, products(*))")
      .eq("id", id)
      .single();
    if (error) return null;
    return data as PurchaseBill;
  },

  async create(params: {
    billNumber: string;
    invoiceDate: string;
    supplierId: string;
    items: {
      productId: string;
      barcode?: string;
      quantity: number;
      purchaseRate: number;
      gstPercentage: number;
      batchNumber?: string;
      expiryDate?: string;
    }[];
    notes?: string;
    invoicePdfUrl?: string;
  }): Promise<PurchaseBill> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    const lineRows: Omit<PurchaseItem, "id" | "purchase_bill_id">[] = [];

    for (const item of params.items) {
      const gst = lineItemGst(
        item.purchaseRate,
        item.quantity,
        item.gstPercentage
      );
      subtotal += item.purchaseRate * item.quantity;
      cgst += gst.cgst;
      sgst += gst.sgst;
      lineRows.push({
        product_id: item.productId,
        barcode: item.barcode ?? null,
        quantity: item.quantity,
        purchase_rate: item.purchaseRate,
        gst_percentage: item.gstPercentage,
        gst_amount: gst.totalGst,
        total_amount: gst.totalWithGst,
        batch_number: item.batchNumber ?? null,
        expiry_date: item.expiryDate ?? null,
      } as PurchaseItem);
    }

    const total = Math.round((subtotal + cgst + sgst) * 100) / 100;

    const { data: bill, error: billErr } = await supabase
      .from("purchase_bills")
      .insert({
        bill_number: params.billNumber,
        invoice_date: params.invoiceDate,
        supplier_id: params.supplierId,
        subtotal,
        cgst,
        sgst,
        igst: 0,
        total_amount: total,
        notes: params.notes ?? null,
        invoice_pdf_url: params.invoicePdfUrl ?? null,
        created_by: user?.id ?? null,
      })
      .select("*")
      .single();
    if (billErr) throw billErr;

    const billId = (bill as PurchaseBill).id;
    const { error: itemsErr } = await supabase.from("purchase_items").insert(
      lineRows.map((r) => ({ ...r, purchase_bill_id: billId }))
    );
    if (itemsErr) throw itemsErr;

    await supabase
      .from("suppliers")
      .update({
        outstanding_amount: total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.supplierId);

    return this.getById(billId) as Promise<PurchaseBill>;
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const bill = await this.getById(id);
    if (!bill?.purchase_items) return;
    const { error } = await supabase.from("purchase_bills").delete().eq("id", id);
    if (error) throw error;
  },

  async uploadInvoice(file: File, billId: string): Promise<string> {
    const supabase = createClient();
    const path = `purchases/${billId}/${file.name}`;
    const { error } = await supabase.storage
      .from("erp-documents")
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("erp-documents").getPublicUrl(path);
    const url = data.publicUrl;
    await supabase
      .from("purchase_bills")
      .update({ invoice_pdf_url: url })
      .eq("id", billId);
    return url;
  },
};

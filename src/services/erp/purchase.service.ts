import { createClient } from "@/lib/supabase/client";
import type { PurchaseBill } from "@/types/erp";
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
      lotNumber?: string;
      quantity: number;
      purchaseRate: number;
      sellingPrice?: number;
      mrp?: number;
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
    const lineRows: Record<string, unknown>[] = [];

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
        lot_number: item.lotNumber ?? null,
        quantity: item.quantity,
        purchase_rate: item.purchaseRate,
        selling_price: item.sellingPrice ?? null,
        mrp: item.mrp ?? null,
        gst_percentage: item.gstPercentage,
        gst_amount: gst.totalGst,
        total_amount: gst.totalWithGst,
        batch_number: item.batchNumber ?? null,
        expiry_date: item.expiryDate ?? null,
      });
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

    const { data: supplier } = await supabase
      .from("suppliers")
      .select("outstanding_amount")
      .eq("id", params.supplierId)
      .single();

    await supabase
      .from("suppliers")
      .update({
        outstanding_amount: Number(supplier?.outstanding_amount ?? 0) + total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.supplierId);

    return this.getById(billId) as Promise<PurchaseBill>;
  },

  async updateBill(params: {
    billId: string;
    supplierId?: string;
    invoiceDate?: string;
    billNumber?: string;
    itemId: string;
    productId?: string;
    barcode?: string;
    lotNumber?: string;
    batchNumber?: string;
    expiryDate?: string;
    quantity?: number;
    purchaseRate?: number;
    sellingPrice?: number;
    mrp?: number;
    gstPercentage?: number;
  }): Promise<PurchaseBill> {
    const supabase = createClient();
    const bill = await this.getById(params.billId);
    if (!bill?.purchase_items?.length) throw new Error("Purchase not found");

    const item = bill.purchase_items.find((i) => i.id === params.itemId);
    if (!item) throw new Error("Purchase item not found");

    const oldQty = item.quantity;
    const newQty = params.quantity ?? oldQty;
    const qtyDiff = newQty - oldQty;

    if (qtyDiff !== 0) {
      await supabase.rpc("apply_stock_movement", {
        p_product_id: params.productId ?? item.product_id,
        p_quantity: qtyDiff,
        p_movement_type: "adjustment",
        p_reference_type: "purchase_bill",
        p_reference_id: params.billId,
        p_notes: `Purchase edit qty ${oldQty} → ${newQty}`,
      });

      const { data: lot } = await supabase
        .from("product_lots")
        .select("id, current_stock")
        .eq("purchase_item_id", item.id)
        .maybeSingle();

      if (lot) {
        await supabase.rpc("apply_lot_stock_movement", {
          p_lot_id: lot.id,
          p_quantity: qtyDiff,
          p_movement_type: "adjustment",
          p_reference_type: "purchase_bill",
          p_reference_id: params.billId,
          p_notes: `Purchase edit qty ${oldQty} → ${newQty}`,
        });
      }
    }

    const purchaseRate = params.purchaseRate ?? item.purchase_rate;
    const gstPct = params.gstPercentage ?? item.gst_percentage;
    const gst = lineItemGst(purchaseRate, newQty, gstPct);

    await supabase
      .from("purchase_items")
      .update({
        product_id: params.productId ?? item.product_id,
        barcode: params.barcode ?? item.barcode,
        lot_number: params.lotNumber ?? item.lot_number,
        batch_number: params.batchNumber ?? item.batch_number,
        expiry_date: params.expiryDate ?? item.expiry_date,
        quantity: newQty,
        purchase_rate: purchaseRate,
        selling_price: params.sellingPrice ?? item.selling_price,
        mrp: params.mrp ?? item.mrp,
        gst_percentage: gstPct,
        gst_amount: gst.totalGst,
        total_amount: gst.totalWithGst,
      })
      .eq("id", params.itemId);

    const { data: lotRow } = await supabase
      .from("product_lots")
      .select("id")
      .eq("purchase_item_id", item.id)
      .maybeSingle();

    if (lotRow) {
      await supabase
        .from("product_lots")
        .update({
          product_id: params.productId ?? item.product_id,
          barcode: params.barcode ?? item.barcode ?? undefined,
          lot_number: params.lotNumber ?? item.lot_number,
          batch_number: params.batchNumber ?? item.batch_number,
          expiry_date: params.expiryDate ?? item.expiry_date,
          purchase_price: purchaseRate,
          selling_price: params.sellingPrice ?? item.selling_price,
          mrp: params.mrp ?? item.mrp,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lotRow.id);
    }

    const billUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (params.supplierId) billUpdates.supplier_id = params.supplierId;
    if (params.invoiceDate) billUpdates.invoice_date = params.invoiceDate;
    if (params.billNumber) billUpdates.bill_number = params.billNumber;

    if (Object.keys(billUpdates).length > 1) {
      await supabase.from("purchase_bills").update(billUpdates).eq("id", params.billId);
    }

    const updated = await this.getById(params.billId);
    if (updated?.purchase_items) {
      let subtotal = 0;
      let cgst = 0;
      let sgst = 0;
      for (const li of updated.purchase_items) {
        subtotal += li.purchase_rate * li.quantity;
        const g = lineItemGst(li.purchase_rate, li.quantity, li.gst_percentage);
        cgst += g.cgst;
        sgst += g.sgst;
      }
      const total = Math.round((subtotal + cgst + sgst) * 100) / 100;
      await supabase
        .from("purchase_bills")
        .update({ subtotal, cgst, sgst, total_amount: total })
        .eq("id", params.billId);
    }

    return this.getById(params.billId) as Promise<PurchaseBill>;
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const bill = await this.getById(id);
    if (!bill) return;

    const { error } = await supabase.from("purchase_bills").delete().eq("id", id);
    if (error) throw error;

    if (bill.supplier_id) {
      const { data: supplier } = await supabase
        .from("suppliers")
        .select("outstanding_amount")
        .eq("id", bill.supplier_id)
        .single();
      await supabase
        .from("suppliers")
        .update({
          outstanding_amount: Math.max(
            0,
            Number(supplier?.outstanding_amount ?? 0) - Number(bill.total_amount)
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bill.supplier_id);
    }
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

  async getSupplierHistory(supplierId: string): Promise<PurchaseBill[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("purchase_bills")
      .select("*, purchase_items(*, products(name))")
      .eq("supplier_id", supplierId)
      .order("invoice_date", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PurchaseBill[];
  },
};

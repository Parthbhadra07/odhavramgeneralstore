import { createClient } from "@/lib/supabase/client";
import type {
  PurchaseReturn,
  PurchaseReturnItem,
  PurchaseReturnReason,
} from "@/types/erp";

function clientReturnNumber(): string {
  const year = new Date().getFullYear();
  return `PR-${year}-${Date.now().toString().slice(-6)}`;
}

export const purchaseReturnService = {
  async generateNumber(): Promise<string> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("generate_return_number", {
      p_prefix: "PR",
    });
    if (error) return clientReturnNumber();
    return data as string;
  },

  async list(): Promise<PurchaseReturn[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("purchase_returns")
      .select(
        "*, suppliers(*), purchase_bills(bill_number), purchase_return_items(*)"
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PurchaseReturn[];
  },

  async getById(id: string): Promise<PurchaseReturn | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("purchase_returns")
      .select(
        "*, suppliers(*), purchase_bills(bill_number), purchase_return_items(*)"
      )
      .eq("id", id)
      .single();
    if (error) return null;
    return data as PurchaseReturn;
  },

  async create(params: {
    supplierId: string;
    purchaseBillId?: string;
    returnDate: string;
    reason: PurchaseReturnReason;
    reasonNotes?: string;
    notes?: string;
    items: {
      productId: string;
      productName: string;
      lotId?: string;
      purchaseItemId?: string;
      barcode?: string;
      lotNumber?: string;
      batchNumber?: string;
      quantity: number;
      purchaseRate: number;
    }[];
  }): Promise<PurchaseReturn> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const returnNumber = await this.generateNumber();
    const totalAmount = params.items.reduce(
      (s, i) => s + i.purchaseRate * i.quantity,
      0
    );

    const { data: ret, error: retErr } = await supabase
      .from("purchase_returns")
      .insert({
        return_number: returnNumber,
        supplier_id: params.supplierId,
        purchase_bill_id: params.purchaseBillId ?? null,
        return_date: params.returnDate,
        reason: params.reason,
        reason_notes: params.reasonNotes ?? null,
        total_amount: totalAmount,
        notes: params.notes ?? null,
        created_by: user?.id ?? null,
      })
      .select("*")
      .single();
    if (retErr) throw retErr;

    const returnId = (ret as PurchaseReturn).id;
    const itemRows: Omit<PurchaseReturnItem, "id">[] = params.items.map((i) => ({
      purchase_return_id: returnId,
      product_id: i.productId,
      lot_id: i.lotId ?? null,
      purchase_item_id: i.purchaseItemId ?? null,
      product_name: i.productName,
      barcode: i.barcode ?? null,
      lot_number: i.lotNumber ?? null,
      batch_number: i.batchNumber ?? null,
      quantity: i.quantity,
      purchase_rate: i.purchaseRate,
      total_amount: i.purchaseRate * i.quantity,
    }));

    const { error: itemsErr } = await supabase
      .from("purchase_return_items")
      .insert(itemRows);
    if (itemsErr) throw itemsErr;

    return this.getById(returnId) as Promise<PurchaseReturn>;
  },

  async update(params: {
    returnId: string;
    itemId: string;
    supplierId?: string;
    purchaseBillId?: string | null;
    returnDate?: string;
    reason?: PurchaseReturnReason;
    reasonNotes?: string | null;
    productId?: string;
    productName?: string;
    lotId?: string | null;
    barcode?: string | null;
    lotNumber?: string | null;
    batchNumber?: string | null;
    quantity?: number;
    purchaseRate?: number;
  }): Promise<PurchaseReturn> {
    const supabase = createClient();
    const existing = await this.getById(params.returnId);
    if (!existing?.purchase_return_items?.length) throw new Error("Return not found");

    const oldItem = existing.purchase_return_items.find((i) => i.id === params.itemId);
    if (!oldItem) throw new Error("Return item not found");

    const newProductId = params.productId ?? oldItem.product_id;
    const newLotId = params.lotId !== undefined ? params.lotId : oldItem.lot_id;
    const newQty = params.quantity ?? oldItem.quantity;
    const newRate = params.purchaseRate ?? oldItem.purchase_rate;
    const newTotal = newRate * newQty;

    // Reverse previous stock deduction (add stock back)
    await supabase.rpc("apply_stock_movement", {
      p_product_id: oldItem.product_id,
      p_quantity: oldItem.quantity,
      p_movement_type: "adjustment",
      p_reference_type: "purchase_return",
      p_reference_id: params.returnId,
      p_notes: `Purchase return edit — reverse ${oldItem.quantity} units`,
    });
    if (oldItem.lot_id) {
      await supabase.rpc("apply_lot_stock_movement", {
        p_lot_id: oldItem.lot_id,
        p_quantity: oldItem.quantity,
        p_movement_type: "adjustment",
        p_reference_type: "purchase_return",
        p_reference_id: params.returnId,
        p_notes: "Purchase return edit — reverse lot deduction",
      });
    }

    // Apply updated stock deduction
    await supabase.rpc("apply_stock_movement", {
      p_product_id: newProductId,
      p_quantity: -newQty,
      p_movement_type: "adjustment",
      p_reference_type: "purchase_return",
      p_reference_id: params.returnId,
      p_notes: `Purchase return edit — deduct ${newQty} units`,
    });
    if (newLotId) {
      await supabase.rpc("apply_lot_stock_movement", {
        p_lot_id: newLotId,
        p_quantity: -newQty,
        p_movement_type: "adjustment",
        p_reference_type: "purchase_return",
        p_reference_id: params.returnId,
        p_notes: "Purchase return edit — lot deduction",
      });
    }

    await supabase
      .from("purchase_return_items")
      .update({
        product_id: newProductId,
        lot_id: newLotId,
        product_name: params.productName ?? oldItem.product_name,
        barcode: params.barcode !== undefined ? params.barcode : oldItem.barcode,
        lot_number: params.lotNumber !== undefined ? params.lotNumber : oldItem.lot_number,
        batch_number: params.batchNumber !== undefined ? params.batchNumber : oldItem.batch_number,
        quantity: newQty,
        purchase_rate: newRate,
        total_amount: newTotal,
      })
      .eq("id", params.itemId);

    const headerUpdates: Record<string, unknown> = {
      total_amount: newTotal,
    };
    if (params.supplierId) headerUpdates.supplier_id = params.supplierId;
    if (params.purchaseBillId !== undefined) headerUpdates.purchase_bill_id = params.purchaseBillId;
    if (params.returnDate) headerUpdates.return_date = params.returnDate;
    if (params.reason) headerUpdates.reason = params.reason;
    if (params.reasonNotes !== undefined) headerUpdates.reason_notes = params.reasonNotes;

    await supabase.from("purchase_returns").update(headerUpdates).eq("id", params.returnId);

    return this.getById(params.returnId) as Promise<PurchaseReturn>;
  },

  async getBySupplier(supplierId: string): Promise<PurchaseReturn[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("purchase_returns")
      .select("*, purchase_return_items(*)")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PurchaseReturn[];
  },
};

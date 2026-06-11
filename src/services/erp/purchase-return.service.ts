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

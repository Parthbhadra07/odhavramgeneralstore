import { requireClient } from "@/lib/supabase/client";
import { inventoryService } from "@/services/erp/inventory.service";
import type { Product } from "@/types/database";

export interface AutoRefillResult {
  productId: string;
  productName: string;
  slot: 1 | 2;
  slotLabel: string;
  quantityAdded: number;
  newStock?: number;
  time: string;
}

function getLocalTodayDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalCurrentTime(): string {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

let isProcessing = false;

export const autoRefillService = {
  /**
   * Process daily auto-refills for both Morning (Slot 1) and Afternoon (Slot 2).
   * Safe to call repeatedly; each product slot is processed at most once per calendar day.
   */
  async processDailyAutoRefills(): Promise<AutoRefillResult[]> {
    if (isProcessing) return [];
    isProcessing = true;

    const results: AutoRefillResult[] = [];
    const todayDate = getLocalTodayDate();
    const currentTime = getLocalCurrentTime();

    try {
      const supabase = requireClient();

      // 1. Try PostgreSQL stored procedure first
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc(
          "process_daily_auto_refills",
          {
            p_current_time: currentTime,
            p_today_date: todayDate,
          }
        );

        if (!rpcErr && rpcRes && rpcRes.refilled && Array.isArray(rpcRes.refilled)) {
          for (const item of rpcRes.refilled) {
            results.push({
              productId: item.id,
              productName: item.name,
              slot: item.slot === 2 ? 2 : 1,
              slotLabel: item.slot === 2 ? "Afternoon / Evening" : "Morning",
              quantityAdded: Number(item.added || 0),
              newStock: item.new_stock,
              time: currentTime,
            });
          }
          return results;
        }
      } catch {
        // Fall back to client-side logic below if RPC not available
      }

      // 2. Client-side processing fallback
      const { data: products, error } = await supabase
        .from("products")
        .select("*")
        .neq("is_active", false)
        .or("auto_refill_enabled.eq.true,auto_refill_slot2_enabled.eq.true");

      if (error || !products) return [];

      for (const p of products as Product[]) {
        // --- SLOT 1 (Morning Batch) ---
        if (
          p.auto_refill_enabled &&
          (p.auto_refill_quantity ?? 0) > 0
        ) {
          const slot1Time = (p.auto_refill_time?.trim() || "06:00");
          const slot1AlreadyRefilled = p.last_auto_refilled_date === todayDate;

          if (!slot1AlreadyRefilled && currentTime >= slot1Time) {
            const addQty = Number(p.auto_refill_quantity);
            const notes = `Daily Auto-Refill (Morning Slot 1: +${addQty} ${p.unit || "pcs"})`;

            try {
              let newStock = (p.stock || 0) + addQty;
              try {
                newStock = await inventoryService.adjustStock(
                  p.id,
                  addQty,
                  notes,
                  "adjustment"
                );
              } catch {
                // Direct fallback update if adjustStock RPC fails
                const { data: updated } = await supabase
                  .from("products")
                  .update({ stock: (p.stock || 0) + addQty })
                  .eq("id", p.id)
                  .select("stock")
                  .single();
                if (updated) newStock = updated.stock;
              }

              // Update last refilled date for slot 1
              await supabase
                .from("products")
                .update({ last_auto_refilled_date: todayDate })
                .eq("id", p.id);

              p.last_auto_refilled_date = todayDate;
              p.stock = newStock;

              results.push({
                productId: p.id,
                productName: p.name,
                slot: 1,
                slotLabel: "Morning",
                quantityAdded: addQty,
                newStock,
                time: currentTime,
              });
            } catch (err) {
              console.error(`Failed to auto-refill slot 1 for ${p.name}:`, err);
            }
          }
        }

        // --- SLOT 2 (Afternoon / Evening Batch) ---
        if (
          p.auto_refill_slot2_enabled &&
          (p.auto_refill_slot2_quantity ?? 0) > 0
        ) {
          const slot2Time = (p.auto_refill_slot2_time?.trim() || "16:00");
          const slot2AlreadyRefilled = p.last_auto_refilled_slot2_date === todayDate;

          if (!slot2AlreadyRefilled && currentTime >= slot2Time) {
            const addQty = Number(p.auto_refill_slot2_quantity);
            const notes = `Daily Auto-Refill (Afternoon Slot 2: +${addQty} ${p.unit || "pcs"})`;

            try {
              let newStock = (p.stock || 0) + addQty;
              try {
                newStock = await inventoryService.adjustStock(
                  p.id,
                  addQty,
                  notes,
                  "adjustment"
                );
              } catch {
                const { data: updated } = await supabase
                  .from("products")
                  .update({ stock: (p.stock || 0) + addQty })
                  .eq("id", p.id)
                  .select("stock")
                  .single();
                if (updated) newStock = updated.stock;
              }

              // Update last refilled date for slot 2
              await supabase
                .from("products")
                .update({ last_auto_refilled_slot2_date: todayDate })
                .eq("id", p.id);

              p.last_auto_refilled_slot2_date = todayDate;
              p.stock = newStock;

              results.push({
                productId: p.id,
                productName: p.name,
                slot: 2,
                slotLabel: "Afternoon / Evening",
                quantityAdded: addQty,
                newStock,
                time: currentTime,
              });
            } catch (err) {
              console.error(`Failed to auto-refill slot 2 for ${p.name}:`, err);
            }
          }
        }
      }

      return results;
    } finally {
      isProcessing = false;
    }
  },

  /**
   * Manually trigger auto-refill immediately for a product or all products.
   * Useful for testing or when morning milk delivery arrives ahead of schedule.
   */
  async forceRunRefill(
    productId?: string,
    slot: 1 | 2 = 1
  ): Promise<AutoRefillResult[]> {
    const supabase = requireClient();
    let q = supabase.from("products").select("*").neq("is_active", false);
    if (productId) {
      q = q.eq("id", productId);
    } else {
      q = q.or("auto_refill_enabled.eq.true,auto_refill_slot2_enabled.eq.true");
    }

    const { data: products } = await q;
    if (!products) return [];

    const todayDate = getLocalTodayDate();
    const currentTime = getLocalCurrentTime();
    const results: AutoRefillResult[] = [];

    for (const p of products as Product[]) {
      const isSlot1 = slot === 1;
      const enabled = isSlot1 ? p.auto_refill_enabled : p.auto_refill_slot2_enabled;
      const addQty = Number(
        isSlot1 ? p.auto_refill_quantity : p.auto_refill_slot2_quantity
      );
      if (!enabled || addQty <= 0) continue;

      const slotLabel = isSlot1 ? "Morning" : "Afternoon / Evening";
      const notes = `Manual Daily Refill (${slotLabel} Slot ${slot}: +${addQty} ${p.unit || "pcs"})`;

      let newStock = (p.stock || 0) + addQty;
      try {
        newStock = await inventoryService.adjustStock(
          p.id,
          addQty,
          notes,
          "adjustment"
        );
      } catch {
        const { data: updated } = await supabase
          .from("products")
          .update({ stock: (p.stock || 0) + addQty })
          .eq("id", p.id)
          .select("stock")
          .single();
        if (updated) newStock = updated.stock;
      }

      const updateObj = isSlot1
        ? { last_auto_refilled_date: todayDate }
        : { last_auto_refilled_slot2_date: todayDate };

      await supabase.from("products").update(updateObj).eq("id", p.id);

      results.push({
        productId: p.id,
        productName: p.name,
        slot,
        slotLabel,
        quantityAdded: addQty,
        newStock,
        time: currentTime,
      });
    }

    return results;
  },
};

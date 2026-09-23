"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { autoRefillService } from "@/services/auto-refill.service";

/**
 * Background hook that checks and executes scheduled daily auto-refills
 * for morning and afternoon batches (milk, bread, dairy essentials).
 */
export function useDailyAutoRefill() {
  const isRunningRef = useRef(false);

  const runCheck = async (silent = true) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    try {
      const refilled = await autoRefillService.processDailyAutoRefills();
      if (refilled.length > 0) {
        if (refilled.length === 1) {
          const item = refilled[0];
          toast.success(
            `🥛 Daily Auto-Refill (${item.slotLabel}): Added +${item.quantityAdded} units to "${item.productName}"`,
            {
              description: item.newStock !== undefined ? `New stock: ${item.newStock}` : undefined,
              duration: 6000,
            }
          );
        } else {
          const summary = refilled
            .map((r) => `${r.productName} (+${r.quantityAdded})`)
            .join(", ");
          toast.success(
            `🥛 Daily Auto-Refill: Replenished ${refilled.length} products`,
            {
              description: summary.length > 80 ? `${summary.slice(0, 80)}...` : summary,
              duration: 6000,
            }
          );
        }
      } else if (!silent) {
        toast.info("Daily auto-refill check completed. All scheduled products are up to date.");
      }
    } catch (err) {
      if (!silent) {
        toast.error("Auto-refill check encountered an error");
      }
      console.error("Daily auto-refill error:", err);
    } finally {
      isRunningRef.current = false;
    }
  };

  useEffect(() => {
    // Initial check on mount
    void runCheck(true);

    // Periodic check every 60 seconds
    const interval = setInterval(() => {
      void runCheck(true);
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    checkNow: () => runCheck(false),
  };
}

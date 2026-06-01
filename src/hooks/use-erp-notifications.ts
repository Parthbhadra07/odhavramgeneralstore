"use client";

import { useEffect, useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.value = 0.12;
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    setTimeout(() => ctx.close(), 400);
  } catch {
    // autoplay blocked
  }
}

const TOAST_BY_TYPE: Record<string, { title: string; variant?: "default" | "warning" }> = {
  low_stock: { title: "Low Stock Alert", variant: "warning" },
  out_of_stock: { title: "Out of Stock", variant: "warning" },
  new_order: { title: "New Online Order" },
  pos_sale: { title: "New POS Sale" },
  new_customer: { title: "New Customer" },
};

export function useErpNotifications(onRefresh?: () => void) {
  const [unreadCount, setUnreadCount] = useState(0);

  const handlePayload = useCallback(
    (type: string, title: string, message?: string | null) => {
      playAlertSound();
      const meta = TOAST_BY_TYPE[type] ?? { title };
      if (meta.variant === "warning") {
        toast.warning(meta.title, { description: message ?? title, duration: 8000 });
      } else {
        toast.success(meta.title, { description: message ?? title, duration: 6000 });
      }
      setUnreadCount((c) => c + 1);
      onRefresh?.();
    },
    [onRefresh]
  );

  useEffect(() => {
    const supabase = createClient();

    const channels = [
      supabase
        .channel("erp-notifications")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications" },
          (payload) => {
            const n = payload.new as { type: string; title: string; message?: string };
            handlePayload(n.type, n.title, n.message);
          }
        )
        .subscribe(),
      supabase
        .channel("erp-pos-sales")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "pos_sales" },
          (payload) => {
            const s = payload.new as { bill_number?: string; total_amount?: number };
            handlePayload(
              "pos_sale",
              "New POS Sale",
              `${s.bill_number ?? "Bill"} — ₹${s.total_amount ?? 0}`
            );
          }
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach((ch) => void supabase.removeChannel(ch));
    };
  }, [handlePayload]);

  return { unreadCount, clearUnread: () => setUnreadCount(0) };
}

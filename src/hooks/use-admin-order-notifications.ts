"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

/** Realtime new-order alerts for admin dashboard */
export function useAdminOrderNotifications(onNewOrder?: () => void) {
  const [newOrderCount, setNewOrderCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        // Short beep via Web Audio (no external file needed)
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.15;
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
        setTimeout(() => ctx.close(), 300);
      } else {
        audioRef.current.currentTime = 0;
        void audioRef.current.play();
      }
    } catch {
      // Autoplay may be blocked until user interaction
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const order = payload.new as { order_number?: string; total_amount?: number };
          setNewOrderCount((c) => c + 1);
          playSound();
          toast.success("🔔 New Order Received", {
            description: `Order ID: ${order.order_number ?? "New"}`,
            duration: 8000,
          });
          onNewOrder?.();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [onNewOrder, playSound]);

  const clearCount = () => setNewOrderCount(0);

  return { newOrderCount, clearCount };
}

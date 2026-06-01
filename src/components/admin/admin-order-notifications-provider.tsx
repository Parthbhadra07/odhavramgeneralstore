"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  playNewOrderSound,
  unlockNotificationAudio,
} from "@/utils/notification-sound";

type RefreshCallback = () => void;

interface AdminOrderNotificationsContextValue {
  newOrderCount: number;
  clearCount: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  registerRefresh: (cb: RefreshCallback) => () => void;
}

const AdminOrderNotificationsContext =
  createContext<AdminOrderNotificationsContextValue | null>(null);

const SOUND_PREF_KEY = "ogs_admin_order_sound";

export function AdminOrderNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const refreshCallbacks = useRef(new Set<RefreshCallback>());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SOUND_PREF_KEY);
      if (stored === "0") setSoundEnabledState(false);
    } catch {
      // ignore
    }
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    try {
      localStorage.setItem(SOUND_PREF_KEY, enabled ? "1" : "0");
    } catch {
      // ignore
    }
    if (enabled) unlockNotificationAudio();
  }, []);

  const registerRefresh = useCallback((cb: RefreshCallback) => {
    refreshCallbacks.current.add(cb);
    return () => {
      refreshCallbacks.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    const unlock = () => unlockNotificationAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("admin-orders-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const order = payload.new as {
            order_number?: string;
            total_amount?: number;
            customer_name?: string;
          };
          setNewOrderCount((c) => c + 1);
          if (soundEnabled) playNewOrderSound();
          toast.success("New order received", {
            description: [
              order.order_number && `Order ${order.order_number}`,
              order.customer_name,
              order.total_amount != null && `₹${order.total_amount}`,
            ]
              .filter(Boolean)
              .join(" · "),
            duration: 10000,
          });
          refreshCallbacks.current.forEach((cb) => cb());
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [soundEnabled]);

  const clearCount = useCallback(() => setNewOrderCount(0), []);

  return (
    <AdminOrderNotificationsContext.Provider
      value={{
        newOrderCount,
        clearCount,
        soundEnabled,
        setSoundEnabled,
        registerRefresh,
      }}
    >
      {children}
    </AdminOrderNotificationsContext.Provider>
  );
}

export function useAdminOrderNotifications(onNewOrder?: () => void) {
  const ctx = useContext(AdminOrderNotificationsContext);
  if (!ctx) {
    throw new Error(
      "useAdminOrderNotifications must be used within AdminOrderNotificationsProvider"
    );
  }

  const { registerRefresh, ...rest } = ctx;

  useEffect(() => {
    if (!onNewOrder) return;
    return registerRefresh(onNewOrder);
  }, [onNewOrder, registerRefresh]);

  return rest;
}

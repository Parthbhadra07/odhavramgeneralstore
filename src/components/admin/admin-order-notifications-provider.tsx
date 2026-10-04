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
import {
  requestNotificationPermission,
  showOrderNotification,
} from "@/utils/browser-notifications";

type RefreshCallback = () => void;

interface AdminOrderNotificationsContextValue {
  newOrderCount: number;
  clearCount: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  registerRefresh: (cb: RefreshCallback) => void;
  testNotification: () => void;
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
  const notifiedOrderIds = useRef(new Set<string>());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SOUND_PREF_KEY);
      if (stored === "0") setSoundEnabledState(false);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void requestNotificationPermission();
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

  const triggerNewOrderAlert = useCallback(
    (order: {
      id?: string;
      order_number?: string;
      total_amount?: number;
      customer_name?: string;
    }) => {
      const orderId = order.id ?? order.order_number;
      if (!orderId) return;
      if (notifiedOrderIds.current.has(orderId)) return;
      notifiedOrderIds.current.add(orderId);

      setNewOrderCount((c) => c + 1);
      if (soundEnabled) playNewOrderSound(orderId);
      showOrderNotification(order);
      toast.success("🔔 New Online Order Received!", {
        description: [
          order.order_number ? `Order #${order.order_number}` : "New Order",
          order.customer_name || "Customer",
          order.total_amount != null ? `₹${Number(order.total_amount).toFixed(2)}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        duration: 12000,
      });
      refreshCallbacks.current.forEach((cb) => cb());
    },
    [soundEnabled]
  );

  const testNotification = useCallback(() => {
    unlockNotificationAudio();
    void requestNotificationPermission();
    playNewOrderSound(`test-${Date.now()}`);
    showOrderNotification({
      id: `test-${Date.now()}`,
      order_number: "TEST-001",
      customer_name: "Test Customer",
      total_amount: 999,
    });
    toast.success("Test notification sent", {
      description: "Sound and browser notification triggered",
    });
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

  // Listen to in-window custom order event (e.g. from checkout or POS online account)
  useEffect(() => {
    const handleOrderEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        triggerNewOrderAlert(detail);
      }
    };
    window.addEventListener("new-order-received", handleOrderEvent);
    return () => window.removeEventListener("new-order-received", handleOrderEvent);
  }, [triggerNewOrderAlert]);

  // Listen to orders-marked-seen to instantly clear unread badge counter
  useEffect(() => {
    const handleMarkedSeen = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.orderId) {
        setNewOrderCount(0);
      } else {
        setNewOrderCount((c) => Math.max(0, c - 1));
      }
    };
    window.addEventListener("orders-marked-seen", handleMarkedSeen);
    return () => window.removeEventListener("orders-marked-seen", handleMarkedSeen);
  }, []);

  // Realtime Supabase Channel subscriptions + Periodic 10-second polling fallback
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let initialSeeded = false;

    // Seed existing received order IDs so we only alert on truly new incoming orders
    const seedExisting = async () => {
      try {
        const { data } = await supabase
          .from("orders")
          .select("id, order_number")
          .order("created_at", { ascending: false })
          .limit(20);
        if (data && !initialSeeded) {
          data.forEach((o) => {
            if (o.id) notifiedOrderIds.current.add(o.id);
            if (o.order_number) notifiedOrderIds.current.add(o.order_number);
          });
          initialSeeded = true;
        }
      } catch {}
    };
    void seedExisting();

    // 1. Realtime subscription for orders table
    const orderChannel = supabase
      .channel("admin-orders-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const order = payload.new as {
            id?: string;
            order_number?: string;
            total_amount?: number;
            customer_name?: string;
          };
          triggerNewOrderAlert(order);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const notif = payload.new as {
            type?: string;
            title?: string;
            message?: string;
            reference_id?: string;
          };
          if (notif.type === "new_order" && notif.reference_id) {
            triggerNewOrderAlert({
              id: notif.reference_id,
              customer_name: notif.title,
            });
          }
        }
      )
      .subscribe();

    // 2. Periodic polling fallback every 10 seconds: ensures notifications arrive even if Realtime drops
    const pollInterval = setInterval(async () => {
      try {
        const { data: newOrders } = await supabase
          .from("orders")
          .select("id, order_number, total_amount, customer_name, order_status, is_new, created_at")
          .eq("order_status", "received")
          .order("created_at", { ascending: false })
          .limit(5);

        if (Array.isArray(newOrders) && initialSeeded) {
          for (const ord of newOrders) {
            const id = ord.id ?? ord.order_number;
            if (id && !notifiedOrderIds.current.has(id)) {
              triggerNewOrderAlert(ord);
            }
          }
        }
      } catch {}
    }, 10000);

    return () => {
      clearInterval(pollInterval);
      void supabase.removeChannel(orderChannel);
    };
  }, [triggerNewOrderAlert]);

  const clearCount = useCallback(() => setNewOrderCount(0), []);

  return (
    <AdminOrderNotificationsContext.Provider
      value={{
        newOrderCount,
        clearCount,
        soundEnabled,
        setSoundEnabled,
        registerRefresh,
        testNotification,
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

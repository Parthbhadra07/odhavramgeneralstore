"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { isCapacitorNative } from "@/lib/capacitor";

/**
 * Native mobile behaviors: back button, pull-to-refresh, push registration, offline routing.
 */
export function CapacitorMobileProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const touchStartY = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    if (!isCapacitorNative()) return;

    let cancelled = false;
    const cleanups: (() => void)[] = [];

    const setup = async () => {
      const { App } = await import("@capacitor/app");
      const { SplashScreen } = await import("@capacitor/splash-screen");
      const { StatusBar, Style } = await import("@capacitor/status-bar");
      const { Network } = await import("@capacitor/network");
      const { PushNotifications } = await import("@capacitor/push-notifications");

      if (cancelled) return;

      await SplashScreen.hide().catch(() => {});

      try {
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: "#16a34a" });
      } catch {
        // iOS may not support background color
      }

      const backSub = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) {
          router.back();
          return;
        }
        if (pathname !== "/" && pathname !== "/index.html") {
          router.push("/");
          return;
        }
        App.exitApp();
      });
      cleanups.push(() => backSub.remove());

      const netSub = await Network.addListener("networkStatusChange", (status) => {
        if (!status.connected) {
          toast.message("You are offline", {
            description: "Cached products are still available.",
          });
        }
      });
      cleanups.push(() => netSub.remove());

      const status = await Network.getStatus();
      if (!status.connected && pathname !== "/offline") {
        router.push("/offline");
      }

      try {
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive === "granted") {
          await PushNotifications.register();
        }
        const regSub = await PushNotifications.addListener("registration", (token) => {
          console.info("[Push] device token:", token.value);
          // TODO: send token.value to your backend / Supabase for admin alerts
        });
        const errSub = await PushNotifications.addListener("registrationError", (err) => {
          console.warn("[Push] registration error:", err);
        });
        const pushSub = await PushNotifications.addListener(
          "pushNotificationReceived",
          (notification) => {
            toast.info(notification.title ?? "New notification", {
              description: notification.body,
            });
          }
        );
        cleanups.push(() => regSub.remove());
        cleanups.push(() => errSub.remove());
        cleanups.push(() => pushSub.remove());
      } catch {
        // Push not available on web / simulator without certs
      }
    };

    void setup();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [router, pathname]);

  useEffect(() => {
    if (!isCapacitorNative()) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 0) {
        touchStartY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchEnd = async (e: TouchEvent) => {
      if (!pulling.current) return;
      pulling.current = false;
      const delta = e.changedTouches[0].clientY - touchStartY.current;
      if (delta > 90 && window.scrollY <= 0) {
        toast.message("Refreshing…");
        window.location.reload();
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return <>{children}</>;
}

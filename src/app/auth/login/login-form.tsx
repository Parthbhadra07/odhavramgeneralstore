"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { loginSchema, type LoginInput } from "@/lib/validators";
import { authService } from "@/services/auth.service";
import { requestNotificationPermission } from "@/utils/browser-notifications";
import { isErpStaff } from "@/utils/roles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Leaf, WifiOff } from "lucide-react";
import type { User } from "@/types/database";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [hasCachedStaffProfile, setHasCachedStaffProfile] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    const update = () => setIsOffline(typeof navigator !== "undefined" && !navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    try {
      const cached = localStorage.getItem("ogs-offline-auth-profile");
      if (cached) {
        const p = JSON.parse(cached) as User;
        if (p && isErpStaff(p.role)) {
          setHasCachedStaffProfile(true);
        }
      }
    } catch {}

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const onSubmit = async (data: LoginInput) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("No internet connection.", {
        description: hasCachedStaffProfile
          ? "You can click 'Open POS Billing (Staff Offline Mode)' to bill offline."
          : "Please reconnect to the internet to sign in.",
      });
      return;
    }

    setLoading(true);
    try {
      const signInRes = await authService.signIn(data.email, data.password);
      const user = signInRes?.user;
      let targetRedirect = redirect;

      if (user) {
        const profile = await authService.getProfile(user.id);
        const isStaffUser = profile && isErpStaff(profile.role);

        if (!isStaffUser) {
          // If customer, clear any cached staff profile
          try {
            localStorage.removeItem("ogs-offline-auth-profile");
          } catch {}

          // Prevent customers from ever being routed to admin/POS pages
          if (targetRedirect.startsWith("/admin")) {
            targetRedirect = "/dashboard";
          }
        } else {
          // Cache staff profile for offline POS support
          try {
            localStorage.setItem("ogs-offline-auth-profile", JSON.stringify(profile));
          } catch {}
          void requestNotificationPermission();
          if (targetRedirect === "/dashboard") {
            targetRedirect = "/admin";
          }
        }
      }

      toast.success("Welcome back!");
      router.push(targetRedirect);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-green-600 text-white">
            <Leaf className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Sign In</h1>
          <p className="text-sm text-gray-600">Welcome to Odhavram General Store</p>
        </div>

        {isOffline && (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900 text-xs">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <WifiOff className="h-4 w-4 text-amber-600 shrink-0" />
              <span>You are currently Offline</span>
            </div>
            <p className="mt-1 text-amber-800 leading-relaxed">
              {hasCachedStaffProfile
                ? "Online login requires an internet connection. However, staff POS Billing works fully offline without logging in again."
                : "Online login requires an active internet connection. Please reconnect to your network to sign in."}
            </p>
            {hasCachedStaffProfile && (
              <Button
                href="/admin/pos"
                className="mt-2.5 w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-8"
              >
                Open POS Billing (Staff Offline Mode)
              </Button>
            )}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Email"
            type="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Password"
            type="password"
            error={errors.password?.message}
            {...register("password")}
          />
          <div className="text-right">
            <Link
              href="/auth/forgot-password"
              className="text-sm text-green-700 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Button type="submit" loading={loading} className="w-full">
            Sign In
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="font-medium text-green-700 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

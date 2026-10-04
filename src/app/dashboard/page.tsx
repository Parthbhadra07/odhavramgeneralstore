"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Send,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { profileSchema } from "@/lib/validators";
import { authService } from "@/services/auth.service";
import { orderService } from "@/services/order.service";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatPrice, formatDate } from "@/utils/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Order } from "@/types/database";

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [saving, setSaving] = useState(false);

  // Password change states
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [sendingResetLink, setSendingResetLink] = useState(false);
  const [resetResult, setResetResult] = useState<{
    directLink?: string;
    emailOtp?: string;
    sentEmail?: string;
  } | null>(null);

  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (user?.id) {
      orderService.getByUser(user.id).then((ords) => {
        setRecentOrders(ords.slice(0, 3));
      }).catch(() => {});
    }
  }, [user]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login?redirect=/dashboard");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (profile) {
      reset({
        name: profile.name ?? "",
        email: profile.email ?? user?.email ?? "",
        phone: profile.phone ?? "",
      });
    } else if (user) {
      reset({
        name: user.user_metadata?.name ?? "",
        email: user.email ?? "",
        phone: user.user_metadata?.phone ?? "",
      });
    } else {
      reset({ name: "", email: "", phone: "" });
    }
  }, [profile, user, reset]);

  const onSubmit = async (data: { name: string; email: string; phone?: string }) => {
    if (!user) return;
    setSaving(true);
    try {
      await authService.updateProfile(user.id, data);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setUpdatingPassword(true);
    try {
      await authService.updatePassword(newPassword);
      toast.success("Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password";
      toast.error(msg);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleSendResetEmail = async () => {
    const targetEmail = profile?.email || user?.email;
    if (!targetEmail) {
      toast.error("No email associated with this account");
      return;
    }

    setSendingResetLink(true);
    try {
      const res = await authService.resetPassword(targetEmail);
      setResetResult({
        directLink: res.directLink,
        emailOtp: res.emailOtp,
        sentEmail: targetEmail,
      });
      toast.success(
        res.directLink
          ? "Instant password reset link & OTP generated!"
          : "Password reset link sent to your email"
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to request reset";
      toast.error(msg);
    } finally {
      setSendingResetLink(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-gray-500">Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-gray-500">Redirecting to sign in...</p>
      </div>
    );
  }

  const isAdminOrStaff =
    profile?.role === "admin" ||
    profile?.role === "super_admin" ||
    profile?.role === "staff" ||
    profile?.role === "cashier";

  return (
    <div className="space-y-6">
      {isAdminOrStaff && (
        <div className="rounded-2xl border border-green-200 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-green-800">
                Staff &amp; Admin Quick Access
              </p>
              <p className="text-xs text-green-700">
                Jump directly to billing, purchases, or store analytics
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/pos"
                className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-green-800"
              >
                ⚡ Sales Bill (POS)
              </Link>
              <Link
                href="/admin/purchases"
                className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-800"
              >
                🚚 Purchase Bill
              </Link>
              <Link
                href="/admin/reports"
                className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-sky-800"
              >
                📊 Reports
              </Link>
              <Link
                href="/admin/profit-loss"
                className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-teal-800"
              >
                💰 Profit &amp; Loss
              </Link>
              <Link
                href="/admin"
                className="rounded-lg border border-green-700 bg-white px-3 py-1.5 text-xs font-bold text-green-800 hover:bg-green-50"
              >
                ERP Dashboard &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Profile Details Card */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">My Profile</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-4">
          <Input label="Name" error={errors.name?.message} {...register("name")} />
          <Input
            label="Email"
            type="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Mobile (10 digits)"
            type="tel"
            placeholder="Enter 10-digit mobile number"
            error={errors.phone?.message}
            {...register("phone")}
          />
          <Button type="submit" loading={saving}>
            Save Changes
          </Button>
        </form>
      </div>

      {/* Password & Security Card */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Lock className="h-5 w-5 text-green-700" />
              Password &amp; Security
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Change your password directly or request a secure reset link.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={showPasswordForm ? "secondary" : "outline"}
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="gap-1.5 text-xs font-semibold"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {showPasswordForm ? "Close Form" : "Reset / Change Password"}
              {showPasswordForm ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSendResetEmail}
              loading={sendingResetLink}
              className="gap-1.5 text-xs font-semibold text-slate-700"
              title="Generate a direct recovery link or OTP code"
            >
              <Send className="h-3.5 w-3.5" />
              Send Reset Link
            </Button>
          </div>
        </div>

        {/* Instant Reset Link or OTP Result Banner */}
        {resetResult && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-bold text-green-950">
                  Password Recovery Ready for {resetResult.sentEmail}
                </p>
                <p className="text-xs text-green-800">
                  You can reset immediately using the direct recovery session or OTP code below without waiting for email delivery:
                </p>

                {resetResult.emailOtp && (
                  <div className="inline-block rounded-lg border border-green-300 bg-white px-3 py-1.5 shadow-2xs">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Recovery OTP Code
                    </span>
                    <span className="font-mono text-xl font-bold tracking-widest text-green-700 select-all">
                      {resetResult.emailOtp}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {resetResult.directLink && (
                    <a href={resetResult.directLink} className="inline-block">
                      <Button className="h-8 bg-green-700 text-xs font-bold hover:bg-green-800">
                        Open Reset Session (1-Click) &rarr;
                      </Button>
                    </a>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setResetResult(null)}
                    className="h-8 text-xs text-slate-600"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inline Direct Change Password Form */}
        {showPasswordForm && (
          <form
            onSubmit={handleUpdatePassword}
            className="mt-5 max-w-md space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <ShieldCheck className="h-4 w-4 text-green-700" />
              <span>Set your new password below</span>
            </div>

            <div>
              <label
                htmlFor="profile-new-password"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="profile-new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 pr-10 text-sm transition focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="profile-confirm-password"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="profile-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 pr-10 text-sm transition focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="submit"
                loading={updatingPassword}
                className="bg-green-700 text-xs font-semibold hover:bg-green-800"
              >
                Save New Password
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowPasswordForm(false);
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                className="text-xs"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Recent Online Orders Widget on Customer Dashboard */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-700">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Online Orders</h2>
              <p className="text-xs text-slate-500">Track and view your recent grocery orders</p>
            </div>
          </div>
          <Link
            href="/dashboard/orders"
            className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-800"
          >
            All Purchases <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="py-8 text-center">
            <ShoppingBag className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No online orders placed yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Explore fresh groceries and household essentials in our store!
            </p>
            <Link
              href="/products"
              className="mt-3 inline-block rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 transition"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {recentOrders.map((ord) => (
              <div
                key={ord.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 transition hover:border-green-200 hover:bg-green-50/20"
              >
                <div>
                  <p className="font-mono text-xs font-bold text-green-800">
                    {ord.order_number ?? ord.id.slice(0, 8)}
                  </p>
                  <p className="text-[11px] text-slate-500">{formatDate(ord.created_at)}</p>
                </div>
                <div>
                  <OrderStatusBadge status={ord.order_status} />
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{formatPrice(ord.total_amount)}</p>
                  <p className="text-[10px] text-slate-500">
                    {Number(ord.delivery_charge ?? 0) === 0 ? "Free Delivery" : `+${formatPrice(Number(ord.delivery_charge))} del.`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/orders/view?id=${ord.id}`}
                    className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-green-800 shadow-xs transition"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

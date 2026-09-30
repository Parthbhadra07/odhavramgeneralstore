"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { forgotPasswordSchema } from "@/lib/validators";
import { authService } from "@/services/auth.service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [directLink, setDirectLink] = useState<string | null>(null);
  const [emailOtp, setEmailOtp] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (data: { email: string }) => {
    setLoading(true);
    try {
      const result = await authService.resetPassword(data.email);
      setSentEmail(data.email);
      setSent(true);
      if (result.directLink) {
        setDirectLink(result.directLink);
      }
      if (result.emailOtp) {
        setEmailOtp(result.emailOtp);
      }
      toast.success(
        result.directLink
          ? "Instant password reset link ready!"
          : "Reset link sent to your email"
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-2xl font-bold">Reset Password</h1>
        {sent ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              <p className="font-semibold text-base">Password Reset Ready!</p>
              <p className="mt-1 text-xs text-green-800">
                A secure password recovery session has been generated for{" "}
                <span className="font-bold">{sentEmail}</span>.
              </p>
              {emailOtp && (
                <div className="mt-3 rounded-lg bg-white p-3 border border-green-300 text-center shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Your Reset OTP Code
                  </span>
                  <span className="text-2xl font-mono font-bold tracking-widest text-green-700 select-all">
                    {emailOtp}
                  </span>
                </div>
              )}
            </div>

            {directLink ? (
              <a href={directLink} className="block">
                <Button className="w-full bg-green-700 hover:bg-green-800 font-bold text-sm h-11 shadow-sm">
                  Proceed to Reset Password Now &rarr;
                </Button>
              </a>
            ) : null}

            <Link
              href={`/auth/reset-password/?email=${encodeURIComponent(sentEmail)}${
                emailOtp ? `&otp=${encodeURIComponent(emailOtp)}` : ""
              }`}
              className="block"
            >
              <Button
                variant={directLink ? "outline" : "primary"}
                className={`w-full ${
                  directLink
                    ? "border-slate-300 hover:bg-slate-50 text-slate-700 text-xs"
                    : "bg-green-700 hover:bg-green-800 font-semibold"
                }`}
              >
                Enter OTP &amp; Set New Password
              </Button>
            </Link>

            <button
              type="button"
              onClick={() => {
                setSent(false);
                setDirectLink(null);
                setEmailOtp(null);
              }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 pt-1"
            >
              Didn&apos;t receive it? Try another email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter your email and we&apos;ll send you a reset link and verification code.
            </p>
            <Input
              label="Email"
              type="email"
              error={errors.email?.message}
              {...register("email")}
            />
            <Button type="submit" loading={loading} className="w-full">
              Send Reset Link
            </Button>
          </form>
        )}
        <Link
          href="/auth/login/"
          className="mt-6 block text-center text-sm text-green-700 hover:underline"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}

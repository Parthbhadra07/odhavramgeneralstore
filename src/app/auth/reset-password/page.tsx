"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle, ArrowLeft, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/auth.service";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [emailForResend, setEmailForResend] = useState("");
  const [resendSuccess, setResendSuccess] = useState(false);
  const [directLinkResult, setDirectLinkResult] = useState<string | null>(null);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    const search = window.location.search;
    const urlParams = new URLSearchParams(search);
    const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

    const queryEmail = urlParams.get("email");
    if (queryEmail) {
      setEmailForResend(queryEmail);
    }

    const queryOtp = urlParams.get("otp");
    if (queryOtp) {
      setOtpCode(queryOtp);
    }

    // Check for error parameters from Supabase (e.g. otp_expired)
    const errorCode = urlParams.get("error_code") || hashParams.get("error_code");
    const errorDesc =
      urlParams.get("error_description") ||
      hashParams.get("error_description") ||
      urlParams.get("error") ||
      hashParams.get("error");

    if (errorCode === "otp_expired" || errorDesc?.toLowerCase().includes("expired") || errorDesc?.toLowerCase().includes("invalid")) {
      setIsExpired(true);
      setErrorMessage(
        "This password reset link has expired or has already been used. Security links expire after single use."
      );
      setAuthReady(true);
      return;
    }

    if (errorDesc) {
      setErrorMessage(
        decodeURIComponent(errorDesc.replace(/\+/g, " ")) ||
          "Password reset link is invalid or has expired."
      );
      setAuthReady(true);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    // If email and OTP are both in query params, attempt auto-verification
    if (queryEmail && queryOtp) {
      supabase.auth
        .verifyOtp({
          email: queryEmail,
          token: queryOtp,
          type: "recovery",
        })
        .then(({ data, error }) => {
          if (!error && data.session) {
            setSessionActive(true);
            setIsExpired(false);
            setErrorMessage(null);
            toast.success("Security verified! Please set your new password below.");
          }
          setAuthReady(true);
        })
        .catch(() => {
          setAuthReady(true);
        });
      return;
    }

    // 1. Check for URL Hash Tokens (Implicit recovery link flow)
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        .then(({ data, error }) => {
          if (error) {
            console.warn("[ResetPassword] setSession error:", error);
            setIsExpired(true);
            setErrorMessage(error.message);
          } else if (data.session) {
            setSessionActive(true);
            setErrorMessage(null);
            setIsExpired(false);
            if (data.session.user?.email) {
              setEmailForResend(data.session.user.email);
            }
          }
          setAuthReady(true);
        })
        .catch((err) => {
          setIsExpired(true);
          setErrorMessage(err instanceof Error ? err.message : "Session error");
          setAuthReady(true);
        });
      return;
    }

    // 2. Check for PKCE Code query param
    const code = urlParams.get("code");
    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (error) {
            console.warn("[ResetPassword] exchangeCode error:", error);
            setIsExpired(true);
            setErrorMessage(error.message);
          } else if (data.session) {
            setSessionActive(true);
            setErrorMessage(null);
            setIsExpired(false);
            if (data.session.user?.email) {
              setEmailForResend(data.session.user.email);
            }
          }
          setAuthReady(true);
        })
        .catch((err) => {
          setIsExpired(true);
          setErrorMessage(err instanceof Error ? err.message : "Authentication error");
          setAuthReady(true);
        });
      return;
    }

    // 3. Listen for Supabase auth state change
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
          setSessionActive(true);
          setAuthReady(true);
          setIsExpired(false);
          setErrorMessage(null);
          if (session.user?.email) {
            setEmailForResend(session.user.email);
          }
        }
      }
    );

    // 4. Check for active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionActive(true);
        setIsExpired(false);
        if (session.user?.email) {
          setEmailForResend(session.user.email);
        }
      } else {
        // If loaded without any token, hash, or session, mark as needing a link
        setIsExpired(true);
        setErrorMessage("Please request a reset link or enter your OTP code to set your new password.");
      }
      setAuthReady(true);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!emailForResend.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    if (!otpCode.trim()) {
      toast.error("Please enter the OTP code");
      return;
    }

    setVerifyingOtp(true);
    setErrorMessage(null);
    try {
      await authService.verifyRecoveryOtp(emailForResend.trim(), otpCode.trim());
      setSessionActive(true);
      setIsExpired(false);
      setErrorMessage(null);
      toast.success("Identity verified! Set your new password below.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid or expired OTP code";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForResend.trim()) {
      toast.error("Please enter your email address");
      return;
    }

    setResending(true);
    try {
      const result = await authService.resetPassword(emailForResend.trim());
      setResendSuccess(true);
      if (result.directLink) {
        setDirectLinkResult(result.directLink);
      }
      if (result.emailOtp) {
        setGeneratedOtp(result.emailOtp);
        setOtpCode(result.emailOtp);
      }
      toast.success(
        result.directLink
          ? "Instant reset session generated!"
          : "Fresh reset link sent to your email!"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authService.updatePassword(password);
      setSuccess(true);
      toast.success("Password reset successfully!");
      setTimeout(() => {
        router.push("/auth/login/");
      }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset password";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isExpired ? "Reset Link Expired" : "Set New Password"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {isExpired
              ? "Request a fresh reset link below to update your password."
              : "Enter your new password below to secure your account."}
          </p>
        </div>

        {/* Expired Token UI: Easy 1-click resend without leaving the page */}
        {isExpired && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold">Reset Link Expired or Already Used</p>
                  <p className="mt-1 text-amber-800">
                    Supabase security tokens expire after one use. Enter your email below to send a fresh link instantly:
                  </p>
                </div>
              </div>
            </div>

            {resendSuccess ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-green-600" />
                  <p className="mt-2 text-base font-bold text-green-900">
                    {directLinkResult ? "Instant Recovery Ready!" : "Fresh Reset Link Sent!"}
                  </p>
                  <p className="mt-1 text-xs text-green-800">
                    {directLinkResult
                      ? `A secure reset session was generated for ${emailForResend}. You can continue immediately below without waiting for email.`
                      : `Please check your inbox at ${emailForResend} and click the latest link.`}
                  </p>
                  {generatedOtp && (
                    <div className="mt-3 rounded-lg bg-white p-3 border border-green-300 text-center shadow-xs">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Your Reset OTP Code
                      </span>
                      <span className="text-2xl font-mono font-bold tracking-widest text-green-700 select-all">
                        {generatedOtp}
                      </span>
                    </div>
                  )}
                </div>

                {directLinkResult && (
                  <a href={directLinkResult} className="block">
                    <Button className="w-full bg-green-700 hover:bg-green-800 font-bold text-sm h-11 shadow-sm">
                      Continue to Set Password (1-Click) &rarr;
                    </Button>
                  </a>
                )}

                <Button
                  variant="outline"
                  onClick={() => handleVerifyOtp()}
                  loading={verifyingOtp}
                  className="w-full text-xs font-semibold"
                >
                  Verify OTP Directly On This Page
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setResendSuccess(false);
                    setDirectLinkResult(null);
                    setGeneratedOtp(null);
                  }}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-800 pt-1"
                >
                  Request another link
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <form onSubmit={handleResend} className="space-y-3">
                  <div>
                    <label htmlFor="resend-email" className="block text-xs font-semibold text-slate-700 mb-1">
                      Your Account Email
                    </label>
                    <input
                      id="resend-email"
                      type="email"
                      placeholder="Enter your email"
                      value={emailForResend}
                      onChange={(e) => setEmailForResend(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100"
                    />
                  </div>
                  <Button
                    type="submit"
                    loading={resending}
                    className="w-full bg-green-700 hover:bg-green-800 font-semibold gap-1.5"
                  >
                    <Send className="h-4 w-4" />
                    Get Instant Reset Link
                  </Button>
                </form>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-slate-400 font-medium">Or enter OTP code</span>
                  </div>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  <div>
                    <label htmlFor="otp-manual" className="block text-xs font-semibold text-slate-700 mb-1">
                      6-8 Digit OTP Code
                    </label>
                    <input
                      id="otp-manual"
                      type="text"
                      placeholder="Enter verification code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.trim())}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono tracking-widest transition focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    loading={verifyingOtp}
                    className="w-full border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold"
                  >
                    Verify Code &amp; Unlock Password Form
                  </Button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Valid Token / Active Session UI: Set Password Form */}
        {!isExpired && authReady && (
          <>
            {errorMessage && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {success ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-slate-900">
                    Password Reset Complete!
                  </h2>
                  <p className="text-sm text-slate-600">
                    Your password has been successfully updated. Redirecting to sign in...
                  </p>
                </div>
                <Button
                  className="w-full bg-green-700 hover:bg-green-800"
                  onClick={() => router.push("/auth/login/")}
                >
                  Sign In Now
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="new-password"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm transition focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter your new password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm transition focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100"
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

                <Button
                  type="submit"
                  loading={loading}
                  className="w-full bg-green-700 font-semibold hover:bg-green-800"
                >
                  Update Password
                </Button>
              </form>
            )}
          </>
        )}

        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <Link
            href="/auth/login/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-green-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

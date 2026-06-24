"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { loginSchema, type LoginInput } from "@/lib/validators";
import { authService } from "@/services/auth.service";
import { requestNotificationPermission } from "@/utils/browser-notifications";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Leaf } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    try {
      await authService.signIn(data.email, data.password);
      if (redirect.startsWith("/admin")) {
        void requestNotificationPermission();
      }
      toast.success("Welcome back!");
      router.push(redirect);
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

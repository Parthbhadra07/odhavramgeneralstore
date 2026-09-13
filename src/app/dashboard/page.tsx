"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { profileSchema } from "@/lib/validators";
import { authService } from "@/services/auth.service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-2xl font-bold">My Profile</h1>
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
  );
}

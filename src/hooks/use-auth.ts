"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isStaleAuthError } from "@/lib/supabase/auth-errors";
import type { User } from "@/types/database";
import type { User as AuthUser } from "@supabase/supabase-js";
import { isErpAdmin, isErpStaff, isSuperAdmin } from "@/utils/roles";

export function useAuth() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    // In POS offline billing mode ONLY, allow cached offline profile
    const isOfflinePos =
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      !navigator.onLine &&
      window.location.pathname.startsWith("/admin/pos");

    if (isOfflinePos) {
      try {
        const cached = localStorage.getItem("ogs-offline-auth-profile");
        if (cached) {
          const p = JSON.parse(cached) as User;
          setProfile(p);
          setLoading(false);
        }
      } catch {}
    }

    const loadProfile = async (userId: string, currentAuthUser?: AuthUser | null) => {
      try {
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        const rawPhone =
          currentAuthUser?.user_metadata?.phone ||
          currentAuthUser?.user_metadata?.mobile ||
          currentAuthUser?.user_metadata?.phone_number ||
          currentAuthUser?.phone;
        const cleanPhone = rawPhone ? String(rawPhone).replace(/\D/g, "").slice(-10) : "";

        if (data) {
          const u = data as User;
          // Auto-heal phone if missing from profile but present in auth metadata
          if ((!u.phone || u.phone.trim() === "") && cleanPhone.length === 10) {
            u.phone = cleanPhone;
            void (async () => {
              try {
                await supabase.rpc("sync_user_signup_phone", {
                  p_user_id: userId,
                  p_phone: cleanPhone,
                  p_name: u.name,
                });
              } catch {
                await supabase
                  .from("users")
                  .update({ phone: cleanPhone })
                  .eq("id", userId);
              }
            })();
          }
          setProfile(u);
          // Only cache staff/admin profiles for offline POS support
          if (isErpStaff(u.role)) {
            try {
              localStorage.setItem("ogs-offline-auth-profile", JSON.stringify(u));
            } catch {}
          }
        } else if (currentAuthUser) {
          // If public.users record was not created by trigger, create it now!
          const fallbackUser: User = {
            id: userId,
            email: currentAuthUser.email ?? "",
            name: currentAuthUser.user_metadata?.name ?? "Customer",
            phone: cleanPhone.length === 10 ? cleanPhone : null,
            role: "customer",
            created_at: new Date().toISOString(),
          };
          try {
            await supabase.from("users").upsert({
              id: userId,
              email: fallbackUser.email,
              name: fallbackUser.name,
              phone: fallbackUser.phone,
              role: "customer",
            });
            if (cleanPhone.length === 10) {
              void supabase.rpc("sync_user_signup_phone", {
                p_user_id: userId,
                p_phone: cleanPhone,
                p_name: fallbackUser.name,
              });
            }
          } catch {}
          setProfile(fallbackUser);
        }
      } catch (e) {
        console.warn("[Auth] loadProfile network error:", e);
      } finally {
        setLoading(false);
      }
    };

    const clearStaleSession = async () => {
      // Only clear if online; if offline, keep cached offline access
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setLoading(false);
        return;
      }
      setAuthUser(null);
      setProfile(null);
      setLoading(false);
      try {
        localStorage.removeItem("ogs-offline-auth-profile");
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // ignore
      }
    };

    void supabase.auth
      .getUser()
      .then(({ data: { user }, error }) => {
        if (error) {
          if (isStaleAuthError(error)) {
            void clearStaleSession();
            return;
          }
          // Network failure or offline
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            setLoading(false);
            return;
          }
        }

        if (user) {
          setAuthUser(user);
          void loadProfile(user.id, user);
        } else {
          // If definitely no active user, clear profile and cache
          setAuthUser(null);
          setProfile(null);
          if (typeof window !== "undefined") {
            try {
              localStorage.removeItem("ogs-offline-auth-profile");
            } catch {}
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("[Auth] Network error checking user:", err);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" && !session) {
        void clearStaleSession();
        return;
      }

      setAuthUser(session?.user ?? null);
      if (session?.user) {
        void loadProfile(session.user.id, session.user);
      } else {
        setProfile(null);
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("ogs-offline-auth-profile");
          } catch {}
        }
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    user: authUser,
    profile,
    loading,
    isAdmin: isErpAdmin(profile?.role),
    isSuperAdmin: isSuperAdmin(profile?.role),
    isStaff: isErpStaff(profile?.role),
  };
}

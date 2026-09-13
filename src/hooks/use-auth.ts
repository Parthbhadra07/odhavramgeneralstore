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

    const loadProfile = async (userId: string) => {
      try {
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();
        if (data) {
          const u = data as User;
          setProfile(u);
          // Only cache staff/admin profiles for offline POS support
          if (isErpStaff(u.role)) {
            try {
              localStorage.setItem("ogs-offline-auth-profile", JSON.stringify(u));
            } catch {}
          }
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
          void loadProfile(user.id);
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
        void loadProfile(session.user.id);
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

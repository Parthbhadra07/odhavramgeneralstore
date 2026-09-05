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

    const loadProfile = async (userId: string) => {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();
      setProfile(data as User | null);
      setLoading(false);
    };

    const clearStaleSession = async () => {
      setAuthUser(null);
      setProfile(null);
      setLoading(false);
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // ignore — cookies may already be invalid
      }
    };

    void supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error) {
        if (isStaleAuthError(error)) {
          void clearStaleSession();
          return;
        }
        console.warn("[Auth] getUser failed:", error.message);
      }

      setAuthUser(user ?? null);
      if (user) void loadProfile(user.id);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" && !session) {
        void clearStaleSession();
        return;
      }

      setAuthUser(session?.user ?? null);
      if (session?.user) void loadProfile(session.user.id);
      else {
        setProfile(null);
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

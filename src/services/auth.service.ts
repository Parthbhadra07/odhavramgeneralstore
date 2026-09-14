import { requireClient } from "@/lib/supabase/client";
import { isStaleAuthError } from "@/lib/supabase/auth-errors";
import type { User } from "@/types/database";
import { customerService } from "@/services/erp/customer.service";

export const authService = {
  async signUp(email: string, password: string, name: string, phone: string) {
    const supabase = requireClient();
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const cleanName = name.trim() || "Customer";

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: cleanName,
          phone: cleanPhone,
          mobile: cleanPhone,
          phone_number: cleanPhone,
        },
      },
    });
    if (error) throw error;

    if (data.user) {
      // 1. Try secure RPC to link phone and CRM customer
      try {
        await supabase.rpc("sync_user_signup_phone", {
          p_user_id: data.user.id,
          p_phone: cleanPhone,
          p_name: cleanName,
        });
      } catch {
        // Fallback direct upsert if session exists
        try {
          await supabase.from("users").upsert(
            {
              id: data.user.id,
              email: data.user.email ?? email,
              name: cleanName,
              phone: cleanPhone,
              role: "customer",
            },
            { onConflict: "id" }
          );
        } catch (profileError) {
          console.warn("Profile upsert:", profileError);
        }
      }

      try {
        await customerService.syncFromUser({
          id: data.user.id,
          name: cleanName,
          email: data.user.email ?? email,
          phone: cleanPhone,
        });
      } catch (err) {
        console.warn("Customer sync on signup:", err);
      }
    }

    return data;
  },

  async signIn(email: string, password: string) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error(
        "No internet connection. Please connect to the internet to sign in, or click 'Open POS Offline Mode' below."
      );
    }
    const supabase = requireClient();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // Auto-heal phone if stored in auth metadata but missing from public profile
      if (data.user) {
        const metaPhone =
          data.user.user_metadata?.phone ||
          data.user.user_metadata?.mobile ||
          data.user.user_metadata?.phone_number ||
          data.user.phone;
        if (metaPhone) {
          const cleanPhone = String(metaPhone).replace(/\D/g, "").slice(-10);
          if (cleanPhone.length === 10) {
            void (async () => {
              try {
                await supabase.rpc("sync_user_signup_phone", {
                  p_user_id: data.user.id,
                  p_phone: cleanPhone,
                  p_name: data.user.user_metadata?.name,
                });
              } catch {
                await supabase
                  .from("users")
                  .update({ phone: cleanPhone })
                  .eq("id", data.user.id);
              }
            })();
          }
        }
      }

      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        throw new Error(
          "Unable to connect to the login server. Please check your internet connection or use POS Offline Mode."
        );
      }
      throw err;
    }
  },

  async signOut() {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("ogs-offline-auth-profile");
      } catch {}
    }
    const supabase = requireClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async resetPassword(email: string) {
    const supabase = requireClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
    });
    if (error) throw error;
  },

  async getSession() {
    const supabase = requireClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      if (isStaleAuthError(error)) {
        await supabase.auth.signOut({ scope: "local" });
        return null;
      }
      throw error;
    }
    return data.session;
  },

  async getProfile(userId: string): Promise<User | null> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) return null;
    return data as User;
  },

  async updateProfile(
    userId: string,
    updates: { name?: string; email?: string; phone?: string }
  ) {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();
    if (error) throw error;
    return data as User;
  },
};

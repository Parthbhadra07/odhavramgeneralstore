import { requireClient } from "@/lib/supabase/client";
import type { User } from "@/types/database";
import { customerService } from "@/services/erp/customer.service";

export const authService = {
  async signUp(email: string, password: string, name: string) {
    const supabase = requireClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;

    // Fallback if DB trigger did not create public.users row
    if (data.user) {
      const { error: profileError } = await supabase.from("users").upsert(
        {
          id: data.user.id,
          email: data.user.email ?? email,
          name,
          role: "customer",
        },
        { onConflict: "id" }
      );
      if (profileError) {
        console.warn("Profile upsert:", profileError.message);
      }

      try {
        await customerService.syncFromUser({
          id: data.user.id,
          name,
          email: data.user.email ?? email,
        });
      } catch (err) {
        console.warn("Customer sync on signup:", err);
      }
    }

    return data;
  },

  async signIn(email: string, password: string) {
    const supabase = requireClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
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
    if (error) throw error;
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

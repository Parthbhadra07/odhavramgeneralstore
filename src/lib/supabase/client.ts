import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

let missingConfigWarned = false;

export function createClient(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseEnv();

  if (!isConfigured) {
    if (typeof window !== "undefined" && !missingConfigWarned) {
      missingConfigWarned = true;
      console.warn(
        "[Supabase] Missing configuration. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    }
    return null;
  }

  return createBrowserClient(url, anonKey);
}

export function requireClient(): SupabaseClient {
  const client = createClient();
  if (!client) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return client;
}

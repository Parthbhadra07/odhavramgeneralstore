const PLACEHOLDER_URL = "https://your-project.supabase.co";
const PLACEHOLDER_KEY = "your-anon-key";

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  const isConfigured =
    Boolean(url && anonKey) &&
    url !== PLACEHOLDER_URL &&
    anonKey !== PLACEHOLDER_KEY &&
    !url.includes("your-project");

  return { url, anonKey, isConfigured };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv().isConfigured;
}

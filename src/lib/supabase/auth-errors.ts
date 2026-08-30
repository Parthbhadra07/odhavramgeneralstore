/** True when Supabase auth cookies/session are expired, revoked, or from another project. */
export function isStaleAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const message =
    "message" in error ? String((error as { message?: string }).message) : "";
  const code = "code" in error ? String((error as { code?: string }).code) : "";

  const combined = `${message} ${code}`.toLowerCase();

  return (
    combined.includes("refresh token not found") ||
    combined.includes("invalid refresh token") ||
    combined.includes("refresh_token_not_found") ||
    combined.includes("session_not_found") ||
    combined.includes("invalid claim") ||
    combined.includes("jwt expired")
  );
}

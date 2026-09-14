import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { isStaleAuthError } from "@/lib/supabase/auth-errors";

export async function updateSession(request: NextRequest) {
  const { url, anonKey, isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  let user = null;
  let authError: unknown = null;
  let isNetworkOffline = false;

  try {
    const res = await supabase.auth.getUser();
    user = res.data?.user ?? null;
    authError = res.error;
  } catch (err) {
    authError = err;
    isNetworkOffline = true;
  }

  if (authError) {
    const errMsg = (authError as Error)?.message || "";
    if (
      errMsg.includes("Failed to fetch") ||
      errMsg.includes("fetch failed") ||
      errMsg.includes("ENOTFOUND") ||
      errMsg.includes("EAI_AGAIN") ||
      (authError as { name?: string })?.name === "AuthRetryableFetchError"
    ) {
      isNetworkOffline = true;
    } else if (isStaleAuthError(authError)) {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {}
    }
  }

  const userAfterCleanup =
    authError && isStaleAuthError(authError) ? null : user;

  const pathname = request.nextUrl.pathname;

  const protectedRoutes = ["/checkout", "/dashboard"];
  const adminRoutes = ["/admin"];
  const authRoutes = ["/auth/login", "/auth/signup"];

  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));
  const isAdmin = adminRoutes.some((r) => pathname.startsWith(r));
  const isAuth = authRoutes.some((r) => pathname.startsWith(r));

  // When offline, only allow previously authenticated staff session for POS billing
  const hasAuthCookie = request.cookies
    .getAll()
    .some(
      (c) =>
        c.name.includes("auth-token") ||
        c.name.startsWith("sb-") ||
        c.name.includes("supabase")
    );

  // If server is offline and user has an auth cookie and is accessing POS, let client AdminGuard verify
  if (isNetworkOffline && hasAuthCookie && pathname.startsWith("/admin/pos")) {
    return supabaseResponse;
  }

  if (!userAfterCleanup && (isProtected || isAdmin)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (userAfterCleanup && isAdmin) {
    try {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", userAfterCleanup.id)
        .single();

      const staffRoles = ["super_admin", "admin", "staff", "cashier"];
      if (!profile?.role || !staffRoles.includes(profile.role)) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
    } catch {
      // Role could not be verified — fail closed and redirect to store home
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  if (userAfterCleanup && isAuth) {
    const url = request.nextUrl.clone();
    try {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", userAfterCleanup.id)
        .single();
      const staffRoles = ["super_admin", "admin", "staff", "cashier"];
      if (profile?.role && staffRoles.includes(profile.role)) {
        url.pathname = "/admin";
      } else {
        url.pathname = "/dashboard";
      }
    } catch {
      url.pathname = "/dashboard";
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

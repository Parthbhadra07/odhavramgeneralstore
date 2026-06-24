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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && isStaleAuthError(authError)) {
    await supabase.auth.signOut({ scope: "local" });
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

  if (!userAfterCleanup && (isProtected || isAdmin)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (userAfterCleanup && isAdmin) {
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
  }

  if (userAfterCleanup && isAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

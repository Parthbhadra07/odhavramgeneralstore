import { NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { url, anonKey, isConfigured } = getSupabaseEnv();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey;
    if (!isConfigured || !url || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: "Database not configured" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let body: { orderId?: string } = {};
    try {
      body = await req.json();
    } catch {
      // body empty is fine, marks all seen
    }

    if (body.orderId) {
      // Mark single order as seen
      await supabaseAdmin
        .from("orders")
        .update({ is_new: false })
        .eq("id", body.orderId);

      // Also mark matching notifications as read
      await supabaseAdmin
        .from("notifications")
        .update({ read: true })
        .or(`reference_id.eq.${body.orderId},link.ilike.%${body.orderId}%`);
    } else {
      // Mark all orders as seen
      await supabaseAdmin
        .from("orders")
        .update({ is_new: false })
        .or("is_new.eq.true,is_new.is.null");

      // Mark order notifications as read
      await supabaseAdmin
        .from("notifications")
        .update({ read: true })
        .eq("read", false);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to mark orders as read";
    console.error("[/api/orders/mark-seen] error:", err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

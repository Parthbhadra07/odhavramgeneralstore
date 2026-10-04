import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

function getServerSupabase() {
  const { url, anonKey } = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey;
  if (!url || !serviceKey) {
    throw new Error("Supabase credentials missing on server");
  }
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export interface ServerDealBannerItem {
  id: string;
  type?: "deal" | "photo";
  enabled?: boolean;
  title: string;
  subtitle?: string;
  badgeText?: string;
  discountHighlight?: string;
  endDate?: string;
  timerMode?: "realtime_daily" | "weekend" | "custom";
  buttonText?: string;
  buttonLink?: string;
  theme?: string;
  imageUrl?: string | null;
  imageAlt?: string;
  targetUrl?: string;
  displayOrder?: number;
}

function serializeBanner(item: ServerDealBannerItem) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);

  const meta = {
    type: item.type || "deal",
    timerMode: item.timerMode || (item.endDate === "realtime_daily" ? "realtime_daily" : "custom"),
    imageUrl: item.imageUrl || null,
    imageAlt: item.imageAlt || null,
    targetUrl: item.targetUrl || null,
    displayOrder: item.displayOrder ?? 1,
    originalId: item.id,
  };

  const cleanSubtitle = (item.subtitle || "").replace(/<!--BANNER_META:\{.*?\}-->/g, "").trim();
  const serializedSubtitle = `${cleanSubtitle}\n<!--BANNER_META:${JSON.stringify(meta)}-->`.trim();

  let dbEndDate: string | null = null;
  if (item.endDate && item.endDate !== "realtime_daily" && item.endDate !== "weekend") {
    const parsed = new Date(item.endDate);
    if (!isNaN(parsed.getTime())) {
      dbEndDate = parsed.toISOString();
    }
  }

  const row: Record<string, unknown> = {
    title: item.title || "Special Offer",
    subtitle: serializedSubtitle,
    badge_text: item.badgeText || "SPECIAL OFFER",
    discount_highlight: item.discountHighlight || "LIMITED DEAL",
    end_date: dbEndDate,
    button_text: item.buttonText || "Shop Deals Now",
    button_link: item.buttonLink || "/products?deals=true",
    theme: item.theme || "flame",
    enabled: item.enabled ?? true,
    updated_at: new Date().toISOString(),
  };

  if (isUUID) {
    row.id = item.id;
  }

  return row;
}

export async function GET() {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("deal_banners")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, banners: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getServerSupabase();
    const body = await req.json();
    const action = body.action || "save";

    if (action === "delete") {
      const bannerId = body.id;
      if (!bannerId) {
        return NextResponse.json({ success: false, error: "Banner ID required for delete" }, { status: 400 });
      }

      // Delete by ID or by originalId embedded in subtitle
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bannerId);
      if (isUUID) {
        const { error } = await supabase.from("deal_banners").delete().eq("id", bannerId);
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      } else {
        const { error } = await supabase
          .from("deal_banners")
          .delete()
          .ilike("subtitle", `%\"originalId\":\"${bannerId}\"%`);
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const { data: remaining } = await supabase
        .from("deal_banners")
        .select("*")
        .order("created_at", { ascending: true });

      return NextResponse.json({ success: true, banners: remaining ?? [] });
    }

    if (action === "save") {
      const banners: ServerDealBannerItem[] = Array.isArray(body.banners) ? body.banners : [];

      // Delete all existing banners
      const { error: delErr } = await supabase
        .from("deal_banners")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (delErr) {
        console.warn("[api/banners] Delete old error:", delErr);
      }

      if (banners.length > 0) {
        const rows = banners.map(serializeBanner);
        const { data: inserted, error: insErr } = await supabase
          .from("deal_banners")
          .insert(rows)
          .select();

        if (insErr) {
          return NextResponse.json({ success: false, error: insErr.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, banners: inserted ?? [] });
      }

      return NextResponse.json({ success: true, banners: [] });
    }

    return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

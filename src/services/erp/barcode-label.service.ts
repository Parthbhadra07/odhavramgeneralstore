import { requireClient } from "@/lib/supabase/client";
import type {
  BarcodeDashboardStats,
  BarcodeFormat,
  BarcodeLabelConfig,
  BarcodeLabelRecord,
  ThermalPrinterType,
} from "@/types/erp";

export const LABEL_SIZE_PRESETS = [
  { id: "25x15", label: "25×15 mm", width: 25, height: 15 },
  { id: "38x25", label: "38×25 mm", width: 38, height: 25 },
  { id: "50x25", label: "50×25 mm", width: 50, height: 25 },
  { id: "75x50", label: "75×50 mm", width: 75, height: 50 },
  { id: "custom", label: "Custom Size", width: 50, height: 25 },
] as const;

export const DEFAULT_LABEL_CONFIG: BarcodeLabelConfig = {
  format: "CODE128",
  labelWidthMm: 50,
  labelHeightMm: 25,
  barcodeHeight: 40,
  fontSize: 10,
  printerType: "tvs",
  showProductName: true,
  showMrp: true,
  showSellingPrice: true,
  showSku: false,
  showBarcodeNumber: true,
  showStoreName: true,
  showMfgDate: false,
  showExpiryDate: false,
};

export const PRINTER_PROFILES: Record<
  ThermalPrinterType,
  { label: string; marginMm: number; dpi: number }
> = {
  tvs: { label: "TVS Thermal Printer", marginMm: 2, dpi: 203 },
  zebra: { label: "Zebra Printer", marginMm: 3, dpi: 203 },
  tsc: { label: "TSC Printer", marginMm: 2, dpi: 203 },
  generic: { label: "Generic Thermal Printer", marginMm: 2, dpi: 203 },
};

export const barcodeLabelService = {
  async getDashboardStats(): Promise<BarcodeDashboardStats> {
    const supabase = requireClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [{ count: totalProducts }, { data: products }, { data: labels }] =
      await Promise.all([
        supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("products")
          .select("id, barcode, created_at")
          .eq("is_active", true),
        supabase
          .from("barcode_labels")
          .select("id, created_at, printed_at, print_quantity")
          .gte("created_at", todayStart.toISOString()),
      ]);

    const rows = products ?? [];
    const withBarcode = rows.filter((p) => p.barcode?.trim()).length;
    const generatedToday = rows.filter(
      (p) => p.barcode && new Date(p.created_at) >= todayStart
    ).length;

    const labelRows = labels ?? [];
    const printedToday = labelRows.reduce(
      (sum, l) => sum + (l.printed_at ? Number(l.print_quantity ?? 1) : 0),
      0
    );

    return {
      totalWithBarcode: withBarcode,
      generatedToday,
      printedToday,
      withoutBarcode: Math.max(0, (totalProducts ?? rows.length) - withBarcode),
    };
  },

  async checkDuplicate(barcode: string, excludeProductId?: string): Promise<boolean> {
    const trimmed = barcode.trim();
    if (!trimmed) return false;

    const supabase = requireClient();
    let q = supabase.from("products").select("id").eq("barcode", trimmed);
    if (excludeProductId) q = q.neq("id", excludeProductId);
    const { data: products } = await q;

    const { data: lots } = await supabase
      .from("product_lots")
      .select("id")
      .eq("barcode", trimmed)
      .eq("is_active", true);

    const { data: variants } = await supabase
      .from("product_variants")
      .select("id")
      .eq("barcode", trimmed);

    return (
      (products?.length ?? 0) > 0 ||
      (lots?.length ?? 0) > 0 ||
      (variants?.length ?? 0) > 0
    );
  },

  async recordPrint(params: {
    productId: string;
    barcode: string;
    format: BarcodeFormat;
    printerType: ThermalPrinterType;
    labelWidthMm: number;
    labelHeightMm: number;
    quantity: number;
  }): Promise<BarcodeLabelRecord> {
    const supabase = requireClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("barcode_labels")
      .insert({
        product_id: params.productId,
        barcode: params.barcode,
        label_format: params.format,
        printer_type: params.printerType,
        label_width_mm: params.labelWidthMm,
        label_height_mm: params.labelHeightMm,
        print_quantity: params.quantity,
        printed_at: new Date().toISOString(),
        printed_by: user?.id ?? null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as BarcodeLabelRecord;
  },

  async getRecentPrints(limit = 20): Promise<BarcodeLabelRecord[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("barcode_labels")
      .select("*")
      .order("printed_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as BarcodeLabelRecord[];
  },
};

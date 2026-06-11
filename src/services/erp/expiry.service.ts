import { createClient } from "@/lib/supabase/client";
import { inventoryService } from "./inventory.service";
import { lotService } from "./lot.service";
import type { ErpProduct, ProductLot } from "@/types/erp";

export interface ExpiryBucket {
  label: string;
  days: number;
  products: ErpProduct[];
  lots: ProductLot[];
}

export const expiryService = {
  async getExpiredProducts(): Promise<ErpProduct[]> {
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .not("expiry_date", "is", null)
      .lt("expiry_date", today)
      .gt("stock", 0)
      .order("expiry_date");
    if (error) throw error;
    return (data ?? []) as ErpProduct[];
  },

  async getExpiringLots(withinDays: number): Promise<ProductLot[]> {
    return lotService.listAll({ nearExpiryDays: withinDays });
  },

  async getDashboard(): Promise<{
    expired: ErpProduct[];
    expiring30: ErpProduct[];
    expiring60: ErpProduct[];
    expiring90: ErpProduct[];
    expiredLots: ProductLot[];
    expiringLots30: ProductLot[];
    expiringLots60: ProductLot[];
    expiringLots90: ProductLot[];
  }> {
    const [expired, exp30, exp60, exp90, lots30, lots60, lots90] =
      await Promise.all([
        this.getExpiredProducts(),
        inventoryService.getExpiringProducts(30),
        inventoryService.getExpiringProducts(60),
        inventoryService.getExpiringProducts(90),
        this.getExpiringLots(30),
        this.getExpiringLots(60),
        this.getExpiringLots(90),
      ]);

    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data: expiredLotsData } = await supabase
      .from("product_lots")
      .select("*, products(name, sku)")
      .eq("is_active", true)
      .gt("current_stock", 0)
      .not("expiry_date", "is", null)
      .lt("expiry_date", today);

    return {
      expired,
      expiring30: exp30,
      expiring60: exp60,
      expiring90: exp90,
      expiredLots: (expiredLotsData ?? []) as ProductLot[],
      expiringLots30: lots30,
      expiringLots60: lots60,
      expiringLots90: lots90,
    };
  },
};

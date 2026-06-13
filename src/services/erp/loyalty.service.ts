import { requireClient } from "@/lib/supabase/client";
import { LOYALTY_POINT_VALUE } from "@/lib/erp/constants";

export const loyaltyService = {
  async earnPoints(
    customerId: string,
    points: number,
    referenceType: string,
    referenceId: string
  ) {
    const supabase = requireClient();
    await supabase.from("customer_loyalty").insert({
      customer_id: customerId,
      points,
      transaction_type: "earn",
      reference_type: referenceType,
      reference_id: referenceId,
    });
    const { data } = await supabase
      .from("customers")
      .select("loyalty_points")
      .eq("id", customerId)
      .single();
    await supabase
      .from("customers")
      .update({
        loyalty_points: (data?.loyalty_points ?? 0) + points,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);
  },

  async redeemPoints(
    customerId: string,
    points: number,
    referenceType: string,
    referenceId: string
  ) {
    const supabase = requireClient();
    const { data } = await supabase
      .from("customers")
      .select("loyalty_points")
      .eq("id", customerId)
      .single();
    const available = data?.loyalty_points ?? 0;
    if (points > available) throw new Error("Insufficient loyalty points");

    await supabase.from("customer_loyalty").insert({
      customer_id: customerId,
      points: -points,
      transaction_type: "redeem",
      reference_type: referenceType,
      reference_id: referenceId,
    });
    await supabase
      .from("customers")
      .update({
        loyalty_points: available - points,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);
  },

  pointsToDiscount(points: number) {
    return points * LOYALTY_POINT_VALUE;
  },

  async getHistory(customerId: string) {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("customer_loyalty")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};

import { requireClient } from "@/lib/supabase/client";
import type { ErpNotification } from "@/types/erp";

export const notificationService = {
  async list(unreadOnly = false): Promise<ErpNotification[]> {
    const supabase = requireClient();
    let q = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (unreadOnly) q = q.eq("is_read", false);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as ErpNotification[];
  },

  async markRead(id: string): Promise<void> {
    const supabase = requireClient();
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  },

  async markAllRead(): Promise<void> {
    const supabase = requireClient();
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false);
  },
};

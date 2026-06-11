"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { notificationService } from "@/services/erp";
import type { ErpNotification } from "@/types/erp";
import { formatDate } from "@/utils/format";
import { Button } from "@/components/ui/button";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<ErpNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    notificationService.list().then(setNotifications).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const markAllRead = async () => {
    await notificationService.markAllRead();
    toast.success("All notifications marked read");
    load();
  };

  const markRead = async (id: string) => {
    await notificationService.markRead(id);
    load();
  };

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="admin-page-title flex items-center gap-2">
            <Bell className="h-6 w-6 text-green-600" />
            Notification Center
          </h1>
          <p className="text-sm text-gray-600">{unread} unread notification(s)</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={markAllRead}>
            <CheckCheck className="mr-1 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : notifications.length === 0 ? (
        <div className="admin-card p-8 text-center text-gray-500">No notifications yet</div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`admin-card flex items-start justify-between gap-3 p-4 ${!n.is_read ? "border-l-4 border-l-green-500" : ""}`}
            >
              <div>
                <p className="font-medium text-gray-900">{n.title}</p>
                {n.message && <p className="mt-1 text-sm text-gray-600">{n.message}</p>}
                <p className="mt-1 text-xs text-gray-400">{formatDate(n.created_at)} · {n.type}</p>
              </div>
              {!n.is_read && (
                <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                  Mark read
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

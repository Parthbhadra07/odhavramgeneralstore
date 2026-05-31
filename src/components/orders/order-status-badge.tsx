import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, type StoreOrderStatus } from "@/lib/constants";

const variantMap: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  received: "info",
  confirmed: "info",
  preparing: "warning",
  packed: "warning",
  out_for_delivery: "info",
  delivered: "success",
  cancelled: "danger",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={variantMap[status] ?? "default"}>
      {ORDER_STATUS_LABELS[status as StoreOrderStatus] ?? status}
    </Badge>
  );
}

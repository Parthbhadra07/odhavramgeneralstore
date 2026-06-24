import { cn } from "@/utils/cn";
import { Check } from "lucide-react";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type StoreOrderStatus,
} from "@/lib/constants";

const TRACKING_FLOW = ORDER_STATUSES.filter((s) => s !== "cancelled");

export function OrderTimeline({
  currentStatus,
  history,
}: {
  currentStatus: string;
  history?: { status: string; created_at: string; note?: string | null }[];
}) {
  if (currentStatus === "cancelled") {
    return (
      <p className="rounded-lg bg-red-50 p-4 text-center font-medium text-red-700">
        This order has been cancelled.
      </p>
    );
  }

  const normalized =
    currentStatus === "pending" ? "received" : currentStatus;
  const currentIndex = TRACKING_FLOW.indexOf(
    normalized as (typeof TRACKING_FLOW)[number]
  );
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-0 sm:flex-row sm:items-start sm:justify-between">
        {TRACKING_FLOW.map((step, index) => {
          const done = index <= safeIndex;
          const active = index === safeIndex;

          return (
            <div key={step} className="flex flex-1 flex-col items-center sm:min-w-0">
              <div className="flex w-full items-center">
                {index > 0 && (
                  <div
                    className={cn(
                      "hidden h-0.5 flex-1 sm:block",
                      index <= safeIndex ? "bg-green-600" : "bg-gray-200"
                    )}
                  />
                )}
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                    done
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-gray-300 bg-white text-gray-400",
                    active && "ring-4 ring-green-100"
                  )}
                >
                  {done ? <Check className="h-5 w-5" /> : index + 1}
                </div>
                {index < TRACKING_FLOW.length - 1 && (
                  <div
                    className={cn(
                      "hidden h-0.5 flex-1 sm:block",
                      index < safeIndex ? "bg-green-600" : "bg-gray-200"
                    )}
                  />
                )}
              </div>
              <p
                className={cn(
                  "mt-2 max-w-[90px] text-center text-xs font-medium leading-tight",
                  done ? "text-green-700" : "text-gray-400"
                )}
              >
                {ORDER_STATUS_LABELS[step]}
              </p>
            </div>
          );
        })}
      </div>

      {history && history.length > 0 && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <h4 className="mb-2 text-sm font-semibold text-gray-700">Updates</h4>
          <ul className="space-y-2 text-sm">
            {[...history]
              .sort(
                (a, b) =>
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )
              .map((h, i) => (
                <li key={i} className="flex justify-between gap-2 text-gray-600">
                  <span>
                    {ORDER_STATUS_LABELS[h.status as StoreOrderStatus] ?? h.status}
                    {h.note ? ` — ${h.note}` : ""}
                  </span>
                  <span className="shrink-0 text-xs">
                    {new Date(h.created_at).toLocaleString("en-IN")}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

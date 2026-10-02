import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  subtext?: string;
  className?: string;
  onClick?: () => void;
  clickableHint?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color = "bg-green-600",
  subtext,
  className,
  onClick,
  clickableHint,
}: StatCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "admin-card p-3 sm:p-5 text-left transition-all",
        isClickable &&
          "cursor-pointer hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            <p className="text-xs font-medium text-gray-500 sm:text-sm">{label}</p>
            {isClickable && (
              <span className="rounded bg-blue-50 px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold text-blue-700 border border-blue-200">
                {clickableHint ?? "Breakdown"}
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-lg font-bold text-gray-900 sm:text-2xl">{value}</p>
          {subtext && <p className="mt-0.5 text-[11px] sm:text-xs text-gray-500 font-medium truncate sm:whitespace-normal">{subtext}</p>}
        </div>
        <div className={cn("shrink-0 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-white shadow-xs sm:shadow-sm", color)}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
    </div>
  );
}

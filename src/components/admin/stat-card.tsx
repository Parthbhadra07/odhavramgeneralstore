import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  subtext?: string;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, color = "bg-green-600", subtext, className }: StatCardProps) {
  return (
    <div className={cn("admin-card p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 sm:text-sm">{label}</p>
          <p className="mt-1 truncate text-xl font-bold text-gray-900 sm:text-2xl">{value}</p>
          {subtext && <p className="mt-0.5 text-xs text-gray-500">{subtext}</p>}
        </div>
        <div className={cn("shrink-0 rounded-xl p-2.5 text-white shadow-sm", color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

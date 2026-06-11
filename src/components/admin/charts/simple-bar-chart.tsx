"use client";

import { cn } from "@/utils/cn";

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

interface SimpleBarChartProps {
  data: ChartDatum[];
  formatValue?: (v: number) => string;
  className?: string;
  height?: number;
}

export function SimpleBarChart({
  data,
  formatValue = (v) => String(v),
  className,
  height = 200,
}: SimpleBarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  if (!data.length) {
    return (
      <div className={cn("flex items-center justify-center text-sm text-gray-500", className)} style={{ height }}>
        No data
      </div>
    );
  }

  return (
    <div className={cn("flex items-end gap-2", className)} style={{ height }}>
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-medium text-gray-600 sm:text-xs">
              {formatValue(d.value)}
            </span>
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${Math.max(pct, 4)}%`,
                backgroundColor: d.color ?? "#16a34a",
                minHeight: d.value > 0 ? 4 : 0,
              }}
              title={`${d.label}: ${formatValue(d.value)}`}
            />
            <span className="max-w-full truncate text-center text-[10px] text-gray-500 sm:text-xs">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

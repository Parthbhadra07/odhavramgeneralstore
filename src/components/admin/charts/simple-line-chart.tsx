"use client";

import { cn } from "@/utils/cn";

export interface LineChartDatum {
  label: string;
  value: number;
}

interface SimpleLineChartProps {
  data: LineChartDatum[];
  formatValue?: (v: number) => string;
  className?: string;
  height?: number;
  color?: string;
}

export function SimpleLineChart({
  data,
  formatValue = (v) => String(v),
  className,
  height = 180,
  color = "#16a34a",
}: SimpleLineChartProps) {
  if (!data.length) {
    return (
      <div className={cn("flex items-center justify-center text-sm text-gray-500", className)} style={{ height }}>
        No data
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 100;
  const h = 100;
  const pad = 4;
  const points = data.map((d, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - (d.value / max) * (h - pad * 2);
    return { x, y, ...d };
  });
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z`;

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#lineGrad)" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {points.map((p) => (
          <circle key={p.label} cx={p.x} cy={p.y} r="1.8" fill={color} />
        ))}
      </svg>
      <div className="mt-2 flex justify-between gap-1 text-[10px] text-gray-500 sm:text-xs">
        {data.map((d) => (
          <span key={d.label} className="truncate text-center" title={`${d.label}: ${formatValue(d.value)}`}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

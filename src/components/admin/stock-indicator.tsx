"use client";

import { cn } from "@/utils/cn";

type StockLevel = "critical" | "low" | "healthy";

export function getStockLevel(
  current: number,
  minLevel: number | null | undefined
): StockLevel {
  const min = minLevel ?? 5;
  if (current <= 0) return "critical";
  if (current <= min) return "low";
  if (current <= min * 2) return "low";
  return "healthy";
}

export function getExpiryLevel(expiryDate: string | null | undefined): StockLevel | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  const days = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "critical";
  if (days <= 7) return "critical";
  if (days <= 30) return "low";
  return "healthy";
}

const levelStyles: Record<StockLevel, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  low: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  healthy: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
};

const levelLabels: Record<StockLevel, string> = {
  critical: "Critical",
  low: "Low",
  healthy: "Healthy",
};

export function StockIndicator({
  level,
  label,
  className,
}: {
  level: StockLevel;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        levelStyles[level],
        className
      )}
    >
      {label ?? levelLabels[level]}
    </span>
  );
}

"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface ActionButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger" | "primary";
  disabled?: boolean;
}

const variants = {
  default: "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
  danger: "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30",
  primary: "text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30",
};

export function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "default",
  disabled,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "rounded-lg p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant]
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface AdminFabProps {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  className?: string;
}

export function AdminFab({ label, icon: Icon, onClick, className }: AdminFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "fixed bottom-6 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lg shadow-green-600/30 transition-all hover:scale-105 hover:bg-green-700 hover:shadow-xl active:scale-95 lg:hidden",
        "mb-[env(safe-area-inset-bottom)] mr-[env(safe-area-inset-right)]",
        className
      )}
    >
      <Icon className="h-6 w-6" />
    </button>
  );
}

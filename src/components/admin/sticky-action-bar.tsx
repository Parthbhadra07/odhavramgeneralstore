"use client";

import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface StickyActionBarProps {
  children: ReactNode;
  className?: string;
}

/** Fixed bottom action bar for mobile admin — sits above safe area */
export function StickyActionBar({ children, className }: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm lg:hidden",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className
      )}
    >
      <div className="mx-auto flex max-w-lg items-center justify-center gap-2">{children}</div>
    </div>
  );
}

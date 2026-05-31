import { Phone } from "lucide-react";
import { STORE_PHONE, STORE_PHONE_DISPLAY, STORE_PHONE_TEL } from "@/lib/constants";
import { cn } from "@/utils/cn";

export function CallStoreButton({
  className,
  variant = "primary",
}: {
  className?: string;
  variant?: "primary" | "outline" | "link";
}) {
  const styles = {
    primary: "inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700",
    outline: "inline-flex items-center gap-2 rounded-lg border-2 border-green-600 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50",
    link: "inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:underline",
  };

  return (
    <a href={STORE_PHONE_TEL} className={cn(styles[variant], className)}>
      <Phone className="h-4 w-4" />
      <span className="sm:hidden">Call</span>
      <span className="hidden sm:inline">Call {STORE_PHONE_DISPLAY}</span>
      <span className="sm:hidden">{STORE_PHONE}</span>
    </a>
  );
}

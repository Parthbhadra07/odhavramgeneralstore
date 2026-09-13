"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, ExternalLink, QrCode, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { settingsService } from "@/services/erp/settings.service";
import { APP_NAME, STORE_UPI_ID } from "@/lib/constants";
import { formatPrice } from "@/utils/format";
import { cn } from "@/utils/cn";

interface OnlinePaymentQrProps {
  amount: number;
  orderNumber?: string;
  utr?: string;
  onUtrChange?: (utr: string) => void;
  className?: string;
  compact?: boolean;
  readOnlyUtr?: boolean;
}

export function OnlinePaymentQr({
  amount,
  orderNumber,
  utr = "",
  onUtrChange,
  className,
  compact = false,
  readOnlyUtr = false,
}: OnlinePaymentQrProps) {
  const { settings } = useStoreSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const upiId = settings?.upi_id?.trim() || STORE_UPI_ID;
  const storeName = (settings?.upi_merchant_name ?? settings?.store_name ?? APP_NAME).trim();
  const note = orderNumber ? `Order ${orderNumber}` : `Order at ${storeName}`;

  const currentSettings = settings ?? {
    ...settingsService.getDefaults(),
    id: "default",
    created_at: "",
    updated_at: "",
  };

  const upiUrl = settingsService.buildUpiUrl(
    { ...currentSettings, upi_id: upiId, store_name: storeName },
    amount,
    note
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !upiUrl) return;

    QRCode.toCanvas(canvas, upiUrl, {
      width: compact ? 180 : 210,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    }).catch((err) => {
      console.error("QR Code generation error:", err);
    });
  }, [upiUrl, compact]);

  const handleCopyUpi = async () => {
    if (!upiId) return;
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      toast.success("UPI ID copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy UPI ID. Please copy manually.");
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/50 via-white to-white p-5 shadow-sm",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-emerald-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
              Instant UPI / QR Payment
            </h3>
            <p className="text-xs text-emerald-700 font-medium">{storeName}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 block">
            Payable Amount
          </span>
          <span className="text-base sm:text-lg font-bold text-emerald-700">
            {formatPrice(amount)}
          </span>
        </div>
      </div>

      {/* QR & Scan Body */}
      <div className="mt-4 flex flex-col items-center">
        {/* Frame container */}
        <div className="relative rounded-2xl border-2 border-emerald-500/30 bg-white p-3 shadow-md">
          {/* Subtle corner indicators */}
          <div className="absolute top-1.5 left-1.5 h-3 w-3 border-t-2 border-l-2 border-emerald-600 rounded-tl-sm pointer-events-none" />
          <div className="absolute top-1.5 right-1.5 h-3 w-3 border-t-2 border-r-2 border-emerald-600 rounded-tr-sm pointer-events-none" />
          <div className="absolute bottom-1.5 left-1.5 h-3 w-3 border-b-2 border-l-2 border-emerald-600 rounded-bl-sm pointer-events-none" />
          <div className="absolute bottom-1.5 right-1.5 h-3 w-3 border-b-2 border-r-2 border-emerald-600 rounded-br-sm pointer-events-none" />

          <canvas ref={canvasRef} className="block rounded-lg" />
        </div>

        <p className="mt-2 text-center text-xs text-gray-600">
          Scan with <span className="font-semibold text-gray-800">Google Pay, PhonePe, Paytm</span> or any UPI App
        </p>

        {/* 1-Tap UPI Mobile Intent Button */}
        {upiUrl && (
          <a
            href={upiUrl}
            className="mt-3 flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98]"
          >
            <Smartphone className="h-4 w-4" />
            <span>Pay via any UPI App</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </a>
        )}

        {/* UPI ID Row with Copy Button */}
        <div className="mt-3 flex w-full max-w-xs items-center justify-between rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-1.5 text-xs">
          <div className="truncate pr-2">
            <span className="text-gray-500 mr-1.5">UPI ID:</span>
            <span className="font-mono font-medium text-gray-900 select-all">{upiId}</span>
          </div>
          <button
            type="button"
            onClick={handleCopyUpi}
            className="inline-flex shrink-0 items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200 shadow-2xs hover:bg-emerald-50 active:scale-95 transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Optional UTR / Reference ID */}
      {onUtrChange && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Already paid? Enter 12-digit UPI UTR / Reference No. (Optional)
          </label>
          <input
            type="text"
            value={utr}
            disabled={readOnlyUtr}
            onChange={(e) => onUtrChange(e.target.value)}
            placeholder="e.g. 425689123456"
            maxLength={20}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs sm:text-sm font-mono focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Helps our team verify and approve your order immediately.
          </p>
        </div>
      )}

      {/* Trust Footer */}
      <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        <span>100% Direct & Safe Payment to {storeName}</span>
      </div>
    </div>
  );
}

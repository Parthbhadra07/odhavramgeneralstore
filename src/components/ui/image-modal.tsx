"use client";

import { useEffect, useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from "lucide-react";

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  src?: string | null;
  alt?: string;
  title?: string;
  subtitle?: string;
}

export function ImageModal({
  isOpen,
  onClose,
  src,
  alt = "Product Photo",
  title,
  subtitle,
}: ImageModalProps) {
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsZoomed(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Modal Dialog Card */}
      <div
        className="relative flex flex-col max-h-[96vh] max-w-[94vw] w-full sm:w-auto items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="mb-2 flex w-full items-center justify-between gap-3 px-2 text-white">
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="truncate text-sm sm:text-base font-bold text-white drop-shadow-sm">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="truncate text-xs text-gray-300 drop-shadow-sm">
                {subtitle}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsZoomed(!isZoomed)}
              className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/30"
              title={isZoomed ? "Fit to screen" : "Zoom in"}
            >
              {isZoomed ? (
                <>
                  <ZoomOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Fit to Screen</span>
                </>
              ) : (
                <>
                  <ZoomIn className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Zoom 150%</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/30"
              aria-label="Close photo view"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Image Display Container (Strictly Fit to Screen) */}
        <div
          className={`relative overflow-auto rounded-2xl bg-white/10 p-2 sm:p-4 backdrop-blur-xs border border-white/20 shadow-2xl transition-all duration-300 flex items-center justify-center ${
            isZoomed
              ? "max-h-[85vh] max-w-[92vw] cursor-zoom-out"
              : "max-h-[82vh] max-w-[90vw] cursor-zoom-in"
          }`}
          onClick={() => setIsZoomed(!isZoomed)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className={`object-contain transition-all duration-300 rounded-lg select-none ${
              isZoomed
                ? "scale-150 transform max-h-none max-w-none"
                : "max-h-[75vh] max-w-[85vw] w-auto h-auto"
            }`}
            loading="eager"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = "none";
            }}
          />
        </div>

        {/* Footer tip */}
        <p className="mt-2 text-center text-[11px] text-gray-400">
          Photo adjusted &amp; fit to screen · Tap image to {isZoomed ? "reset view" : "zoom"} · Press Esc or tap outside to close
        </p>
      </div>
    </div>
  );
}

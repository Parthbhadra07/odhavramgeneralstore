"use client";

import { useEffect, useId, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, Keyboard, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  normalizeScannedBarcode,
  RETAIL_BARCODE_FORMATS,
} from "@/lib/barcode-scan-formats";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose?: () => void;
  className?: string;
  /** Prefer camera when opening (e.g. product form). POS often uses keyboard wedge. */
  defaultMode?: "camera" | "keyboard";
}

function retailScanBox(viewfinderWidth: number, viewfinderHeight: number) {
  const width = Math.min(Math.floor(viewfinderWidth * 0.92), 420);
  const height = Math.min(Math.floor(viewfinderHeight * 0.35), 140);
  return { width: Math.max(width, 200), height: Math.max(height, 80) };
}

export function BarcodeScanner({
  onScan,
  onClose,
  className,
  defaultMode = "keyboard",
}: BarcodeScannerProps) {
  const [mode, setMode] = useState<"camera" | "keyboard">(defaultMode);
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const containerId = `erp-barcode-scanner-${useId().replace(/:/g, "")}`;

  const emitScan = useCallback(
    (raw: string) => {
      const code = normalizeScannedBarcode(raw);
      if (code) onScan(code);
    },
    [onScan]
  );

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // already stopped
      }
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (mode !== "camera") {
      void stopCamera();
      return;
    }

    let cancelled = false;
    const start = async () => {
      setError(null);
      try {
        const scanner = new Html5Qrcode(containerId, {
          formatsToSupport: RETAIL_BARCODE_FORMATS,
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 12,
            qrbox: retailScanBox,
            aspectRatio: 1.777,
            disableFlip: false,
          },
          (decoded) => {
            emitScan(decoded);
            void stopCamera();
            setMode("keyboard");
          },
          () => {}
        );
        if (cancelled) await stopCamera();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Camera access denied or unavailable"
        );
        setMode("keyboard");
      }
    };
    void start();
    return () => {
      cancelled = true;
      void stopCamera();
    };
  }, [mode, emitScan, stopCamera, containerId]);

  const commitManualCode = () => {
    const code = manualCode.trim();
    if (code) {
      emitScan(code);
      setManualCode("");
    }
  };

  const handleManualKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    commitManualCode();
  };

  const scanFromPhoto = async (file: File) => {
    setPhotoLoading(true);
    setError(null);
    try {
      await stopCamera();
      const scanner = new Html5Qrcode(containerId, {
        formatsToSupport: RETAIL_BARCODE_FORMATS,
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });
      const result = await scanner.scanFile(file, false);
      scanner.clear();
      emitScan(result);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No barcode found in image. Center the lines and try again."
      );
    } finally {
      setPhotoLoading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "keyboard" ? "primary" : "outline"}
            onClick={() => setMode("keyboard")}
          >
            <Keyboard className="mr-1 h-4 w-4" />
            Scanner / Manual
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "camera" ? "primary" : "outline"}
            onClick={() => setMode("camera")}
          >
            <Camera className="mr-1 h-4 w-4" />
            Camera
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={photoLoading}
            onClick={() => photoInputRef.current?.click()}
          >
            <Upload className="mr-1 h-4 w-4" />
            Photo
          </Button>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="text-gray-500">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void scanFromPhoto(file);
        }}
      />

      {error && <p className="mb-2 text-sm text-amber-700">{error}</p>}

      {mode === "camera" && (
        <>
          <div
            id={containerId}
            className="overflow-hidden rounded-lg border bg-black"
          />
          <p className="mt-2 text-xs text-gray-500">
            Hold the product barcode horizontal in the box. Works with EAN-13 and
            UPC on packaged goods.
          </p>
        </>
      )}

      {mode === "keyboard" && (
        <div className="space-y-2">
          <Input
            autoFocus
            placeholder="Scan barcode or type number..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={handleManualKeyDown}
            className="font-mono"
          />
          <p className="text-xs text-gray-500">
            USB barcode scanners work as keyboard input — focus this field and scan.
          </p>
        </div>
      )}
    </div>
  );
}

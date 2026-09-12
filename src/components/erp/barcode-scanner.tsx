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
  onScan: (barcode: string) => void | Promise<void>;
  onClose?: () => void;
  className?: string;
  /** Prefer camera when opening (e.g. product form). POS often uses keyboard wedge. */
  defaultMode?: "camera" | "keyboard";
  /** Keep the camera running so the next item can be scanned immediately. */
  continuous?: boolean;
}

function retailScanBox(viewfinderWidth: number, viewfinderHeight: number) {
  const width = Math.max(240, Math.floor(viewfinderWidth * 0.96));
  const height = Math.max(120, Math.floor(viewfinderHeight * 0.4));
  return { width, height };
}

export function BarcodeScanner({
  onScan,
  onClose,
  className,
  defaultMode = "keyboard",
  continuous = true,
}: BarcodeScannerProps) {
  const [mode, setMode] = useState<"camera" | "keyboard">(defaultMode);
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef({ code: "", at: 0 });
  const scanningLockRef = useRef(false);
  const onScanRef = useRef(onScan);
  const containerId = `erp-barcode-scanner-${useId().replace(/:/g, "")}`;

  onScanRef.current = onScan;

  const emitScan = useCallback(async (raw: string) => {
    const code = normalizeScannedBarcode(raw);
    if (!code) return false;
    const now = Date.now();
    if (code === lastScanRef.current.code && now - lastScanRef.current.at < 1500) {
      return false;
    }
    if (scanningLockRef.current) return false;
    lastScanRef.current = { code, at: now };
    scanningLockRef.current = true;
    try {
      await onScanRef.current(code);
      return true;
    } finally {
      scanningLockRef.current = false;
    }
  }, []);

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

        const videoConstraints: MediaTrackConstraints = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        };

        try {
          const cameras = await Html5Qrcode.getCameras();
          const back = [...cameras].reverse().find((c) =>
            /back|rear|environment|world/i.test(c.label)
          );
          const chosen = back ?? cameras[cameras.length - 1];
          if (chosen?.id) {
            videoConstraints.deviceId = { exact: chosen.id };
          } else {
            videoConstraints.facingMode = { ideal: "environment" };
          }
        } catch {
          videoConstraints.facingMode = { ideal: "environment" };
        }

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: retailScanBox,
            disableFlip: false,
            videoConstraints,
          },
          (decoded) => {
            void emitScan(decoded).then((accepted) => {
              if (!accepted || continuous || cancelled) return;
              void stopCamera();
              setMode("keyboard");
            });
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
  }, [mode, emitScan, stopCamera, containerId, continuous]);

  const commitManualCode = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    void emitScan(code);
    setManualCode("");
  };

  const handleManualChange = (value: string) => {
    setManualCode(value);
  };

  const handleManualKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    commitManualCode(e.currentTarget.value || manualCode);
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
      await emitScan(result);
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
            Hold the barcode in the box. Camera stays on so you can scan the next item right away.
          </p>
        </>
      )}

      {mode === "keyboard" && (
        <div className="space-y-2">
          <Input
            autoFocus
            placeholder="Scan barcode or type number..."
            value={manualCode}
            onChange={(e) => handleManualChange(e.target.value)}
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

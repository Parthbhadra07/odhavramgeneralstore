"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, Keyboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose?: () => void;
  className?: string;
}

export function BarcodeScanner({ onScan, onClose, className }: BarcodeScannerProps) {
  const [mode, setMode] = useState<"camera" | "keyboard">("keyboard");
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "erp-barcode-scanner";

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
      try {
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decoded) => {
            onScan(decoded);
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
  }, [mode, onScan, stopCamera]);

  const handleKeyboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (code) {
      onScan(code);
      setManualCode("");
    }
  };

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex gap-2">
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
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="text-gray-500">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {error && <p className="mb-2 text-sm text-amber-700">{error}</p>}

      {mode === "camera" && (
        <div
          id={containerId}
          className="overflow-hidden rounded-lg border bg-black"
        />
      )}

      {mode === "keyboard" && (
        <form onSubmit={handleKeyboardSubmit} className="space-y-2">
          <Input
            autoFocus
            placeholder="Scan barcode or type SKU / barcode..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="font-mono"
          />
          <p className="text-xs text-gray-500">
            USB barcode scanners work as keyboard input — focus this field and scan.
          </p>
        </form>
      )}
    </div>
  );
}

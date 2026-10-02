"use client";

import { useEffect, useId, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, Keyboard, Upload, X, Zap, ZoomIn, RefreshCw, Sun, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  normalizeScannedBarcode,
  RETAIL_BARCODE_FORMATS,
} from "@/lib/barcode-scan-formats";
import { toast } from "sonner";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void | Promise<void>;
  onClose?: () => void;
  className?: string;
  /** Prefer camera when opening (e.g. product form). POS often uses keyboard wedge. */
  defaultMode?: "camera" | "keyboard";
  /** Keep the camera running so the next item can be scanned immediately. */
  continuous?: boolean;
}

function adaptiveScanBox(viewfinderWidth: number, viewfinderHeight: number) {
  // Adaptive scanning box: Works for both square QR codes & horizontal 1D barcodes
  const minDim = Math.min(viewfinderWidth, viewfinderHeight);
  const size = Math.max(220, Math.floor(minDim * 0.72));
  return { width: size, height: size };
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

  // Camera hardware controls (autofocus, zoom, torch)
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasZoom, setHasZoom] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [maxZoom, setMaxZoom] = useState(3);
  const [isFocusing, setIsFocusing] = useState(false);

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

  const getMediaTrack = useCallback((): MediaStreamTrack | null => {
    try {
      const container = document.getElementById(containerId);
      const video = container?.querySelector("video") as HTMLVideoElement | null;
      if (video?.srcObject) {
        const stream = video.srcObject as MediaStream;
        return stream.getVideoTracks()[0] ?? null;
      }
    } catch {}
    return null;
  }, [containerId]);

  const configureTrackCapabilities = useCallback(() => {
    const track = getMediaTrack();
    if (!track) return;

    try {
      const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;

      // 1. Enable Continuous Auto-Focus to prevent close-up blur
      if (capabilities.focusMode?.includes("continuous")) {
        void track.applyConstraints({
          advanced: [{ focusMode: "continuous" } as any],
        }).catch(() => {});
      }

      // 2. Detect Torch / Flashlight support
      if ("torch" in capabilities) {
        setHasTorch(true);
      }

      // 3. Detect Optical / Digital Zoom support
      if (capabilities.zoom) {
        setHasZoom(true);
        setMaxZoom(Math.min(capabilities.zoom.max || 3, 4));
      }
    } catch {}
  }, [getMediaTrack]);

  const triggerRefocus = useCallback(async () => {
    const track = getMediaTrack();
    if (!track) return;
    setIsFocusing(true);
    try {
      // Toggle focus mode or re-apply continuous to trigger lens refocus
      await track.applyConstraints({
        advanced: [
          { focusMode: "continuous" } as any,
          { focusDistance: 0.12 } as any, // macro focal distance for close barcodes
        ],
      });
      toast.info("Refocusing camera lens...");
    } catch {
      // Fallback constraint
      try {
        await track.applyConstraints({
          advanced: [{ focusMode: "continuous" } as any],
        });
      } catch {}
    } finally {
      setTimeout(() => setIsFocusing(false), 600);
    }
  }, [getMediaTrack]);

  const applyZoom = useCallback(async (level: number) => {
    const track = getMediaTrack();
    setZoomLevel(level);
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ zoom: level } as any],
      });
    } catch {}
  }, [getMediaTrack]);

  const toggleTorch = useCallback(async () => {
    const track = getMediaTrack();
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as any],
      });
      setTorchOn(next);
      toast.success(next ? "Torch on" : "Torch off");
    } catch {
      toast.error("Could not toggle flashlight");
    }
  }, [getMediaTrack, torchOn]);

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setTorchOn(false);
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

        // Enhanced Video constraints with continuous autofocus & ideal resolution for close-up scanning
        const videoConstraints: MediaTrackConstraints = {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 },
          advanced: [
            { focusMode: "continuous" } as any,
          ],
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
            fps: 20,
            qrbox: adaptiveScanBox,
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

        if (cancelled) {
          await stopCamera();
        } else {
          // Once camera is running, configure hardware capabilities (focus, zoom, torch)
          setTimeout(() => {
            configureTrackCapabilities();
          }, 350);
        }
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
  }, [mode, emitScan, stopCamera, containerId, continuous, configureTrackCapabilities]);

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
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "keyboard" ? "primary" : "outline"}
            onClick={() => setMode("keyboard")}
            className="text-xs h-8 px-2.5 sm:px-3"
          >
            <Keyboard className="mr-1 h-3.5 w-3.5" />
            Scanner / Manual
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "camera" ? "primary" : "outline"}
            onClick={() => setMode("camera")}
            className="text-xs h-8 px-2.5 sm:px-3"
          >
            <Camera className="mr-1 h-3.5 w-3.5" />
            Camera
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={photoLoading}
            onClick={() => photoInputRef.current?.click()}
            className="text-xs h-8 px-2.5 sm:px-3"
          >
            <Upload className="mr-1 h-3.5 w-3.5" />
            Photo
          </Button>
        </div>

        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
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

      {error && <p className="mb-2 text-xs sm:text-sm font-medium text-amber-700">{error}</p>}

      {mode === "camera" && (
        <div className="space-y-2">
          {/* Camera Viewfinder with click-to-refocus */}
          <div
            id={containerId}
            onClick={() => void triggerRefocus()}
            className={`relative overflow-hidden rounded-xl border-2 border-slate-700 bg-black cursor-pointer transition-all ${
              isFocusing ? "ring-2 ring-emerald-400" : ""
            }`}
            title="Click or tap camera view to refocus"
          />

          {/* Camera Hardware Control Bar: Focus, Zoom & Torch */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900 px-3 py-2 text-white">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void triggerRefocus()}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  isFocusing ? "bg-emerald-500 text-white animate-pulse" : "bg-white/10 hover:bg-white/20 text-emerald-300"
                }`}
                title="Tap to force camera autofocus"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFocusing ? "animate-spin" : ""}`} />
                <span>Refocus</span>
              </button>

              {hasTorch && (
                <button
                  type="button"
                  onClick={() => void toggleTorch()}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    torchOn ? "bg-amber-500 text-black shadow-xs" : "bg-white/10 hover:bg-white/20 text-amber-300"
                  }`}
                  title="Toggle Flashlight / Torch"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>{torchOn ? "Torch On" : "Torch"}</span>
                </button>
              )}
            </div>

            {/* Zoom presets: 1x, 1.5x, 2x */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Zoom:</span>
              {[1, 1.5, 2].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => void applyZoom(lvl)}
                  className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold transition-all ${
                    zoomLevel === lvl
                      ? "bg-emerald-600 text-white"
                      : "bg-white/10 text-slate-300 hover:bg-white/20"
                  }`}
                >
                  {lvl}x
                </button>
              ))}
            </div>
          </div>

          {/* Anti-blur User Tip */}
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 p-2 text-[11px] text-emerald-900 border border-emerald-200">
            <Lightbulb className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
            <span>
              <strong>Tip for blur:</strong> Keep phone 15–20 cm away or tap <strong>1.5x / 2x Zoom</strong>. Tap viewfinder anytime to refocus!
            </span>
          </div>
        </div>
      )}

      {mode === "keyboard" && (
        <div className="space-y-2">
          <Input
            autoFocus
            placeholder="Scan barcode gun or type number..."
            value={manualCode}
            onChange={(e) => handleManualChange(e.target.value)}
            onKeyDown={handleManualKeyDown}
            className="font-mono text-sm"
          />
          <p className="text-xs text-gray-500">
            USB or Bluetooth barcode scanners work as keyboard input — focus this field and scan.
          </p>
        </div>
      )}
    </div>
  );
}

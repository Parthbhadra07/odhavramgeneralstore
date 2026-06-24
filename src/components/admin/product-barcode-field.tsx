"use client";

import { useId, useRef, useState } from "react";
import { ScanBarcode, Upload } from "lucide-react";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import { BarcodeScanner } from "@/components/erp/barcode-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  normalizeScannedBarcode,
  RETAIL_BARCODE_FORMATS,
} from "@/lib/barcode-scan-formats";

interface ProductBarcodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function ProductBarcodeField({
  value,
  onChange,
  error,
}: ProductBarcodeFieldProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const scanContainerId = useId().replace(/:/g, "");

  const applyBarcode = (raw: string) => {
    const code = normalizeScannedBarcode(raw);
    if (!code) return;
    onChange(code);
    setShowScanner(false);
    toast.success(`Barcode set: ${code}`);
  };

  const scanFromPhoto = async (file: File) => {
    setPhotoLoading(true);
    try {
      const scanner = new Html5Qrcode(`photo-scan-${scanContainerId}`, {
        formatsToSupport: RETAIL_BARCODE_FORMATS,
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });
      const result = await scanner.scanFile(file, false);
      scanner.clear();
      applyBarcode(result);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Could not read barcode from photo. Try better lighting or type the number."
      );
    } finally {
      setPhotoLoading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Barcode (from package)
      </label>
      <div className="flex flex-wrap gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="EAN / UPC number on product"
          className="min-w-[12rem] flex-1 font-mono"
          error={error}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowScanner((s) => !s)}
        >
          <ScanBarcode className="mr-1 h-4 w-4" />
          {showScanner ? "Hide scanner" : "Scan barcode"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={photoLoading}
          onClick={() => photoInputRef.current?.click()}
        >
          <Upload className="mr-1 h-4 w-4" />
          Photo
        </Button>
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
        <div id={`photo-scan-${scanContainerId}`} className="hidden" aria-hidden />
      </div>
      <p className="text-xs text-gray-500">
        Use the number printed on the product (EAN-13 / UPC). USB scanner guns work
        when the scanner field below is focused.
      </p>

      {showScanner && (
        <div className="rounded-lg border bg-gray-50 p-3">
          <BarcodeScanner
            defaultMode="camera"
            onScan={applyBarcode}
            onClose={() => setShowScanner(false)}
          />
        </div>
      )}
    </div>
  );
}

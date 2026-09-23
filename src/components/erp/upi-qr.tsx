"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface UpiQrProps {
  upiUrl: string;
  size?: number;
  className?: string;
}

export function UpiQr({ upiUrl, size = 120, className }: UpiQrProps) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    if (!upiUrl) {
      setDataUrl("");
      return;
    }
    // High-resolution rendering for sharp 203/300 DPI thermal printing
    QRCode.toDataURL(upiUrl, {
      width: Math.max(160, size * 2),
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then(setDataUrl)
      .catch((err) => {
        console.warn("Failed to generate UPI QR data URL", err);
      });
  }, [upiUrl, size]);

  if (!dataUrl) {
    return (
      <div
        className={`receipt-qr-wrap ${className ?? ""}`}
        style={{ width: size, height: size, background: "#ffffff" }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="UPI QR Code"
      data-upi-url={upiUrl}
      className={`receipt-qr-img mx-auto block bg-white ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        display: "block",
        margin: "0 auto",
        imageRendering: "pixelated",
        background: "#ffffff",
      }}
    />
  );
}


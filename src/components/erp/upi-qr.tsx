"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface UpiQrProps {
  upiUrl: string;
  size?: number;
  className?: string;
}

export function UpiQr({ upiUrl, size = 120, className }: UpiQrProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !upiUrl) return;
    QRCode.toCanvas(canvas, upiUrl, {
      width: size,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {});
  }, [upiUrl, size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}

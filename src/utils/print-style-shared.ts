import type { BarcodeFontFamily, PrintDensity } from "@/types/erp";

export const PRINT_FONT_CSS: Record<BarcodeFontFamily, string> = {
  arial: "Arial, Helvetica, sans-serif",
  courier: '"Courier New", Courier, monospace',
  helvetica: "Helvetica, Arial, sans-serif",
  verdana: "Verdana, Geneva, sans-serif",
};

export const PRINT_DENSITY_WEIGHT: Record<PrintDensity, number> = {
  light: 400,
  normal: 500,
  dark: 700,
};

export const PRINT_DENSITY_BORDER: Record<PrintDensity, string> = {
  light: "1px",
  normal: "2px",
  dark: "3px",
};

export function scaleReceiptFontSize(basePx: number, density: PrintDensity): string {
  const factor = density === "light" ? 0.92 : density === "dark" ? 1.08 : 1;
  return `${Math.round(basePx * factor)}px`;
}

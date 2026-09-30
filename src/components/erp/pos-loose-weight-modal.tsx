"use client";

import { useState, useEffect, useRef } from "react";
import { Scale, Check, X, IndianRupee, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/utils/format";
import type { ErpProduct, ProductLot } from "@/types/erp";

export interface LooseWeightConfirmResult {
  weightInKg: number;
  rate: number;
  totalAmount: number;
  unit: string;
}

export type LooseModalProduct =
  | ErpProduct
  | (Partial<ErpProduct> & {
      name: string;
      price: number;
      selling_price?: number | null;
      unit?: string | null;
      stock?: number;
    });

export type LooseModalLot =
  | ProductLot
  | {
      id: string;
      barcode?: string;
      current_stock?: number;
      selling_price?: number | null;
    }
  | null;

interface PosLooseWeightModalProps {
  isOpen: boolean;
  product: LooseModalProduct | null;
  lot?: LooseModalLot;
  initialWeight?: number; // in kg
  onConfirm: (result: LooseWeightConfirmResult) => void;
  onClose: () => void;
}

const QUICK_WEIGHTS_GRAMS = [
  { label: "100 g", grams: 100 },
  { label: "250 g", grams: 250 },
  { label: "500 g", grams: 500 },
  { label: "750 g", grams: 750 },
  { label: "1 kg", grams: 1000 },
  { label: "1.5 kg", grams: 1500 },
  { label: "2 kg", grams: 2000 },
  { label: "5 kg", grams: 5000 },
];

export function PosLooseWeightModal({
  isOpen,
  product,
  lot,
  initialWeight,
  onConfirm,
  onClose,
}: PosLooseWeightModalProps) {
  const [entryMode, setEntryMode] = useState<"weight" | "amount">("weight");
  const [weightUnit, setWeightUnit] = useState<"g" | "kg">("g");
  const [weightInputValue, setWeightInputValue] = useState<string>("500");
  const [amountInputValue, setAmountInputValue] = useState<string>("");

  const inputRef = useRef<HTMLInputElement>(null);

  // Derive unit price (per kg or base unit)
  const rate = Number(
    lot?.selling_price ?? product?.selling_price ?? product?.price ?? 0
  );
  const baseUnit = product?.unit?.toLowerCase() || "kg";

  // Reset values when modal opens or product changes
  useEffect(() => {
    if (isOpen && product) {
      if (initialWeight && initialWeight > 0) {
        if (initialWeight < 1) {
          setWeightUnit("g");
          setWeightInputValue(String(Math.round(initialWeight * 1000)));
        } else {
          setWeightUnit("kg");
          setWeightInputValue(String(initialWeight));
        }
      } else {
        setWeightUnit("g");
        setWeightInputValue("500");
      }
      setAmountInputValue("");
      setEntryMode("weight");

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 80);
    }
  }, [isOpen, product, initialWeight]);

  if (!isOpen || !product) return null;

  // Calculate effective weight in kg
  let calculatedWeightKg = 0;
  let calculatedTotalAmount = 0;

  if (entryMode === "weight") {
    const parsed = parseFloat(weightInputValue) || 0;
    if (weightUnit === "g") {
      calculatedWeightKg = parsed / 1000;
    } else {
      calculatedWeightKg = parsed;
    }
    calculatedTotalAmount = Math.round(calculatedWeightKg * rate * 100) / 100;
  } else {
    // Calculated by Target Amount
    const parsedAmount = parseFloat(amountInputValue) || 0;
    if (rate > 0) {
      calculatedWeightKg = Math.round((parsedAmount / rate) * 1000) / 1000;
      calculatedTotalAmount = parsedAmount;
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const handleQuickWeightSelect = (grams: number) => {
    setEntryMode("weight");
    if (grams < 1000) {
      setWeightUnit("g");
      setWeightInputValue(String(grams));
    } else {
      setWeightUnit("kg");
      setWeightInputValue(String(grams / 1000));
    }
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleConfirm = () => {
    if (calculatedWeightKg <= 0) {
      return;
    }
    onConfirm({
      weightInKg: Math.round(calculatedWeightKg * 1000) / 1000,
      rate,
      totalAmount: calculatedTotalAmount,
      unit: baseUnit === "kg" || baseUnit === "g" ? "kg" : baseUnit,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-indigo-900 px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-xs">
                <Scale className="h-5 w-5 text-indigo-200" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">
                  Loose Item · Enter Weight
                </span>
                <h3 className="text-base font-bold text-white line-clamp-1">
                  {product.name}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-indigo-200 hover:bg-white/10 hover:text-white transition"
              tabIndex={-1}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-indigo-950/50 px-3 py-2 text-xs border border-indigo-600/50">
            <span className="text-indigo-200">
              Unit Rate: <strong className="text-white text-sm">₹{rate.toFixed(2)}</strong> / {baseUnit}
            </span>
            <span className="text-indigo-200">
              Stock: <strong className="text-white">{product.stock} {baseUnit}</strong>
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Mode Switch Tabs (By Weight vs By Price) */}
          <div className="flex rounded-xl bg-gray-100 p-1 text-xs font-semibold text-gray-600">
            <button
              type="button"
              onClick={() => {
                setEntryMode("weight");
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
                entryMode === "weight"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "hover:text-gray-900"
              }`}
            >
              <Scale className="h-3.5 w-3.5" /> Enter Weight (g / kg)
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryMode("amount");
                setAmountInputValue(calculatedTotalAmount > 0 ? String(calculatedTotalAmount) : "50");
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
                entryMode === "amount"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "hover:text-gray-900"
              }`}
            >
              <IndianRupee className="h-3.5 w-3.5" /> Enter Target Price (₹)
            </button>
          </div>

          {/* Input Area */}
          {entryMode === "weight" ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700">
                  Weight Value:
                </label>
                <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      if (weightUnit !== "g") {
                        const current = parseFloat(weightInputValue) || 0;
                        setWeightInputValue(String(Math.round(current * 1000)));
                        setWeightUnit("g");
                      }
                      inputRef.current?.focus();
                    }}
                    className={`rounded px-2.5 py-1 transition-all ${
                      weightUnit === "g"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Grams (g)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (weightUnit !== "kg") {
                        const current = parseFloat(weightInputValue) || 0;
                        setWeightInputValue(String(current / 1000));
                        setWeightUnit("kg");
                      }
                      inputRef.current?.focus();
                    }}
                    className={`rounded px-2.5 py-1 transition-all ${
                      weightUnit === "kg"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Kilograms (kg)
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  ref={inputRef}
                  type="number"
                  step="any"
                  min="0"
                  value={weightInputValue}
                  onChange={(e) => setWeightInputValue(e.target.value)}
                  placeholder={weightUnit === "g" ? "e.g. 250, 500" : "e.g. 0.5, 1.25"}
                  className="w-full rounded-xl border-2 border-indigo-200 py-3 pl-4 pr-16 text-2xl font-bold font-mono text-gray-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-sm text-gray-500 uppercase">
                  {weightUnit}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Customer Wants Worth (₹):
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-lg text-gray-400">
                  ₹
                </span>
                <input
                  ref={inputRef}
                  type="number"
                  step="any"
                  min="0"
                  value={amountInputValue}
                  onChange={(e) => setAmountInputValue(e.target.value)}
                  placeholder="e.g. 50, 100"
                  className="w-full rounded-xl border-2 border-indigo-200 py-3 pl-9 pr-4 text-2xl font-bold font-mono text-gray-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                Calculates exact weight automatically based on ₹{rate}/{baseUnit}.
              </p>
            </div>
          )}

          {/* Quick Select Chips */}
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Quick Weight Presets:
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_WEIGHTS_GRAMS.map((chip) => (
                <button
                  key={chip.grams}
                  type="button"
                  onClick={() => handleQuickWeightSelect(chip.grams)}
                  className="rounded-lg border border-gray-200 bg-gray-50/70 py-1.5 text-xs font-semibold text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 transition active:scale-95"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Calculation Display Card */}
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/40 p-4">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Calculated Weight:</span>
              <span className="font-mono font-bold text-gray-800 text-sm">
                {calculatedWeightKg >= 1
                  ? `${calculatedWeightKg.toFixed(3)} kg`
                  : `${Math.round(calculatedWeightKg * 1000)} grams (${calculatedWeightKg.toFixed(3)} kg)`}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600 border-b border-emerald-200/60 pb-2 mb-2">
              <span>Rate:</span>
              <span className="font-mono text-gray-700">₹{rate.toFixed(2)} / {baseUnit}</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Total To Bill:
                </span>
                <span className="text-xs text-emerald-700">Calculated automatically</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  {formatPrice(calculatedTotalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-3.5 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs font-medium text-gray-600"
          >
            Cancel (Esc)
          </Button>

          <Button
            type="button"
            onClick={handleConfirm}
            disabled={calculatedWeightKg <= 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 shadow-md gap-1.5"
          >
            <Check className="h-4 w-4" /> Add to Bill (Enter)
          </Button>
        </div>
      </div>
    </div>
  );
}

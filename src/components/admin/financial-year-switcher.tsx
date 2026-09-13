"use client";

import { useEffect, useState, useRef } from "react";
import { Calendar, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import {
  getActiveFinancialYearCode,
  setActiveFinancialYearCode,
  getFinancialYearList,
  getFinancialYear,
} from "@/utils/financial-year";

export function FinancialYearSwitcher({ compact = false }: { compact?: boolean }) {
  const [activeCode, setActiveCode] = useState<string>(() => getActiveFinancialYearCode());
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fyList = getFinancialYearList(2, 1);
  const currentFyInfo = getFinancialYear(activeCode);

  useEffect(() => {
    const handleFyChanged = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setActiveCode(customEvent.detail || getActiveFinancialYearCode());
    };
    window.addEventListener("ogs-fy-changed", handleFyChanged);
    return () => window.removeEventListener("ogs-fy-changed", handleFyChanged);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (code: string) => {
    setActiveFinancialYearCode(code);
    setActiveCode(code);
    setOpen(false);
    const info = getFinancialYear(code);
    toast.success(`Active Financial Year changed to ${info.label}`);
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50/80 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/20"
        title="Change Active Financial Year"
      >
        <Calendar className="h-3.5 w-3.5 text-green-700" />
        <span className="font-semibold text-green-950">
          {compact ? currentFyInfo.code : currentFyInfo.label}
        </span>
        <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-56 rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2.5 py-1.5 border-b border-gray-100 mb-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Financial Year (1 Apr - 31 Mar)
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              Current Quarter: <span className="font-medium text-gray-900">{currentFyInfo.quarterLabel}</span>
            </p>
          </div>

          <div className="space-y-0.5">
            {fyList.map((fy) => {
              const isSelected = activeCode === fy.code;
              return (
                <button
                  key={fy.code}
                  type="button"
                  onClick={() => handleSelect(fy.code)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                    isSelected
                      ? "bg-green-50 font-semibold text-green-800"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>{fy.label}</span>
                    {fy.isCurrent && (
                      <span className="rounded bg-green-100 px-1 py-0.2 text-[10px] font-medium text-green-800">
                        Current
                      </span>
                    )}
                  </span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-green-600" />}
                </button>
              );
            })}
          </div>

          <div className="border-t border-gray-100 mt-1.5 pt-1.5 px-2.5 pb-1">
            <p className="text-[10px] text-gray-400 leading-tight">
              Bill numbers and reports will follow the selected financial year.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

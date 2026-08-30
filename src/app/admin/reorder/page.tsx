"use client";

import { useEffect, useState } from "react";
import { Sparkles, TrendingUp } from "lucide-react";
import { reorderService } from "@/services/erp";
import type { ReorderSuggestion, SalesForecast } from "@/services/erp/reorder.service";
import { formatPrice } from "@/utils/format";

export default function ReorderPage() {
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);
  const [forecast, setForecast] = useState<SalesForecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([reorderService.getSuggestions(), reorderService.forecast()])
      .then(([s, f]) => {
        setSuggestions(s);
        setForecast(f);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-8 text-gray-500">Analyzing sales data…</p>;

  return (
    <div>
      <h1 className="admin-page-title mb-1 flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-green-600" />
        Smart Reorder & Forecast
      </h1>
      <p className="mb-6 text-sm text-gray-600">AI-powered purchase recommendations based on 30-day sales velocity</p>

      {forecast && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="admin-card p-4">
            <p className="flex items-center gap-1 text-sm text-gray-600">
              <TrendingUp className="h-4 w-4" /> Predicted Next Week Sales
            </p>
            <p className="mt-1 text-2xl font-bold text-green-800">{formatPrice(forecast.nextWeekSales)}</p>
          </div>
          <div className="admin-card p-4">
            <p className="text-sm text-gray-600">Predicted Next Month Sales</p>
            <p className="mt-1 text-2xl font-bold text-green-800">{formatPrice(forecast.nextMonthSales)}</p>
            <p className="text-xs text-gray-400">Based on last {forecast.basedOnDays} days</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left font-semibold">Product</th>
              <th className="p-3 text-right font-semibold">Current Stock</th>
              <th className="p-3 text-right font-semibold">Avg Daily Sales</th>
              <th className="p-3 text-right font-semibold">Days Left</th>
              <th className="p-3 text-right font-semibold text-green-700">Suggested Purchase</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={s.productId} className="border-t">
                <td className="p-3 font-medium">{s.productName}</td>
                <td className="p-3 text-right">{s.currentStock}</td>
                <td className="p-3 text-right">{s.avgDailySales}</td>
                <td className="p-3 text-right">{s.daysOfStockLeft ?? "—"}</td>
                <td className="p-3 text-right font-bold text-green-700">{s.suggestedPurchase} units</td>
              </tr>
            ))}
            {suggestions.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">All products adequately stocked</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

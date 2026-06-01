"use client";

import { useEffect, useState } from "react";
import { cashClosingService } from "@/services/erp";
import type { CashClosing } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice, formatDate } from "@/utils/format";

export default function CashClosingPage() {
  const [closings, setClosings] = useState<CashClosing[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [openingCash, setOpeningCash] = useState(0);

  const load = () => cashClosingService.list().then(setClosings);

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    await cashClosingService.generateForDate(date, openingCash);
    load();
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Daily Cash Closing</h1>

      <div className="mb-6 flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input
          type="number"
          placeholder="Opening cash"
          value={openingCash || ""}
          onChange={(e) => setOpeningCash(Number(e.target.value))}
        />
        <Button onClick={generate}>Generate EOD Report</Button>
      </div>

      {closings[0] && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Opening Cash", value: closings[0].opening_cash },
            { label: "Cash Sales", value: closings[0].cash_sales },
            { label: "UPI Sales", value: closings[0].upi_sales },
            { label: "Card Sales", value: closings[0].card_sales },
            { label: "Expenses", value: closings[0].expenses },
            { label: "Closing Cash", value: closings[0].closing_cash },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border p-4">
              <p className="text-sm text-gray-600">{label}</p>
              <p className="text-xl font-bold">{formatPrice(value)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th>Opening</th>
              <th>Cash</th>
              <th>UPI</th>
              <th>Card</th>
              <th>Expenses</th>
              <th>Closing</th>
            </tr>
          </thead>
          <tbody>
            {closings.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">{formatDate(c.closing_date)}</td>
                <td className="p-3">{formatPrice(c.opening_cash)}</td>
                <td className="p-3">{formatPrice(c.cash_sales)}</td>
                <td className="p-3">{formatPrice(c.upi_sales)}</td>
                <td className="p-3">{formatPrice(c.card_sales)}</td>
                <td className="p-3">{formatPrice(c.expenses)}</td>
                <td className="p-3 font-bold">{formatPrice(c.closing_cash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

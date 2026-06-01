"use client";

import { useEffect, useState } from "react";
import { erpReportsService } from "@/services/erp";
import { orderService } from "@/services/order.service";
import { formatPrice } from "@/utils/format";
import { Button } from "@/components/ui/button";

export default function AdminReportsPage() {
  const [sales, setSales] = useState<{
    posSales: number;
    onlineSales: number;
    total: number;
  } | null>(null);
  const [gstSales, setGstSales] = useState<{
    cgst: number;
    sgst: number;
    total: number;
  } | null>(null);
  const [gstPurchase, setGstPurchase] = useState<{
    cgst: number;
    sgst: number;
    total: number;
  } | null>(null);
  const [profitLoss, setProfitLoss] = useState<{
    revenue: number;
    expenses: number;
    profit: number;
    inventoryValue: number;
  } | null>(null);
  const [stock, setStock] = useState<{
    totalProducts: number;
    totalUnits: number;
    inventoryValue: number;
    lowStockCount: number;
  } | null>(null);
  const [topProducts, setTopProducts] = useState<
    { name: string; quantity: number }[]
  >([]);
  const [monthly, setMonthly] = useState<Record<string, number>>({});

  useEffect(() => {
    const from = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString();
    const to = new Date().toISOString();

    erpReportsService.salesSummary("month").then(setSales);
    erpReportsService.gstSalesReport(from, to).then(setGstSales);
    erpReportsService.gstPurchaseReport(from, to).then(setGstPurchase);
    erpReportsService.profitLoss(from, to).then(setProfitLoss);
    erpReportsService.stockSummary().then(setStock);
    erpReportsService.topProducts(10).then(setTopProducts);

    orderService.getSalesReport().then((orders) => {
      const m: Record<string, number> = {};
      orders.forEach((o) => {
        const month = new Date(o.created_at).toLocaleString("en-IN", {
          month: "short",
          year: "numeric",
        });
        m[month] = (m[month] ?? 0) + Number(o.total_amount);
      });
      setMonthly(m);
    });
  }, []);

  const exportSalesCsv = () => {
    if (!sales) return;
    erpReportsService.exportCsv(
      [
        { channel: "POS", amount: sales.posSales },
        { channel: "Online", amount: sales.onlineSales },
        { channel: "Total", amount: sales.total },
      ],
      "sales-summary.csv"
    );
  };

  if (!sales) return <p>Loading reports...</p>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">ERP Reports</h1>
        <Button variant="outline" onClick={exportSalesCsv}>
          Export CSV
        </Button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-600">Total Sales (Month)</p>
          <p className="text-2xl font-bold text-green-700">{formatPrice(sales.total)}</p>
          <p className="mt-1 text-xs text-gray-500">
            POS: {formatPrice(sales.posSales)} · Online: {formatPrice(sales.onlineSales)}
          </p>
        </div>
        {profitLoss && (
          <>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-600">Profit & Loss</p>
              <p className="text-2xl font-bold">{formatPrice(profitLoss.profit)}</p>
              <p className="text-xs text-gray-500">
                Revenue {formatPrice(profitLoss.revenue)} − Expenses{" "}
                {formatPrice(profitLoss.expenses)}
              </p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-600">Inventory Value</p>
              <p className="text-2xl font-bold">{formatPrice(profitLoss.inventoryValue)}</p>
            </div>
          </>
        )}
        {stock && (
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-gray-600">Stock Summary</p>
            <p className="text-2xl font-bold">{stock.totalUnits} units</p>
            <p className="text-xs text-gray-500">
              {stock.totalProducts} products · {stock.lowStockCount} low stock
            </p>
          </div>
        )}
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-4 font-semibold">GST Sales Report</h2>
          {gstSales && (
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>CGST</span>
                <span>{formatPrice(gstSales.cgst)}</span>
              </li>
              <li className="flex justify-between">
                <span>SGST</span>
                <span>{formatPrice(gstSales.sgst)}</span>
              </li>
              <li className="flex justify-between border-t pt-2 font-bold">
                <span>Total with GST</span>
                <span>{formatPrice(gstSales.total)}</span>
              </li>
            </ul>
          )}
        </div>
        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-4 font-semibold">GST Purchase Report</h2>
          {gstPurchase && (
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>CGST</span>
                <span>{formatPrice(gstPurchase.cgst)}</span>
              </li>
              <li className="flex justify-between">
                <span>SGST</span>
                <span>{formatPrice(gstPurchase.sgst)}</span>
              </li>
              <li className="flex justify-between border-t pt-2 font-bold">
                <span>Total</span>
                <span>{formatPrice(gstPurchase.total)}</span>
              </li>
            </ul>
          )}
        </div>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-4 font-semibold">Monthly Online Sales</h2>
          <ul className="space-y-2">
            {Object.entries(monthly).map(([month, amount]) => (
              <li key={month} className="flex justify-between text-sm">
                <span>{month}</span>
                <span className="font-medium text-green-700">{formatPrice(amount)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-4 font-semibold">Top Products (POS)</h2>
          <ul className="space-y-2">
            {topProducts.map((p, i) => (
              <li key={p.name} className="flex justify-between text-sm">
                <span>
                  {i + 1}. {p.name}
                </span>
                <span>{p.quantity} sold</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

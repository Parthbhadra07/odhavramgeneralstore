"use client";

import { useEffect, useState } from "react";
import { erpReportsService } from "@/services/erp";
import { formatPrice } from "@/utils/format";
import { Button } from "@/components/ui/button";
import type { ProfitReport } from "@/types/erp";

export default function AdminReportsPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [sales, setSales] = useState<{
    posSales: number;
    onlineSales: number;
    total: number;
  } | null>(null);
  const [profitLoss, setProfitLoss] = useState<ProfitReport | null>(null);
  const [purchaseReturns, setPurchaseReturns] = useState<{
    count: number;
    totalValue: number;
  } | null>(null);
  const [salesReturns, setSalesReturns] = useState<{
    count: number;
    totalValue: number;
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
  const [gstSales, setGstSales] = useState<{ cgst: number; sgst: number; igst: number; total: number } | null>(null);
  const [gstPurchase, setGstPurchase] = useState<{ cgst: number; sgst: number; igst: number; total: number } | null>(null);

  const load = () => {
    const from = `${dateFrom}T00:00:00.000Z`;
    const to = `${dateTo}T23:59:59.999Z`;

    erpReportsService.salesSummary("month").then(setSales);
    erpReportsService.profitLoss(from, to).then(setProfitLoss);
    erpReportsService.purchaseReturnReport(from, to).then((r) =>
      setPurchaseReturns({ count: r.count, totalValue: r.totalValue })
    );
    erpReportsService.salesReturnReport(from, to).then((r) =>
      setSalesReturns({ count: r.count, totalValue: r.totalValue })
    );
    erpReportsService.stockSummary().then(setStock);
    erpReportsService.topProducts(10).then(setTopProducts);
    erpReportsService.gstSalesReport(from, to).then(setGstSales);
    erpReportsService.gstPurchaseReport(from, to).then(setGstPurchase);
  };

  useEffect(() => {
    load();
  }, [dateFrom, dateTo]);

  const exportProfitCsv = () => {
    if (!profitLoss) return;
    erpReportsService.exportCsv(
      [
        { metric: "Revenue", amount: profitLoss.revenue },
        { metric: "COGS", amount: profitLoss.cogs },
        { metric: "Gross Profit", amount: profitLoss.grossProfit },
        { metric: "Sales Returns", amount: profitLoss.salesReturns },
        { metric: "Purchase Returns", amount: profitLoss.purchaseReturns },
        { metric: "Expenses", amount: profitLoss.expenses },
        { metric: "Discounts", amount: profitLoss.discounts },
        { metric: "Delivery Charges", amount: profitLoss.deliveryCharges },
        { metric: "Net Profit", amount: profitLoss.netProfit },
      ],
      `profit-report-${dateFrom}-${dateTo}.csv`
    );
  };

  if (!sales) return <p>Loading reports...</p>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">ERP Reports</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <Button variant="outline" onClick={load}>
            Refresh
          </Button>
          <Button variant="outline" onClick={exportProfitCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-600">Total Sales</p>
          <p className="text-2xl font-bold text-green-700">{formatPrice(sales.total)}</p>
          <p className="mt-1 text-xs text-gray-500">
            POS: {formatPrice(sales.posSales)} · Online: {formatPrice(sales.onlineSales)}
          </p>
        </div>
        {profitLoss && (
          <>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-600">Gross Profit</p>
              <p className="text-2xl font-bold text-green-800">
                {formatPrice(profitLoss.grossProfit)}
              </p>
              <p className="text-xs text-gray-500">
                Revenue − COGS ({formatPrice(profitLoss.cogs)})
              </p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-600">Net Profit</p>
              <p className="text-2xl font-bold">{formatPrice(profitLoss.netProfit)}</p>
              <p className="text-xs text-gray-500">
                After returns, expenses & discounts
              </p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-600">Inventory Value</p>
              <p className="text-2xl font-bold">{formatPrice(profitLoss.inventoryValue)}</p>
            </div>
          </>
        )}
      </div>

      {profitLoss && (
        <div className="mb-8 rounded-xl border bg-white p-6">
          <h2 className="mb-4 font-semibold">Profit Breakdown</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Revenue", profitLoss.revenue],
              ["Cost of Goods Sold", profitLoss.cogs],
              ["Gross Profit", profitLoss.grossProfit],
              ["Sales Returns", -profitLoss.salesReturns],
              ["Purchase Returns (credit)", profitLoss.purchaseReturns],
              ["Expenses", -profitLoss.expenses],
              ["Discounts Given", -profitLoss.discounts],
              ["Delivery Charges", profitLoss.deliveryCharges],
              ["Net Profit", profitLoss.netProfit],
            ].map(([label, val]) => (
              <div key={label as string} className="flex justify-between rounded-lg bg-gray-50 px-4 py-2 text-sm">
                <span>{label}</span>
                <span className="font-medium">{formatPrice(val as number)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {purchaseReturns && (
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-4 font-semibold">Purchase Return Report</h2>
            <p className="text-2xl font-bold">{formatPrice(purchaseReturns.totalValue)}</p>
            <p className="text-sm text-gray-500">{purchaseReturns.count} returns in period</p>
          </div>
        )}
        {salesReturns && (
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-4 font-semibold">Sales Return Report</h2>
            <p className="text-2xl font-bold">{formatPrice(salesReturns.totalValue)}</p>
            <p className="text-sm text-gray-500">{salesReturns.count} returns in period</p>
          </div>
        )}
      </div>

      {(gstSales || gstPurchase) && (
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          {gstSales && (
            <div className="rounded-xl border bg-white p-6">
              <h2 className="mb-4 font-semibold">GST Sales Report</h2>
              <div className="space-y-1 text-sm">
                <p>CGST: {formatPrice(gstSales.cgst)}</p>
                <p>SGST: {formatPrice(gstSales.sgst)}</p>
                <p>IGST: {formatPrice(gstSales.igst)}</p>
                <p className="font-bold">Total: {formatPrice(gstSales.total)}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  erpReportsService.exportCsv(
                    [{ cgst: gstSales.cgst, sgst: gstSales.sgst, igst: gstSales.igst, total: gstSales.total }],
                    `gst-sales-${dateFrom}.csv`
                  )
                }
              >
                Export CSV
              </Button>
            </div>
          )}
          {gstPurchase && (
            <div className="rounded-xl border bg-white p-6">
              <h2 className="mb-4 font-semibold">GST Purchase Report</h2>
              <div className="space-y-1 text-sm">
                <p>CGST: {formatPrice(gstPurchase.cgst)}</p>
                <p>SGST: {formatPrice(gstPurchase.sgst)}</p>
                <p>IGST: {formatPrice(gstPurchase.igst)}</p>
                <p className="font-bold">Total: {formatPrice(gstPurchase.total)}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  erpReportsService.exportCsv(
                    [{ cgst: gstPurchase.cgst, sgst: gstPurchase.sgst, igst: gstPurchase.igst, total: gstPurchase.total }],
                    `gst-purchase-${dateFrom}.csv`
                  )
                }
              >
                Export CSV
              </Button>
            </div>
          )}
        </div>
      )}

      {stock && (
        <div className="mb-8 rounded-xl border bg-white p-6">
          <h2 className="mb-4 font-semibold">Stock Summary</h2>
          <p>
            {stock.totalProducts} products · {stock.totalUnits} units ·{" "}
            {stock.lowStockCount} low stock
          </p>
        </div>
      )}

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
  );
}

"use client";

import { useEffect, useState } from "react";
import { Printer, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { inventoryService, generateEan13 } from "@/services/erp";
import { useStoreSettings } from "@/hooks/use-store-settings";
import type { ErpProduct } from "@/types/erp";
import { BarcodeLabel, printBarcodeLabels } from "@/components/erp/barcode-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function BarcodeLabelsPage() {
  const { settings } = useStoreSettings();
  const [products, setProducts] = useState<ErpProduct[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copies, setCopies] = useState(1);
  const [customBarcodes, setCustomBarcodes] = useState<Record<string, string>>({});

  useEffect(() => {
    inventoryService.listProducts({ search: search || undefined }).then(setProducts);
  }, [search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generateForProduct = async (p: ErpProduct) => {
    const code = generateEan13();
    setCustomBarcodes((prev) => ({ ...prev, [p.id]: code }));
    try {
      await inventoryService.upsertProduct({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        barcode: code,
      });
      toast.success(`Barcode generated: ${code}`);
    } catch {
      toast.message("Barcode generated locally — save product to persist");
    }
  };

  const selectedProducts = products.filter((p) => selected.has(p.id));
  const shopName = settings?.store_name ?? "Odhavram General Store";

  return (
    <div className="pb-24">
      <h1 className="admin-page-title mb-1">Barcode Label Printing</h1>
      <p className="mb-6 text-sm text-gray-600">
        Generate barcodes and print labels with shop name, product name & MRP
      </p>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Input
          type="number"
          min={1}
          max={20}
          value={copies}
          onChange={(e) => setCopies(Number(e.target.value))}
          className="w-24"
          title="Copies per label"
        />
        <Button
          variant="primary"
          disabled={!selectedProducts.length}
          onClick={() => printBarcodeLabels(`${shopName} — Barcodes`)}
        >
          <Printer className="mr-1 h-4 w-4" />
          Print {selectedProducts.length} Label(s)
        </Button>
      </div>

      <div className="mb-6 overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 w-10"></th>
              <th className="p-3 text-left">Product</th>
              <th className="p-3 text-left">Barcode</th>
              <th className="p-3 text-right">MRP</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                </td>
                <td className="p-3">{p.name}</td>
                <td className="p-3 font-mono text-xs">{customBarcodes[p.id] ?? p.barcode ?? "—"}</td>
                <td className="p-3 text-right">₹{Number(p.mrp ?? p.price).toFixed(2)}</td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => generateForProduct(p)}>
                    <Wand2 className="mr-1 h-3 w-3" />
                    Generate
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div id="barcode-labels-print" className="flex flex-wrap gap-3">
        {selectedProducts.flatMap((p) =>
          Array.from({ length: copies }, (_, i) => (
            <BarcodeLabel
              key={`${p.id}-${i}`}
              value={customBarcodes[p.id] ?? p.barcode ?? p.id.slice(0, 12)}
              productName={p.name}
              shopName={shopName}
              mrp={Number(p.mrp ?? p.price)}
            />
          ))
        )}
      </div>
    </div>
  );
}

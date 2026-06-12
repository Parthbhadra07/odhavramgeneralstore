"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Barcode,
  Download,
  Printer,
  ScanLine,
  Wand2,
  AlertTriangle,
  FileImage,
} from "lucide-react";
import { toast } from "sonner";
import {
  inventoryService,
  generateEan13,
  generateBarcode,
} from "@/services/erp";
import {
  barcodeLabelService,
  DEFAULT_LABEL_CONFIG,
  LABEL_SIZE_PRESETS,
  PRINTER_PROFILES,
} from "@/services/erp/barcode-label.service";
import { categoryService } from "@/services/category.service";
import { useStoreSettings } from "@/hooks/use-store-settings";
import type { BarcodeFormat, BarcodeLabelConfig, ErpProduct } from "@/types/erp";
import { BarcodeLabel } from "@/components/erp/barcode-label";
import {
  downloadBarcodePdf,
  printBarcodeLabelsFromElement,
} from "@/components/erp/barcode-label-utils";
import { BarcodeScanner } from "@/components/erp/barcode-scanner";
import { StatCard } from "@/components/admin/stat-card";
import { FormField, SelectField } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { slugify } from "@/utils/format";

const BARCODE_FORMATS: { value: BarcodeFormat; label: string }[] = [
  { value: "CODE128", label: "CODE128" },
  { value: "EAN13", label: "EAN13" },
  { value: "EAN8", label: "EAN8" },
  { value: "UPC", label: "UPC" },
  { value: "QR", label: "QR Code" },
];

const emptyForm = {
  productName: "",
  sku: "",
  barcode: "",
  categoryId: "",
  brand: "",
  unit: "",
  hsnCode: "",
  purchasePrice: "",
  sellingPrice: "",
  mrp: "",
  discountPercent: "",
  mfgDate: "",
  expiryDate: "",
};

export default function BarcodeLabelsPage() {
  const { settings } = useStoreSettings();
  const [stats, setStats] = useState({
    totalWithBarcode: 0,
    generatedToday: 0,
    printedToday: 0,
    withoutBarcode: 0,
  });
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<ErpProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [config, setConfig] = useState<BarcodeLabelConfig>(DEFAULT_LABEL_CONFIG);
  const [sizePreset, setSizePreset] = useState("50x25");
  const [printQty, setPrintQty] = useState(1);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const shopName = settings?.store_name ?? "Odhavram General Store";

  const loadStats = useCallback(() => {
    barcodeLabelService.getDashboardStats().then(setStats);
  }, []);

  const loadProducts = useCallback(() => {
    inventoryService
      .listProducts({ search: productSearch || undefined })
      .then(setProducts);
  }, [productSearch]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadStats(),
      loadProducts(),
      categoryService.getAll().then((c) => setCategories(c.map((x) => ({ id: x.id, name: x.name })))),
    ]).finally(() => setLoading(false));
  }, [loadStats, loadProducts]);

  const selectProduct = (p: ErpProduct) => {
    setSelectedProductId(p.id);
    setForm({
      productName: p.name,
      sku: p.sku ?? "",
      barcode: p.barcode ?? "",
      categoryId: p.category_id ?? "",
      brand: p.brand ?? "",
      unit: p.unit ?? "",
      hsnCode: p.hsn_code ?? "",
      purchasePrice: String(p.purchase_price ?? ""),
      sellingPrice: String(p.selling_price ?? p.price ?? ""),
      mrp: String(p.mrp ?? p.price ?? ""),
      discountPercent: String(p.discount_percent ?? ""),
      mfgDate: "",
      expiryDate: p.expiry_date ? p.expiry_date.slice(0, 10) : "",
    });
  };

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "barcode") {
      barcodeLabelService
        .checkDuplicate(value, selectedProductId ?? undefined)
        .then(setDuplicateWarning);
    }
  };

  const autoGenerateBarcode = () => {
    let code = "";
    if (config.format === "EAN13") code = generateEan13();
    else if (config.format === "EAN8") code = generateBarcode().slice(0, 7);
    else if (config.format === "UPC") code = generateBarcode().slice(0, 11);
    else code = generateBarcode();
    updateForm("barcode", code);
    toast.success(`Generated: ${code}`);
  };

  const applySizePreset = (presetId: string) => {
    setSizePreset(presetId);
    const preset = LABEL_SIZE_PRESETS.find((p) => p.id === presetId);
    if (preset && presetId !== "custom") {
      setConfig((c) => ({
        ...c,
        labelWidthMm: preset.width,
        labelHeightMm: preset.height,
      }));
    }
  };

  const saveProduct = async () => {
    if (!form.productName.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!form.barcode.trim()) {
      toast.error("Barcode number is required");
      return;
    }
    if (duplicateWarning) {
      toast.error("Duplicate barcode detected");
      return;
    }

    setSaving(true);
    try {
      const price = Number(form.sellingPrice) || Number(form.mrp) || 0;
      const saved = await inventoryService.upsertProduct({
        id: selectedProductId ?? undefined,
        name: form.productName.trim(),
        slug: slugify(form.productName),
        price,
        sku: form.sku || null,
        barcode: form.barcode.trim(),
        brand: form.brand || null,
        unit: form.unit || null,
        category_id: form.categoryId || null,
        purchase_price: form.purchasePrice ? Number(form.purchasePrice) : null,
        selling_price: form.sellingPrice ? Number(form.sellingPrice) : null,
        mrp: form.mrp ? Number(form.mrp) : null,
        hsn_code: form.hsnCode || null,
        discount_percent: form.discountPercent ? Number(form.discountPercent) : null,
        expiry_date: form.expiryDate || null,
      });
      setSelectedProductId(saved.id);
      toast.success("Product saved with barcode");
      loadStats();
      loadProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async (qty: number) => {
    if (!form.barcode) {
      toast.error("Enter or generate a barcode first");
      return;
    }
    printBarcodeLabelsFromElement(
      "barcode-labels-print",
      `${shopName} — Barcodes`,
      config.printerType
    );
    if (selectedProductId) {
      try {
        await barcodeLabelService.recordPrint({
          productId: selectedProductId,
          barcode: form.barcode,
          format: config.format,
          printerType: config.printerType,
          labelWidthMm: config.labelWidthMm,
          labelHeightMm: config.labelHeightMm,
          quantity: qty,
        });
        loadStats();
      } catch {
        toast.message("Printed — audit log unavailable");
      }
    }
    toast.success(`Printing ${qty} label(s)`);
  };

  const labelData = {
    value: form.barcode || "000000000000",
    productName: form.productName || "Product Name",
    shopName,
    sku: form.sku,
    sellingPrice: form.sellingPrice ? Number(form.sellingPrice) : undefined,
    mrp: form.mrp ? Number(form.mrp) : undefined,
    mfgDate: form.mfgDate || undefined,
    expiryDate: form.expiryDate || undefined,
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="mb-6">
        <h1 className="admin-page-title">Barcode Generation</h1>
        <p className="mt-1 text-sm text-gray-600">
          TVS & thermal printer optimized labels for grocery inventory
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Products With Barcode" value={stats.totalWithBarcode} icon={Barcode} />
        <StatCard label="Generated Today" value={stats.generatedToday} icon={Wand2} color="bg-blue-600" />
        <StatCard label="Labels Printed Today" value={stats.printedToday} icon={Printer} color="bg-amber-600" />
        <StatCard label="Without Barcode" value={stats.withoutBarcode} icon={AlertTriangle} color="bg-red-600" />
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        {/* Left — Product Form */}
        <div className="xl:col-span-4 space-y-4">
          <div className="admin-card p-4 sm:p-5">
            <h2 className="admin-section-title mb-4">Product Details</h2>

            <div className="mb-4">
              <Input
                placeholder="Search existing products…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              {products.length > 0 && productSearch && (
                <ul className="mt-2 max-h-32 overflow-y-auto rounded-lg border text-sm">
                  {products.slice(0, 8).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-green-50"
                        onClick={() => selectProduct(p)}
                      >
                        {p.name}
                        {p.barcode && (
                          <span className="ml-2 font-mono text-xs text-gray-500">{p.barcode}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3">
              <FormField label="Product Name" required>
                <Input value={form.productName} onChange={(e) => updateForm("productName", e.target.value)} />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="SKU / Item Code">
                  <Input value={form.sku} onChange={(e) => updateForm("sku", e.target.value)} />
                </FormField>
                <FormField label="Unit">
                  <Input value={form.unit} onChange={(e) => updateForm("unit", e.target.value)} placeholder="kg, pcs" />
                </FormField>
              </div>
              <FormField label="Barcode Number" required>
                <div className="flex gap-2">
                  <Input
                    value={form.barcode}
                    onChange={(e) => updateForm("barcode", e.target.value)}
                    className="font-mono"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={autoGenerateBarcode} title="Auto generate">
                    <Wand2 className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowScanner(true)} title="Scan verify">
                    <ScanLine className="h-4 w-4" />
                  </Button>
                </div>
                {duplicateWarning && (
                  <p className="mt-1 text-xs text-red-600">Duplicate barcode detected in inventory</p>
                )}
              </FormField>
              <SelectField
                label="Category"
                value={form.categoryId}
                onChange={(v) => updateForm("categoryId", v)}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Brand">
                  <Input value={form.brand} onChange={(e) => updateForm("brand", e.target.value)} />
                </FormField>
                <FormField label="HSN Code">
                  <Input value={form.hsnCode} onChange={(e) => updateForm("hsnCode", e.target.value)} />
                </FormField>
              </div>

              <p className="text-xs font-semibold uppercase text-gray-500">Pricing</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Purchase Price">
                  <Input type="number" value={form.purchasePrice} onChange={(e) => updateForm("purchasePrice", e.target.value)} />
                </FormField>
                <FormField label="Selling Price">
                  <Input type="number" value={form.sellingPrice} onChange={(e) => updateForm("sellingPrice", e.target.value)} />
                </FormField>
                <FormField label="MRP">
                  <Input type="number" value={form.mrp} onChange={(e) => updateForm("mrp", e.target.value)} />
                </FormField>
                <FormField label="Discount %">
                  <Input type="number" value={form.discountPercent} onChange={(e) => updateForm("discountPercent", e.target.value)} />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Manufacturing Date">
                  <Input type="date" value={form.mfgDate} onChange={(e) => updateForm("mfgDate", e.target.value)} />
                </FormField>
                <FormField label="Expiry Date">
                  <Input type="date" value={form.expiryDate} onChange={(e) => updateForm("expiryDate", e.target.value)} />
                </FormField>
              </div>

              <Button variant="primary" className="w-full" onClick={saveProduct} disabled={saving}>
                {saving ? "Saving…" : "Save Product & Barcode"}
              </Button>
            </div>
          </div>
        </div>

        {/* Center — Live Preview */}
        <div className="xl:col-span-4">
          <div className="admin-card flex min-h-[400px] flex-col p-4 sm:p-5">
            <h2 className="admin-section-title mb-4">Live Preview</h2>
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-6">
              <BarcodeLabel {...labelData} config={config} />
              <p className="mt-4 text-xs text-gray-500">
                {config.labelWidthMm}×{config.labelHeightMm} mm · {config.format}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <FormField label="Print Quantity" className="w-24">
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={printQty}
                  onChange={(e) => setPrintQty(Number(e.target.value))}
                />
              </FormField>
              <Button variant="primary" onClick={() => handlePrint(1)}>
                <Printer className="mr-1 h-4 w-4" />
                Single Print
              </Button>
              <Button variant="primary" onClick={() => handlePrint(printQty)}>
                <Printer className="mr-1 h-4 w-4" />
                Bulk Print ({printQty})
              </Button>
              <Button variant="outline" onClick={() => handlePrint(1)}>
                Test Label
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadBarcodePdf("barcode-labels-print", "barcodes", config.printerType)}
              >
                <Download className="mr-1 h-4 w-4" />
                PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const svg = document.querySelector("#barcode-labels-print svg");
                  if (svg) {
                    import("@/components/erp/barcode-label-utils").then(({ downloadBarcodePng }) =>
                      downloadBarcodePng(svg as SVGSVGElement, `barcode-${form.barcode || "label"}.png`)
                    );
                  }
                }}
              >
                <FileImage className="mr-1 h-4 w-4" />
                PNG
              </Button>
            </div>
          </div>
        </div>

        {/* Right — Settings */}
        <div className="xl:col-span-4 space-y-4">
          <div className="admin-card p-4 sm:p-5">
            <h2 className="admin-section-title mb-4">Label Settings</h2>
            <div className="space-y-3">
              <SelectField
                label="Barcode Type"
                value={config.format}
                onChange={(v) => setConfig((c) => ({ ...c, format: v as BarcodeFormat }))}
                options={BARCODE_FORMATS.map((f) => ({ value: f.value, label: f.label }))}
                placeholder=""
              />
              <SelectField
                label="Label Size Preset"
                value={sizePreset}
                onChange={applySizePreset}
                options={LABEL_SIZE_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
                placeholder=""
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Label Width (mm)">
                  <Input
                    type="number"
                    value={config.labelWidthMm}
                    onChange={(e) => {
                      setSizePreset("custom");
                      setConfig((c) => ({ ...c, labelWidthMm: Number(e.target.value) }));
                    }}
                  />
                </FormField>
                <FormField label="Label Height (mm)">
                  <Input
                    type="number"
                    value={config.labelHeightMm}
                    onChange={(e) => {
                      setSizePreset("custom");
                      setConfig((c) => ({ ...c, labelHeightMm: Number(e.target.value) }));
                    }}
                  />
                </FormField>
                <FormField label="Barcode Height (px)">
                  <Input
                    type="number"
                    value={config.barcodeHeight}
                    onChange={(e) => setConfig((c) => ({ ...c, barcodeHeight: Number(e.target.value) }))}
                  />
                </FormField>
                <FormField label="Font Size (px)">
                  <Input
                    type="number"
                    value={config.fontSize}
                    onChange={(e) => setConfig((c) => ({ ...c, fontSize: Number(e.target.value) }))}
                  />
                </FormField>
              </div>

              <p className="text-xs font-semibold uppercase text-gray-500">Display Options</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {(
                  [
                    ["showProductName", "Product Name"],
                    ["showMrp", "MRP"],
                    ["showSellingPrice", "Selling Price"],
                    ["showSku", "SKU"],
                    ["showBarcodeNumber", "Barcode Number"],
                    ["showStoreName", "Store Name"],
                    ["showMfgDate", "Mfg Date"],
                    ["showExpiryDate", "Expiry Date"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config[key]}
                      onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.checked }))}
                      className="rounded border-gray-300 text-green-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="admin-card p-4 sm:p-5">
            <h2 className="admin-section-title mb-4">Printer Settings</h2>
            <SelectField
              label="Printer"
              value={config.printerType}
              onChange={(v) =>
                setConfig((c) => ({
                  ...c,
                  printerType: v as BarcodeLabelConfig["printerType"],
                }))
              }
              options={Object.entries(PRINTER_PROFILES).map(([k, v]) => ({
                value: k,
                label: v.label,
              }))}
              placeholder=""
            />
            <p className="mt-2 text-xs text-gray-500">
              Optimized for {PRINTER_PROFILES[config.printerType].label} at{" "}
              {PRINTER_PROFILES[config.printerType].dpi} DPI
            </p>
          </div>
        </div>
      </div>

      {/* Hidden print area */}
      <div id="barcode-labels-print" className="pointer-events-none fixed -left-[9999px] top-0">
        {Array.from({ length: printQty }, (_, i) => (
          <BarcodeLabel key={i} {...labelData} config={config} />
        ))}
      </div>

      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4">
            <h3 className="mb-3 font-semibold">Scan Barcode to Verify</h3>
            <BarcodeScanner
              onScan={(code) => {
                updateForm("barcode", code);
                setShowScanner(false);
                toast.success(`Scanned: ${code}`);
              }}
            />
            <Button className="mt-3 w-full" variant="outline" onClick={() => setShowScanner(false)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Copy,
  Save,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Scale,
  RefreshCw,
  X,
  ClipboardPaste,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { productService } from "@/services/product.service";
import { categoryService } from "@/services/category.service";
import { slugify } from "@/utils/format";
import { downloadCSVFile } from "@/utils/csv-helper";
import type { Category } from "@/types/database";

export interface SpreadsheetRow {
  id: string;
  name: string;
  barcode: string;
  category: string;
  brand: string;
  unit: string;
  is_loose: boolean;
  purchase_price: string;
  selling_price: string;
  mrp: string;
  stock: string;
  min_stock_level: string;
  error?: string;
}

const COMMON_UNITS = ["pcs", "kg", "g", "ltr", "ml", "pkt", "box", "dozen", "meter"];

const DEFAULT_BLANK_ROWS = 6;

function createBlankRow(): SpreadsheetRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    barcode: "",
    category: "",
    brand: "",
    unit: "pcs",
    is_loose: false,
    purchase_price: "",
    selling_price: "",
    mrp: "",
    stock: "10",
    min_stock_level: "5",
  };
}

interface MultiProductSpreadsheetProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  categoriesList?: Category[];
}

export function MultiProductSpreadsheet({
  onSuccess,
  onCancel,
  categoriesList = [],
}: MultiProductSpreadsheetProps) {
  const [categories, setCategories] = useState<Category[]>(categoriesList);
  const [rows, setRows] = useState<SpreadsheetRow[]>(() =>
    Array.from({ length: DEFAULT_BLANK_ROWS }, () => createBlankRow())
  );
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (categoriesList.length === 0) {
      categoryService.getAll().then(setCategories).catch(() => []);
    }
  }, [categoriesList]);

  // Update cell
  const updateCell = useCallback(
    <K extends keyof SpreadsheetRow>(id: string, field: K, value: SpreadsheetRow[K]) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const updated = { ...r, [field]: value, error: undefined };

          // If turning on loose item and unit is pcs, suggest kg
          if (field === "is_loose" && value === true && (r.unit === "pcs" || !r.unit)) {
            updated.unit = "kg";
          }

          return updated;
        })
      );
    },
    []
  );

  // Add 1 row
  const handleAddRow = () => {
    const newR = createBlankRow();
    setRows((prev) => [...prev, newR]);
    setTimeout(() => {
      const container = tableContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    }, 50);
  };

  // Add 5 rows
  const handleAdd5Rows = () => {
    setRows((prev) => [
      ...prev,
      ...Array.from({ length: 5 }, () => createBlankRow()),
    ]);
  };

  // Remove row
  const handleRemoveRow = (id: string) => {
    setRows((prev) => {
      if (prev.length <= 1) {
        return [createBlankRow()];
      }
      return prev.filter((r) => r.id !== id);
    });
  };

  // Duplicate row
  const handleDuplicateRow = (row: SpreadsheetRow) => {
    const duplicated: SpreadsheetRow = {
      ...row,
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: row.name ? `${row.name} (Copy)` : "",
      barcode: "", // clear barcode to avoid collision
    };
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === row.id);
      const next = [...prev];
      next.splice(idx + 1, 0, duplicated);
      return next;
    });
  };

  // Clear empty rows
  const handleClearEmpty = () => {
    setRows((prev) => {
      const filtered = prev.filter(
        (r) => r.name.trim() !== "" || r.barcode.trim() !== "" || r.selling_price.trim() !== ""
      );
      return filtered.length > 0 ? filtered : [createBlankRow()];
    });
    toast.info("Cleared blank rows");
  };

  // Paste handler from Excel
  const handleApplyPaste = () => {
    if (!pasteText.trim()) {
      setShowPasteModal(false);
      return;
    }

    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const newRows: SpreadsheetRow[] = [];

    for (const line of lines) {
      // Split by tab (Excel standard) or comma
      const delimiter = line.includes("\t") ? "\t" : ",";
      const parts = line.split(delimiter).map((c) => c.replace(/^["']|["']$/g, "").trim());

      // If user pasted header line by mistake, skip it
      const firstCol = parts[0]?.toLowerCase();
      if (firstCol === "name" || firstCol === "product name" || firstCol === "barcode") {
        continue;
      }

      if (parts.length === 0 || !parts.some((p) => p !== "")) continue;

      let name = "";
      let barcode = "";
      let category = "";
      let brand = "";
      let unit = "pcs";
      let is_loose = false;
      let purchase_price = "";
      let selling_price = "";
      let mrp = "";
      let stock = "10";

      // Flexible column mapper depending on columns pasted:
      // Pattern A: [Barcode, Name, Category, Brand, Unit, Selling Price, Purchase Price, MRP, Stock, Loose]
      // Pattern B: [Name, Barcode, Selling Price, Stock...]
      if (parts.length >= 2 && /^\d{7,14}$/.test(parts[0])) {
        // First col is barcode
        barcode = parts[0] || "";
        name = parts[1] || "";
        category = parts[2] || "";
        brand = parts[3] || "";
        unit = parts[4] || "pcs";
        selling_price = parts[5] || "";
        purchase_price = parts[6] || "";
        mrp = parts[7] || "";
        stock = parts[8] || "10";
        if (parts[9]) {
          const l = parts[9].toLowerCase();
          is_loose = l === "yes" || l === "true" || l === "1" || l === "loose";
        }
      } else {
        // First col is Name
        name = parts[0] || "";
        barcode = parts[1] || "";
        category = parts[2] || "";
        brand = parts[3] || "";
        unit = parts[4] || "pcs";
        selling_price = parts[5] || "";
        purchase_price = parts[6] || "";
        mrp = parts[7] || "";
        stock = parts[8] || "10";
        if (parts[9]) {
          const l = parts[9].toLowerCase();
          is_loose = l === "yes" || l === "true" || l === "1" || l === "loose";
        }
      }

      if (unit.toLowerCase() === "loose") {
        unit = "kg";
        is_loose = true;
      }

      newRows.push({
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        barcode,
        category,
        brand,
        unit: unit || "pcs",
        is_loose,
        purchase_price,
        selling_price,
        mrp,
        stock: stock || "10",
        min_stock_level: "5",
      });
    }

    if (newRows.length > 0) {
      setRows((prev) => {
        // filter out completely blank existing rows
        const existingNonEmpty = prev.filter((r) => r.name.trim() !== "");
        return [...existingNonEmpty, ...newRows];
      });
      toast.success(`Imported ${newRows.length} rows from clipboard text!`);
    } else {
      toast.error("No valid product data found in pasted text");
    }

    setPasteText("");
    setShowPasteModal(false);
  };

  // Download blank CSV template
  const handleDownloadTemplate = () => {
    const csvContent =
      "Product Name,Barcode,Category,Brand,Unit,Selling Price,Purchase Price,MRP,Stock,Loose (Yes/No)\r\n" +
      "Basmati Rice 1kg,8901234567890,Grocery,India Gate,kg,110,95,120,50,No\r\n" +
      "Loose Sugar (Weight Scale),,Grocery,Local,kg,44,38,48,100,Yes\r\n" +
      "Toor Dal Loose,,Pulses,Farm Fresh,kg,140,120,150,80,Yes\r\n" +
      "Parle-G 80g,8901030383709,Biscuits,Parle,pcs,10,8.5,10,120,No\r\n";
    downloadCSVFile("odhavram_multi_product_template.csv", csvContent);
    toast.success("Excel/CSV template downloaded!");
  };

  // Valid rows count
  const validRows = rows.filter((r) => r.name.trim() !== "" && r.selling_price.trim() !== "");
  const partiallyFilledRows = rows.filter(
    (r) =>
      (r.name.trim() !== "" || r.selling_price.trim() !== "") &&
      !(r.name.trim() !== "" && r.selling_price.trim() !== "")
  );

  // Submit all valid rows
  const handleSaveAll = async () => {
    if (validRows.length === 0) {
      toast.error("Please enter at least one product with Name and Selling Price");
      return;
    }

    setSaving(true);
    setSaveProgress({ current: 0, total: validRows.length });

    // Category cache map
    const categoryMap = new Map<string, string>();
    categories.forEach((c) => categoryMap.set(c.name.toLowerCase().trim(), c.id));

    let createdCount = 0;
    const failedRowIds = new Set<string>();
    const errorMap = new Map<string, string>();

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      setSaveProgress({ current: i + 1, total: validRows.length });

      try {
        // Resolve or create category if specified
        let categoryId: string | null = null;
        const catName = row.category.trim();
        if (catName) {
          const lower = catName.toLowerCase();
          if (categoryMap.has(lower)) {
            categoryId = categoryMap.get(lower)!;
          } else {
            try {
              const newCat = await categoryService.create({
                name: catName,
                slug: slugify(catName),
                image: null,
              });
              categoryMap.set(lower, newCat.id);
              categoryId = newCat.id;
              setCategories((prev) => [...prev, newCat]);
            } catch {
              // ignore category creation failure, proceed with null
            }
          }
        }

        const sellingPrice = parseFloat(row.selling_price) || 0;
        const purchasePrice = row.purchase_price ? parseFloat(row.purchase_price) : null;
        const mrp = row.mrp ? parseFloat(row.mrp) : null;
        const stock = parseFloat(row.stock) || 0;
        const minStock = parseFloat(row.min_stock_level) || 5;

        const barcode =
          row.barcode.trim() || `OGS${Date.now().toString().slice(-7)}${i}`;

        await productService.create({
          name: row.name.trim(),
          slug: slugify(row.name),
          description: null,
          price: sellingPrice,
          selling_price: sellingPrice,
          purchase_price: purchasePrice,
          mrp: mrp,
          stock: stock,
          unit: row.unit.trim() || (row.is_loose ? "kg" : "pcs"),
          is_loose: row.is_loose,
          barcode: barcode,
          brand: row.brand.trim() || null,
          category_id: categoryId,
          min_stock_level: minStock,
          reorder_level: minStock * 2,
          featured: false,
          image_url: null,
        });

        createdCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to create product";
        failedRowIds.add(row.id);
        errorMap.set(row.id, msg);
      }
    }

    setSaving(false);
    setSaveProgress(null);

    if (createdCount > 0) {
      toast.success(`🎉 Successfully added ${createdCount} product${createdCount > 1 ? "s" : ""} to catalog!`);
      // Filter out successfully created rows
      setRows((prev) => {
        const remaining = prev
          .filter((r) => failedRowIds.has(r.id) || (!r.name.trim() && !r.selling_price.trim()))
          .map((r) => ({
            ...r,
            error: errorMap.get(r.id),
          }));
        return remaining.length > 0 ? remaining : [createBlankRow()];
      });

      if (failedRowIds.size === 0) {
        if (onSuccess) onSuccess();
      }
    }

    if (failedRowIds.size > 0) {
      toast.error(`${failedRowIds.size} products could not be saved. Check row error messages.`);
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
      {/* Excel Spreadsheet Header Bar */}
      <div className="border-b border-emerald-900 bg-emerald-800 text-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700/80 text-white shadow-inner">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Multi-Product Quick Grid (Excel Sheet Format)
                </h2>
                <span className="rounded-full bg-emerald-900/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200 border border-emerald-700">
                  Spreadsheet Entry
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Type directly into cells, paste rows from Excel, or enable loose weight items. Press Tab to jump cells.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="border-emerald-600 bg-emerald-900/60 text-white hover:bg-emerald-900 text-xs gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Template
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPasteModal(true)}
              className="border-emerald-600 bg-emerald-900/60 text-white hover:bg-emerald-900 text-xs gap-1.5"
            >
              <ClipboardPaste className="h-3.5 w-3.5" /> Paste from Excel
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="border-emerald-600 bg-emerald-900/60 text-white hover:bg-emerald-900 text-xs"
              >
                Close
              </Button>
            )}
          </div>
        </div>

        {/* Toolbar controls */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-emerald-700/60 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAddRow}
              className="bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-semibold shadow-sm h-8 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add Row
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd5Rows}
              className="bg-emerald-700 text-white hover:bg-emerald-600 text-xs font-medium h-8 border border-emerald-600"
            >
              + 5 Rows
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleClearEmpty}
              variant="ghost"
              className="text-emerald-100 hover:bg-emerald-700/50 hover:text-white text-xs h-8"
            >
              Clear Blank Rows
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-200">Total: <b>{rows.length}</b></span>
              <span className="text-emerald-200">·</span>
              <span className="text-emerald-100 bg-emerald-900/70 px-2 py-0.5 rounded border border-emerald-700">
                Ready to Save: <b>{validRows.length}</b>
              </span>
              {partiallyFilledRows.length > 0 && (
                <span className="text-amber-200 bg-amber-900/50 px-2 py-0.5 rounded border border-amber-700">
                  Needs Price/Name: <b>{partiallyFilledRows.length}</b>
                </span>
              )}
            </div>

            <Button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || validRows.length === 0}
              className="bg-amber-400 hover:bg-amber-300 text-gray-900 font-bold px-4 h-8 text-xs shadow-md gap-1.5"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Saving {saveProgress?.current}/{saveProgress?.total}...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save {validRows.length > 0 ? `${validRows.length} Products` : "Products"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Spreadsheet Data Grid */}
      <div
        ref={tableContainerRef}
        className="max-h-[60vh] overflow-x-auto overflow-y-auto border-b border-gray-200 bg-slate-50"
      >
        <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider shadow-sm select-none">
            <tr>
              <th className="w-10 border-b border-r border-slate-300 px-2 py-2.5 text-center">#</th>
              <th className="w-64 border-b border-r border-slate-300 px-3 py-2.5">
                Product Name <span className="text-red-500">*</span>
              </th>
              <th className="w-36 border-b border-r border-slate-300 px-2 py-2.5">Barcode / SKU</th>
              <th className="w-36 border-b border-r border-slate-300 px-2 py-2.5">Category</th>
              <th className="w-28 border-b border-r border-slate-300 px-2 py-2.5">Brand</th>
              <th className="w-24 border-b border-r border-slate-300 px-2 py-2.5 text-center">Unit</th>
              <th className="w-32 border-b border-r border-slate-300 px-2 py-2.5 text-center bg-indigo-50/80 text-indigo-900">
                <span className="flex items-center justify-center gap-1">
                  <Scale className="h-3.5 w-3.5 text-indigo-600" /> Loose Weight?
                </span>
              </th>
              <th className="w-24 border-b border-r border-slate-300 px-2 py-2.5 text-right">Cost (₹)</th>
              <th className="w-28 border-b border-r border-slate-300 px-2 py-2.5 text-right bg-emerald-50 text-emerald-900">
                Sell Price (₹) <span className="text-red-500">*</span>
              </th>
              <th className="w-24 border-b border-r border-slate-300 px-2 py-2.5 text-right">MRP (₹)</th>
              <th className="w-20 border-b border-r border-slate-300 px-2 py-2.5 text-center">Opening Stock</th>
              <th className="w-20 border-b border-r border-slate-300 px-2 py-2.5 text-center">Profit %</th>
              <th className="w-16 border-b border-slate-300 px-2 py-2.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map((row, index) => {
              const sellPriceNum = parseFloat(row.selling_price) || 0;
              const costPriceNum = parseFloat(row.purchase_price) || 0;
              let profitMargin = "";
              let isProfit = true;
              if (sellPriceNum > 0 && costPriceNum > 0) {
                const margin = ((sellPriceNum - costPriceNum) / sellPriceNum) * 100;
                profitMargin = `${margin.toFixed(1)}%`;
                isProfit = margin >= 0;
              }

              const isNameMissing = row.selling_price.trim() !== "" && row.name.trim() === "";
              const isPriceMissing = row.name.trim() !== "" && row.selling_price.trim() === "";

              return (
                <tr
                  key={row.id}
                  className={`group transition-colors hover:bg-blue-50/40 ${
                    row.error ? "bg-red-50/60" : row.is_loose ? "bg-indigo-50/20" : ""
                  }`}
                >
                  {/* Row Index */}
                  <td className="border-r border-slate-200 px-2 py-1.5 text-center font-mono text-[11px] text-slate-400 bg-slate-50/80 select-none">
                    {index + 1}
                  </td>

                  {/* Name */}
                  <td className={`border-r border-slate-200 p-1 ${isNameMissing ? "bg-red-50" : ""}`}>
                    <input
                      type="text"
                      placeholder="e.g. Basmati Rice, Tata Salt..."
                      value={row.name}
                      onChange={(e) => updateCell(row.id, "name", e.target.value)}
                      className={`w-full rounded px-2 py-1 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
                        isNameMissing ? "border border-red-300 bg-red-50" : "bg-transparent"
                      }`}
                    />
                    {row.error && (
                      <p className="mt-0.5 text-[10px] text-red-600 px-2">{row.error}</p>
                    )}
                  </td>

                  {/* Barcode */}
                  <td className="border-r border-slate-200 p-1">
                    <input
                      type="text"
                      placeholder="Leave empty to auto-gen"
                      value={row.barcode}
                      onChange={(e) => updateCell(row.id, "barcode", e.target.value)}
                      className="w-full rounded bg-transparent px-2 py-1 text-xs font-mono text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </td>

                  {/* Category */}
                  <td className="border-r border-slate-200 p-1">
                    <input
                      type="text"
                      list="categories-datalist"
                      placeholder="Select / type..."
                      value={row.category}
                      onChange={(e) => updateCell(row.id, "category", e.target.value)}
                      className="w-full rounded bg-transparent px-2 py-1 text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </td>

                  {/* Brand */}
                  <td className="border-r border-slate-200 p-1">
                    <input
                      type="text"
                      placeholder="e.g. Tata, Nestle"
                      value={row.brand}
                      onChange={(e) => updateCell(row.id, "brand", e.target.value)}
                      className="w-full rounded bg-transparent px-2 py-1 text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </td>

                  {/* Unit */}
                  <td className="border-r border-slate-200 p-1 text-center">
                    <input
                      type="text"
                      list="units-datalist"
                      value={row.unit}
                      onChange={(e) => updateCell(row.id, "unit", e.target.value)}
                      className="w-16 rounded bg-transparent px-1.5 py-1 text-center text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </td>

                  {/* Loose Weight Toggle */}
                  <td className="border-r border-slate-200 p-1 text-center bg-indigo-50/30">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={row.is_loose}
                        onChange={(e) => updateCell(row.id, "is_loose", e.target.checked)}
                        className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className={`text-[11px] font-semibold ${row.is_loose ? "text-indigo-700" : "text-slate-400"}`}>
                        {row.is_loose ? "Yes (Weight)" : "No"}
                      </span>
                    </label>
                  </td>

                  {/* Purchase Price */}
                  <td className="border-r border-slate-200 p-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={row.purchase_price}
                      onChange={(e) => updateCell(row.id, "purchase_price", e.target.value)}
                      className="w-full rounded bg-transparent px-2 py-1 text-right text-xs font-mono text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </td>

                  {/* Selling Price */}
                  <td className={`border-r border-slate-200 p-1 bg-emerald-50/50 ${isPriceMissing ? "bg-red-50" : ""}`}>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={row.selling_price}
                      onChange={(e) => updateCell(row.id, "selling_price", e.target.value)}
                      className={`w-full rounded px-2 py-1 text-right text-xs font-mono font-bold text-emerald-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
                        isPriceMissing ? "border border-red-300 bg-red-50" : "bg-transparent"
                      }`}
                    />
                  </td>

                  {/* MRP */}
                  <td className="border-r border-slate-200 p-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={row.mrp}
                      onChange={(e) => updateCell(row.id, "mrp", e.target.value)}
                      className="w-full rounded bg-transparent px-2 py-1 text-right text-xs font-mono text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </td>

                  {/* Stock */}
                  <td className="border-r border-slate-200 p-1">
                    <input
                      type="number"
                      step="any"
                      placeholder="10"
                      value={row.stock}
                      onChange={(e) => updateCell(row.id, "stock", e.target.value)}
                      className="w-full rounded bg-transparent px-1.5 py-1 text-center text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </td>

                  {/* Margin % */}
                  <td className="border-r border-slate-200 px-2 py-1 text-center font-mono text-[11px]">
                    {profitMargin ? (
                      <span
                        className={`rounded px-1.5 py-0.5 font-bold ${
                          isProfit
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {profitMargin}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-2 py-1 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDuplicateRow(row)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                        title="Duplicate this row"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                        title="Delete row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Datalists for autocompletion */}
      <datalist id="categories-datalist">
        {categories.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <datalist id="units-datalist">
        {COMMON_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      {/* Spreadsheet Bottom Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-5 py-3 border-t border-slate-200 text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <b>Loose Item Feature:</b> When &ldquo;Loose Weight&rdquo; is checked, unit is sold by weight (kg/g) and POS will pop up a weight dialog when scanned.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleAddRow}
            variant="outline"
            className="text-xs h-8 gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add Row
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSaveAll}
            disabled={saving || validRows.length === 0}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs h-8 px-4 gap-1.5 shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            Save {validRows.length} Product{validRows.length !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>

      {/* Modal: Paste from Excel / Google Sheets */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-emerald-800">
                <ClipboardPaste className="h-5 w-5" />
                <h3 className="text-base font-bold text-gray-900">
                  Paste Multiple Products from Excel / Spreadsheet
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-xs text-gray-600 leading-relaxed">
              Copy rows directly from your Excel or Google Sheet and paste them below.
              Columns expected (Tab or Comma separated):
              <br />
              <code className="mt-1 block rounded bg-slate-100 p-2 font-mono text-[11px] text-slate-800 border">
                Product Name | Barcode | Category | Brand | Unit | Selling Price | Purchase Price | MRP | Stock | Loose (Yes/No)
              </code>
            </p>

            <textarea
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your copied spreadsheet cells here (Ctrl+V)..."
              className="mt-3 w-full rounded-xl border border-gray-300 p-3 font-mono text-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              autoFocus
            />

            <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPasteModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApplyPaste}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-4"
              >
                Parse & Add to Grid
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

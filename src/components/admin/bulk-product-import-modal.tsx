"use client";

import { useState, useRef } from "react";
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  X,
  FileCheck,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  parseCSV,
  processProductRows,
  getSampleKiranaProductsCSV,
  downloadCSVFile,
  type ParsedProductRow,
} from "@/utils/csv-helper";
import { bulkImportService, type BulkImportProgress } from "@/services/bulk-import.service";
import { formatPrice } from "@/utils/format";

interface BulkProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkProductImportModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkProductImportModalProps) {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "complete">("upload");
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  // Settings
  const [duplicateMode, setDuplicateMode] = useState<"update" | "skip">("update");
  const [stockMode, setStockMode] = useState<"add" | "set">("add");

  // Progress
  const [progress, setProgress] = useState<BulkImportProgress>({
    current: 0,
    total: 0,
    percentage: 0,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    currentItemName: "",
    errors: [],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const csv = getSampleKiranaProductsCSV();
    downloadCSVFile("odhavram_products_sample_template.csv", csv);
    toast.success("Sample template downloaded! Open in Excel, edit, and upload.");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv") && !file.name.toLowerCase().endsWith(".txt")) {
      toast.error("Please upload a .csv file");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          toast.error("The selected file is empty");
          return;
        }

        const rawMatrix = parseCSV(text);
        if (rawMatrix.length < 2) {
          toast.error("CSV must have a header row and at least 1 product row");
          return;
        }

        const { parsedRows: processed, validRowsCount, errorRowsCount } = processProductRows(rawMatrix);
        if (processed.length === 0) {
          toast.error("No valid product data rows found in this file");
          return;
        }

        setParsedRows(processed);
        setValidCount(validRowsCount);
        setErrorCount(errorRowsCount);
        setStep("preview");
      } catch (err) {
        toast.error("Failed to parse CSV: " + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
  };

  const handleStartImport = async () => {
    setStep("importing");
    try {
      const result = await bulkImportService.runImport(
        parsedRows,
        { duplicateMode, stockMode },
        (p) => setProgress(p)
      );

      setStep("complete");
      toast.success(
        `Import complete! ${result.createdCount} created, ${result.updatedCount} updated.`
      );
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  };

  const resetAll = () => {
    setStep("upload");
    setFileName("");
    setParsedRows([]);
    setValidCount(0);
    setErrorCount(0);
    setProgress({
      current: 0,
      total: 0,
      percentage: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      currentItemName: "",
      errors: [],
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Bulk Import Products & Stock</h2>
              <p className="text-xs text-emerald-100">
                Easily import your entire shop inventory from an Excel / CSV spreadsheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-white/80 hover:bg-white/20 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: UPLOAD & TEMPLATE */}
          {step === "upload" && (
            <div className="space-y-6">
              {/* Instructions banner */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-emerald-600 p-2 text-white shrink-0 mt-0.5">
                    <Download className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-emerald-950">
                      Step 1: Download the Starter Template
                    </h3>
                    <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                      Download our pre-formatted template with 12 popular Indian grocery & general store products (Parle-G, Maggi, Tata Salt, Surf Excel, Amul Milk, etc.). You can open it in Microsoft Excel or Google Sheets, add your own items or copy-paste from your supplier lists, and save as CSV!
                    </p>
                    <div className="mt-3">
                      <Button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-8 shadow-sm"
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" /> Download Sample CSV Template
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Drop Zone */}
              <div className="rounded-2xl border-2 border-dashed border-gray-300 hover:border-emerald-500 bg-gray-50/50 hover:bg-emerald-50/20 p-8 text-center transition-all cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 mb-3 shadow-inner">
                  <Upload className="h-7 w-7" />
                </div>
                <h4 className="text-base font-semibold text-gray-900">
                  Select your completed CSV file
                </h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Click here to browse or drag and drop your <span className="font-semibold text-gray-700">.csv</span> file.
                </p>
                <div className="mt-4">
                  <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm border border-gray-200">
                    Supports Barcode, Name, Category, Stock, Price, GST, Multi-unit packing
                  </span>
                </div>
              </div>

              {/* Columns format guide */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                  Recognized Columns (in any order):
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-700">
                  <div className="rounded-md bg-gray-50 p-2 border border-gray-100">
                    <span className="font-semibold text-emerald-800">Product Name*</span>
                    <p className="text-[11px] text-gray-500">Required item name</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-2 border border-gray-100">
                    <span className="font-semibold text-emerald-800">Selling Price*</span>
                    <p className="text-[11px] text-gray-500">Retail price (₹)</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-2 border border-gray-100">
                    <span className="font-semibold text-emerald-800">Stock</span>
                    <p className="text-[11px] text-gray-500">Opening quantity</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-2 border border-gray-100">
                    <span className="font-semibold text-emerald-800">Barcode</span>
                    <p className="text-[11px] text-gray-500">EAN-13 / Scanner code</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-2 border border-gray-100">
                    <span className="font-semibold text-gray-800">Category</span>
                    <p className="text-[11px] text-gray-500">Auto-created if new</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-2 border border-gray-100">
                    <span className="font-semibold text-gray-800">Purchase Price / MRP</span>
                    <p className="text-[11px] text-gray-500">Cost & printed MRP</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-2 border border-gray-100">
                    <span className="font-semibold text-gray-800">Unit / Brand</span>
                    <p className="text-[11px] text-gray-500">pcs, kg, L, Parle, etc.</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-2 border border-gray-100">
                    <span className="font-semibold text-gray-800">GST % / Reorder</span>
                    <p className="text-[11px] text-gray-500">0, 5, 12, 18% & low stock</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & IMPORT SETTINGS */}
          {step === "preview" && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{fileName}</h3>
                    <p className="text-xs text-gray-500">
                      Total: <strong className="text-gray-900">{parsedRows.length}</strong> items | Valid:{" "}
                      <strong className="text-emerald-700">{validCount}</strong> | Invalid:{" "}
                      <strong className={errorCount > 0 ? "text-red-600" : "text-gray-500"}>
                        {errorCount}
                      </strong>
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetAll}
                  className="text-xs"
                >
                  Change File
                </Button>
              </div>

              {/* Import Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-xs">
                <div>
                  <label className="font-bold text-gray-800 block mb-1">
                    Duplicate Handling (matching barcode or name):
                  </label>
                  <div className="space-y-1.5 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="dupMode"
                        checked={duplicateMode === "update"}
                        onChange={() => setDuplicateMode("update")}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span><strong>Update existing product</strong> (Update price & update stock)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="dupMode"
                        checked={duplicateMode === "skip"}
                        onChange={() => setDuplicateMode("skip")}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span><strong>Skip existing product</strong> (Do not touch existing data)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-gray-800 block mb-1">
                    Stock Handling for Existing Products:
                  </label>
                  <div className="space-y-1.5 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="stkMode"
                        checked={stockMode === "add"}
                        onChange={() => setStockMode("add")}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span><strong>Add to current stock (+Qty)</strong> (e.g. Current 10 + File 20 = 30)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="stkMode"
                        checked={stockMode === "set"}
                        onChange={() => setStockMode("set")}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span><strong>Set exact stock (=Qty)</strong> (Overwrite current stock with file value)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Data Table Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                    Preview (First {Math.min(10, parsedRows.length)} of {parsedRows.length} rows):
                  </h4>
                  <span className="text-[11px] text-gray-500">
                    New categories will be automatically created
                  </span>
                </div>
                <div className="max-h-72 overflow-x-auto overflow-y-auto rounded-xl border border-gray-200 shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-100 text-gray-700 font-semibold sticky top-0 border-b">
                      <tr>
                        <th className="p-2.5">Row</th>
                        <th className="p-2.5">Barcode</th>
                        <th className="p-2.5">Product Name</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">Price</th>
                        <th className="p-2.5">Stock</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parsedRows.slice(0, 15).map((r, i) => (
                        <tr key={i} className={r.errors.length > 0 ? "bg-red-50/50" : "hover:bg-gray-50"}>
                          <td className="p-2.5 text-gray-500 font-mono">#{r.rawRowNumber}</td>
                          <td className="p-2.5 font-mono text-gray-700">
                            {r.barcode || <span className="text-gray-400 italic">auto-generated</span>}
                          </td>
                          <td className="p-2.5 font-medium text-gray-900">{r.name}</td>
                          <td className="p-2.5 text-gray-600">{r.categoryName}</td>
                          <td className="p-2.5 font-semibold text-emerald-800">
                            {formatPrice(r.sellingPrice)}
                          </td>
                          <td className="p-2.5 font-semibold text-gray-800">
                            {r.stock} {r.unit}
                          </td>
                          <td className="p-2.5">
                            {r.errors.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-medium">
                                <XCircle className="h-3 w-3" /> {r.errors[0]}
                              </span>
                            ) : r.warnings.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                                <AlertTriangle className="h-3 w-3" /> {r.warnings[0]}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                                <CheckCircle2 className="h-3 w-3" /> Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: IMPORTING PROGRESS */}
          {step === "importing" && (
            <div className="py-10 text-center space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 animate-pulse">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Importing Products & Stock into Database...
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Processing item: <span className="font-semibold text-gray-800">{progress.currentItemName || "Please wait..."}</span>
                </p>
              </div>

              {/* Progress bar */}
              <div className="max-w-md mx-auto space-y-2">
                <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-200 ease-out"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-600 font-medium">
                  <span>{progress.current} of {progress.total} products</span>
                  <span>{progress.percentage}%</span>
                </div>
              </div>

              <div className="flex justify-center gap-6 text-xs text-gray-700 pt-2">
                <div>Created: <strong className="text-emerald-700">{progress.createdCount}</strong></div>
                <div>Updated: <strong className="text-blue-700">{progress.updatedCount}</strong></div>
                <div>Skipped: <strong className="text-gray-600">{progress.skippedCount}</strong></div>
                <div>Failed: <strong className="text-red-600">{progress.errorCount}</strong></div>
              </div>
            </div>
          )}

          {/* STEP 4: COMPLETE */}
          {step === "complete" && (
            <div className="py-8 text-center space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-sm">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Import Completed Successfully!
                </h3>
                <p className="text-xs text-gray-600 mt-1 max-w-sm mx-auto">
                  Your products, stock counts, and categories have been loaded into Odhavram General Store catalog.
                </p>
              </div>

              {/* Stat summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto text-left">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <span className="text-xs text-emerald-800">New Products</span>
                  <p className="text-2xl font-bold text-emerald-950 mt-0.5">{progress.createdCount}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <span className="text-xs text-blue-800">Updated Items</span>
                  <p className="text-2xl font-bold text-blue-950 mt-0.5">{progress.updatedCount}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <span className="text-xs text-gray-600">Skipped</span>
                  <p className="text-2xl font-bold text-gray-800 mt-0.5">{progress.skippedCount}</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <span className="text-xs text-red-800">Errors</span>
                  <p className="text-2xl font-bold text-red-950 mt-0.5">{progress.errorCount}</p>
                </div>
              </div>

              {progress.errors.length > 0 && (
                <div className="max-w-md mx-auto text-left rounded-xl border border-red-200 bg-red-50/50 p-4 text-xs">
                  <h5 className="font-semibold text-red-900 mb-2">Rows with issues:</h5>
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {progress.errors.map((e, idx) => (
                      <p key={idx} className="text-red-700">
                        Row #{e.rowNumber} ({e.productName}): {e.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
          {step === "upload" && (
            <>
              <Button variant="ghost" onClick={onClose} size="sm">
                Cancel
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
              >
                <Upload className="h-4 w-4 mr-1.5" /> Select CSV File
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={resetAll} size="sm">
                Back
              </Button>
              <Button
                onClick={handleStartImport}
                disabled={validCount === 0}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-5"
              >
                Import {validCount} Products Now <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </>
          )}

          {step === "importing" && (
            <div className="w-full text-center text-xs text-gray-500 italic">
              Please keep this window open until import completes...
            </div>
          )}

          {step === "complete" && (
            <div className="w-full flex justify-end gap-2">
              <Button
                onClick={resetAll}
                variant="outline"
                size="sm"
              >
                Import Another File
              </Button>
              <Button
                onClick={() => {
                  onClose();
                  onSuccess();
                }}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

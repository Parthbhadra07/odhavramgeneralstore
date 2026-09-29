import { requireClient } from "@/lib/supabase/client";
import { productService } from "@/services/product.service";
import { categoryService } from "@/services/category.service";
import { inventoryService } from "@/services/erp/inventory.service";
import { slugify } from "@/utils/format";
import type { ParsedProductRow } from "@/utils/csv-helper";
import type { Category, Product } from "@/types/database";

export interface BulkImportOptions {
  duplicateMode: "update" | "skip";
  stockMode: "add" | "set";
}

export interface BulkImportProgress {
  current: number;
  total: number;
  percentage: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  currentItemName: string;
  errors: Array<{ rowNumber: number; productName: string; message: string }>;
}

export const bulkImportService = {
  /**
   * Executes the bulk import of parsed CSV rows into Supabase
   */
  async runImport(
    rows: ParsedProductRow[],
    options: BulkImportOptions,
    onProgress?: (progress: BulkImportProgress) => void
  ): Promise<{
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    errorCount: number;
    errors: Array<{ rowNumber: number; productName: string; message: string }>;
  }> {
    const supabase = requireClient();

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: Array<{ rowNumber: number; productName: string; message: string }> = [];

    // 1. Fetch all existing categories & map lowercase name -> Category
    const existingCategories = await categoryService.getAll().catch(() => [] as Category[]);
    const categoryMap = new Map<string, Category>();
    existingCategories.forEach((cat) => {
      categoryMap.set(cat.name.toLowerCase().trim(), cat);
    });

    // 2. Collect unique new category names from CSV and create them
    const newCategoryNames = new Set<string>();
    rows.forEach((r) => {
      const catName = (r.categoryName || "General").trim();
      if (!categoryMap.has(catName.toLowerCase())) {
        newCategoryNames.add(catName);
      }
    });

    for (const catName of newCategoryNames) {
      try {
        const createdCat = await categoryService.create({
          name: catName,
          slug: slugify(catName),
          image: null,
        });
        categoryMap.set(catName.toLowerCase(), createdCat);
      } catch (e) {
        console.warn(`Could not create category "${catName}":`, e);
      }
    }

    // 3. Fetch existing products for duplicate detection (indexed by barcode and slug)
    const existingProducts = await productService.getAll({ includeInactive: true }).catch(() => [] as Product[]);
    const barcodeMap = new Map<string, Product>();
    const slugMap = new Map<string, Product>();

    existingProducts.forEach((p) => {
      if (p.barcode) barcodeMap.set(p.barcode.trim(), p);
      if (p.slug) slugMap.set(p.slug.trim(), p);
    });

    const total = rows.length;

    // 4. Process each row sequentially to respect progress reporting and avoid rate limit bursts
    for (let i = 0; i < total; i++) {
      const row = rows[i];

      // Update progress callback
      const percentage = Math.round(((i + 1) / total) * 100);
      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          percentage,
          createdCount,
          updatedCount,
          skippedCount,
          errorCount,
          currentItemName: row.name,
          errors,
        });
      }

      // Check if this row has fatal validation errors
      if (row.errors.length > 0) {
        errorCount++;
        errors.push({
          rowNumber: row.rawRowNumber,
          productName: row.name || "Unknown",
          message: row.errors.join(", "),
        });
        continue;
      }

      try {
        // Resolve category
        const catName = (row.categoryName || "General").trim().toLowerCase();
        const categoryId = categoryMap.get(catName)?.id || null;

        // Check if product already exists (by barcode or by generated slug)
        const targetSlug = slugify(row.name);
        const existing =
          (row.barcode ? barcodeMap.get(row.barcode.trim()) : null) ||
          slugMap.get(targetSlug) ||
          null;

        if (existing) {
          if (options.duplicateMode === "skip") {
            skippedCount++;
            continue;
          }

          // Calculate new stock
          let newStock = row.stock;
          if (options.stockMode === "add") {
            newStock = (existing.stock || 0) + (row.stock || 0);
          }

          // Update existing product
          await productService.update(existing.id, {
            price: row.sellingPrice,
            selling_price: row.sellingPrice,
            stock: newStock,
            mrp: row.mrp ?? existing.mrp,
            purchase_price: row.purchasePrice ?? existing.purchase_price,
            gst_percentage: row.gstPercentage ?? existing.gst_percentage,
            reorder_level: row.reorderLevel ?? existing.reorder_level,
            min_stock_level: row.minStockLevel ?? existing.min_stock_level,
            unit: row.unit || existing.unit,
            brand: row.brand || existing.brand,
            category_id: categoryId || existing.category_id,
            pieces_per_packet: row.piecesPerPacket ?? existing.pieces_per_packet,
            packets_per_box: row.packetsPerBox ?? existing.packets_per_box,
            packet_selling_price: row.packetSellingPrice ?? existing.packet_selling_price,
            box_selling_price: row.boxSellingPrice ?? existing.box_selling_price,
          });

          // If stock changed and stock movement tracking is desired
          const stockDelta = newStock - (existing.stock || 0);
          if (stockDelta !== 0) {
            try {
              await inventoryService.adjustStock(
                existing.id,
                stockDelta,
                `Bulk CSV Import (${options.stockMode === "add" ? "Stock In" : "Stock Override"})`
              );
            } catch {
              // Non-fatal if RPC movement isn't strictly configured
            }
          }

          // Update internal memory maps
          existing.stock = newStock;
          existing.price = row.sellingPrice;
          existing.selling_price = row.sellingPrice;

          updatedCount++;
        } else {
          // Create new product
          const autoBarcode = row.barcode || `OGS${Date.now().toString().slice(-8)}${i}`;

          const created = await productService.create({
            name: row.name.trim(),
            slug: targetSlug,
            description: "",
            price: row.sellingPrice,
            stock: row.stock || 0,
            image_url: null,
            category_id: categoryId,
            featured: false,
            sku: null,
            barcode: autoBarcode,
            brand: row.brand || null,
            unit: row.unit || "pcs",
            pieces_per_packet: row.piecesPerPacket || 12,
            packets_per_box: row.packetsPerBox || 12,
            packet_selling_price: row.packetSellingPrice || null,
            box_selling_price: row.boxSellingPrice || null,
            purchase_price: row.purchasePrice || null,
            mrp: row.mrp || null,
            gst_percentage: row.gstPercentage || 0,
            reorder_level: row.reorderLevel || 10,
            min_stock_level: row.minStockLevel || 5,
            selling_price: row.sellingPrice,
          });

          // Add to memory map so future lines in the same CSV with same barcode/slug are handled
          if (created) {
            if (created.barcode) barcodeMap.set(created.barcode, created);
            if (created.slug) slugMap.set(created.slug, created);
          }

          createdCount++;
        }
      } catch (err) {
        errorCount++;
        errors.push({
          rowNumber: row.rawRowNumber,
          productName: row.name,
          message: err instanceof Error ? err.message : "Failed to import row",
        });
      }
    }

    // Refresh product cache after bulk operations
    try {
      await productService.getAll();
    } catch {
      // ignore
    }

    return {
      createdCount,
      updatedCount,
      skippedCount,
      errorCount,
      errors,
    };
  },
};

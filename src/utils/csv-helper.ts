/**
 * CSV parsing and exporting utilities for Odhavram General Store
 * Robust RFC-4180 compliant parser without external dependencies.
 */

export interface ParsedProductRow {
  rawRowNumber: number;
  barcode: string;
  name: string;
  categoryName: string;
  brand: string;
  unit: string;
  sellingPrice: number;
  purchasePrice?: number;
  mrp?: number;
  stock: number;
  gstPercentage?: number;
  imageUrl?: string;
  reorderLevel?: number;
  minStockLevel?: number;
  piecesPerPacket?: number;
  packetsPerBox?: number;
  packetSellingPrice?: number;
  boxSellingPrice?: number;
  isLoose?: boolean;
  errors: string[];
  warnings: string[];
}

/** Parse raw CSV text into a 2D array of string cells */
export function parseCSV(text: string): string[][] {
  // Strip UTF-8 BOM if present
  let clean = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentCell += '"';
          i++; // Skip the next quote
        } else {
          // End of quoted cell
          insideQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\r") {
        if (nextChar === "\n") i++; // handle CRLF
        currentRow.push(currentCell.trim());
        currentCell = "";
        if (currentRow.some((c) => c !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else if (char === "\n") {
        currentRow.push(currentCell.trim());
        currentCell = "";
        if (currentRow.some((c) => c !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentCell += char;
      }
    }
  }

  // Final cell & row if file doesn't end with a newline
  if (currentCell !== "" || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/** Map various column names to normalized field identifiers */
export function normalizeHeader(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["barcode", "code", "ean", "upc", "sku", "itemcode", "bar"].includes(h)) return "barcode";
  if (["name", "productname", "itemname", "product", "item", "title", "description"].includes(h)) return "name";
  if (["category", "categoryname", "cat", "group", "itemgroup", "department"].includes(h)) return "category";
  if (["brand", "company", "manufacturer", "mfr", "make"].includes(h)) return "brand";
  if (["unit", "uom", "measurement", "unitofmeasure"].includes(h)) return "unit";
  if (["sellingprice", "price", "saleprice", "rate", "sp", "ourprice", "retailprice"].includes(h)) return "selling_price";
  if (["purchaseprice", "costprice", "buyrate", "cost", "cp", "purchaserate"].includes(h)) return "purchase_price";
  if (["mrp", "maxretailprice", "maximumretailprice"].includes(h)) return "mrp";
  if (["stock", "quantity", "qty", "openingstock", "currentstock", "available"].includes(h)) return "stock";
  if (["gst", "tax", "gstpercentage", "gstpercent", "taxrate", "vat"].includes(h)) return "gst_percentage";
  if (["photo", "image", "imageurl", "photourl", "productphoto", "productimage", "img", "picture", "pic"].includes(h)) return "image_url";
  if (["reorderlevel", "reorder", "alertqty", "minstock", "minlevel"].includes(h)) return "reorder_level";
  if (["minstocklevel", "minimumstock"].includes(h)) return "min_stock_level";
  if (["piecesperpacket", "pcsperpacket", "piecesperpkt", "pcsperpkt"].includes(h)) return "pieces_per_packet";
  if (["packetsperbox", "pktsperbox", "packetperbox"].includes(h)) return "packets_per_box";
  if (["packetsellingprice", "packetprice", "pktsellingprice", "pktprice"].includes(h)) return "packet_selling_price";
  if (["boxsellingprice", "boxprice"].includes(h)) return "box_selling_price";
  if (["loose", "isloose", "is_loose", "byweight", "weightitem", "scaleitem"].includes(h)) return "is_loose";
  return h;
}

/** Parse and validate CSV data into structured product items */
export function processProductRows(rawRows: string[][]): {
  parsedRows: ParsedProductRow[];
  headerMap: Record<string, number>;
  totalRows: number;
  validRowsCount: number;
  errorRowsCount: number;
} {
  if (rawRows.length === 0) {
    return { parsedRows: [], headerMap: {}, totalRows: 0, validRowsCount: 0, errorRowsCount: 0 };
  }

  const rawHeaders = rawRows[0];
  const headerMap: Record<string, number> = {};
  rawHeaders.forEach((h, idx) => {
    const key = normalizeHeader(h);
    if (key && headerMap[key] === undefined) {
      headerMap[key] = idx;
    }
  });

  const parsedRows: ParsedProductRow[] = [];
  let validRowsCount = 0;
  let errorRowsCount = 0;

  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    // Skip empty lines
    if (row.length === 0 || row.every((c) => !c || c.trim() === "")) continue;

    const errors: string[] = [];
    const warnings: string[] = [];

    const getVal = (key: string): string => {
      const idx = headerMap[key];
      return idx !== undefined && row[idx] !== undefined ? row[idx].trim() : "";
    };

    const barcode = getVal("barcode");
    const name = getVal("name");
    const categoryName = getVal("category") || "General";
    const brand = getVal("brand");
    const unit = getVal("unit") || "pcs";

    const rawSellingPrice = getVal("selling_price").replace(/[^0-9.-]/g, "");
    const sellingPrice = parseFloat(rawSellingPrice);

    const rawPurchasePrice = getVal("purchase_price").replace(/[^0-9.-]/g, "");
    const purchasePrice = rawPurchasePrice ? parseFloat(rawPurchasePrice) : undefined;

    const rawMrp = getVal("mrp").replace(/[^0-9.-]/g, "");
    const mrp = rawMrp ? parseFloat(rawMrp) : undefined;

    const rawStock = getVal("stock").replace(/[^0-9.-]/g, "");
    const stock = rawStock ? parseInt(rawStock, 10) : 0;

    const rawGst = getVal("gst_percentage").replace(/[^0-9.-]/g, "");
    const gstPercentage = rawGst ? parseFloat(rawGst) : 0;

    const rawReorder = getVal("reorder_level").replace(/[^0-9.-]/g, "");
    const reorderLevel = rawReorder ? parseInt(rawReorder, 10) : 10;

    const rawMinStock = getVal("min_stock_level").replace(/[^0-9.-]/g, "");
    const minStockLevel = rawMinStock ? parseInt(rawMinStock, 10) : 5;

    const rawPcsPerPkt = getVal("pieces_per_packet").replace(/[^0-9.-]/g, "");
    const piecesPerPacket = rawPcsPerPkt ? parseInt(rawPcsPerPkt, 10) : 12;

    const rawPktsPerBox = getVal("packets_per_box").replace(/[^0-9.-]/g, "");
    const packetsPerBox = rawPktsPerBox ? parseInt(rawPktsPerBox, 10) : 12;

    const rawPktPrice = getVal("packet_selling_price").replace(/[^0-9.-]/g, "");
    const packetSellingPrice = rawPktPrice ? parseFloat(rawPktPrice) : undefined;

    const rawBoxPrice = getVal("box_selling_price").replace(/[^0-9.-]/g, "");
    const boxSellingPrice = rawBoxPrice ? parseFloat(rawBoxPrice) : undefined;

    const rawLoose = getVal("is_loose").toLowerCase();
    const isLoose =
      rawLoose === "true" ||
      rawLoose === "1" ||
      rawLoose === "yes" ||
      rawLoose === "y" ||
      unit.toLowerCase() === "loose";

    const imageUrl = getVal("image_url") || undefined;

    // Validation
    if (!name) {
      errors.push("Product Name is missing");
    }

    if (isNaN(sellingPrice) || sellingPrice < 0) {
      errors.push("Invalid Selling Price (must be a positive number)");
    }

    if (!barcode) {
      warnings.push("No barcode specified (will generate auto barcode)");
    }

    if (mrp !== undefined && sellingPrice > mrp) {
      warnings.push(`Selling Price (₹${sellingPrice}) is higher than MRP (₹${mrp})`);
    }

    if (errors.length > 0) {
      errorRowsCount++;
    } else {
      validRowsCount++;
    }

    parsedRows.push({
      rawRowNumber: r + 1,
      barcode,
      name,
      categoryName,
      brand,
      unit,
      sellingPrice: isNaN(sellingPrice) ? 0 : sellingPrice,
      purchasePrice,
      mrp,
      stock: isNaN(stock) ? 0 : stock,
      gstPercentage: isNaN(gstPercentage) ? 0 : gstPercentage,
      imageUrl,
      reorderLevel: isNaN(reorderLevel) ? 10 : reorderLevel,
      minStockLevel: isNaN(minStockLevel) ? 5 : minStockLevel,
      piecesPerPacket,
      packetsPerBox,
      packetSellingPrice,
      boxSellingPrice,
      isLoose,
      errors,
      warnings,
    });
  }

  return {
    parsedRows,
    headerMap,
    totalRows: parsedRows.length,
    validRowsCount,
    errorRowsCount,
  };
}

/** Generates sample CSV template pre-filled with typical Kirana/General store products */
export function getSampleKiranaProductsCSV(): string {
  const headers = [
    "Barcode",
    "Product Name",
    "Category",
    "Brand",
    "Unit",
    "Selling Price",
    "Purchase Price",
    "MRP",
    "Stock",
    "GST %",
    "Product Photo URL",
    "Reorder Level",
    "Pieces Per Packet",
    "Packets Per Box",
  ];

  const sampleItems = [
    ["8901030383709", "Parle-G Glucose Biscuits 80g", "Biscuits & Snacks", "Parle", "pcs", "10", "8.50", "10", "120", "0", "https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e", "24", "12", "12"],
    ["8901058852331", "Maggi 2-Minute Masala Noodles 70g", "Noodles & Instant Food", "Nestle", "pcs", "14", "11.80", "14", "96", "5", "https://images.unsplash.com/photo-1612927601601-6638404737ce", "24", "12", "8"],
    ["8901063141123", "Britannia Good Day Butter Cookies 75g", "Biscuits & Snacks", "Britannia", "pcs", "15", "12.50", "15", "60", "0", "", "12", "12", "12"],
    ["8901030010049", "Tata Salt Vacuum Evaporated 1kg", "Grocery & Spices", "Tata", "kg", "28", "24.00", "28", "50", "0", "", "15", "1", "25"],
    ["8901030366887", "Lifebuoy Total Germ Protection Soap 125g", "Personal Care", "Lifebuoy", "pcs", "38", "31.00", "40", "48", "18", "", "12", "4", "18"],
    ["8901248100115", "Dettol Antiseptic Liquid 100ml", "Personal Care", "Dettol", "pcs", "42", "36.00", "45", "30", "12", "", "6", "1", "24"],
    ["8901030612182", "Surf Excel Easy Wash Detergent Powder 1kg", "Household & Laundry", "Surf Excel", "kg", "145", "128.00", "155", "35", "18", "", "8", "1", "10"],
    ["8901262010019", "Amul Taaza Toned Milk 1L Tetra", "Dairy & Milk", "Amul", "pcs", "72", "66.00", "74", "25", "0", "", "10", "1", "12"],
    ["8901030020017", "Brooke Bond Red Label Tea 250g", "Beverages", "Brooke Bond", "pcs", "135", "118.00", "145", "40", "5", "", "10", "1", "20"],
    ["8901725131234", "Balaji Wafers Simply Salted 35g", "Biscuits & Snacks", "Balaji", "pcs", "10", "8.20", "10", "80", "5", "", "20", "12", "10"],
    ["8901314010012", "Aashirvaad Superior MP Sharbati Atta 5kg", "Grocery & Flour", "ITC", "pcs", "295", "265.00", "310", "20", "0", "", "5", "1", "4"],
    ["8901030030023", "Colgate Strong Teeth Toothpaste 100g", "Personal Care", "Colgate", "pcs", "62", "52.00", "65", "45", "18", "", "10", "1", "24"],
  ];

  const escapeCSVCell = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const headerLine = headers.map(escapeCSVCell).join(",");
  const dataLines = sampleItems.map((row) => row.map(escapeCSVCell).join(",")).join("\r\n");

  return `${headerLine}\r\n${dataLines}`;
}

/** Export an array of Product items to CSV format */
export function exportProductsToCSV(products: Array<Record<string, any>>): string {
  const headers = [
    "Barcode",
    "Product Name",
    "Category",
    "Brand",
    "Unit",
    "Selling Price",
    "Purchase Price",
    "MRP",
    "Stock",
    "Loose (Yes/No)",
    "GST %",
    "Product Photo URL",
    "Reorder Level",
    "Pieces Per Packet",
    "Packets Per Box",
  ];

  const escapeCell = (val: any): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = products.map((p) => [
    p.barcode || "",
    p.name || "",
    p.categories?.name || p.category_name || "",
    p.brand || "",
    p.unit || "pcs",
    p.selling_price ?? p.price ?? 0,
    p.purchase_price ?? "",
    p.mrp ?? "",
    p.stock ?? 0,
    p.is_loose ? "Yes" : "No",
    p.gst_percentage ?? 0,
    p.image_url || "",
    p.reorder_level ?? 10,
    p.pieces_per_packet ?? 12,
    p.packets_per_box ?? 12,
  ]);

  const csvContent = [
    headers.map(escapeCell).join(","),
    ...rows.map((r) => r.map(escapeCell).join(",")),
  ].join("\r\n");

  return csvContent;
}

/** Trigger browser file download */
export function downloadCSVFile(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

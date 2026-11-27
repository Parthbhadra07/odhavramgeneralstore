import type { ErpProduct } from "@/types/erp";
import type { Product } from "@/types/database";

export type PackagingTierType =
  | "3_tier"          // Pcs -> Packet -> Box (e.g., Biscuits, Instant Noodles)
  | "2_tier_pcs_box"  // Direct Pcs -> Box (No Packet tier, e.g., Cadbury, Chocolates, Soap)
  | "2_tier_pkt_box"  // Base unit is Packet -> Box (e.g., Namkeen, Detergent packs)
  | "single_tier";    // Single unit only (no packet, no box, e.g., Loose items, 2L bottles)

export interface TierPricingInfo {
  unit: "pcs" | "pkt" | "box" | string;
  label: string;
  multiplier: number; // in base units (pcs or base unit)
  description: string;
  purchasePrice: number | null;
  sellingPrice: number;
  mrp: number;
  profit: number | null;
  profitMarginPercent: number | null;
  markupPercent: number | null;
  isAvailable: boolean;
  unavailableReason?: string;
}

export interface ProductPackagingInfo {
  tierType: PackagingTierType;
  tierTypeLabel: string;
  tierTypeDescription: string;
  baseUnit: string;
  hasPacketTier: boolean;
  hasBoxTier: boolean;
  piecesPerPacket: number;
  packetsPerBox: number;
  totalPiecesPerBox: number;

  availableUnits: Array<{
    unit: "pcs" | "pkt" | "box" | string;
    label: string;
    multiplier: number;
    description: string;
  }>;

  pcsTier: TierPricingInfo;
  pktTier: TierPricingInfo;
  boxTier: TierPricingInfo;
}

export type ProductPackagingInput = Partial<ErpProduct> | Partial<Product>;

/**
 * Determine the packaging tier type for a product.
 * Cadbury rule:
 * If an item is sold in pcs and has packets_per_box > 1, but pieces_per_packet is 1 or empty/0,
 * it is a direct 2-tier (Pcs -> Box) with NO intermediate packet tier!
 */
export function detectPackagingTierType(product: ProductPackagingInput): PackagingTierType {
  const baseUnit = (product.unit || "pcs").toLowerCase().trim();
  const pcsPerPkt = Number(product.pieces_per_packet);
  const pktsPerBox = Number(product.packets_per_box);

  if (baseUnit === "pkt" || baseUnit === "packet") {
    if (pktsPerBox > 1) {
      return "2_tier_pkt_box";
    }
    return "single_tier";
  }

  // If pieces_per_packet is strictly greater than 1 AND packets_per_box is greater than 1: 3-tier
  if (pcsPerPkt > 1 && pktsPerBox > 1) {
    return "3_tier";
  }

  // If pcsPerPkt <= 1 (or unset) but pktsPerBox > 1: Direct Pcs -> Box (Cadbury chocolate rule)
  if ((!pcsPerPkt || pcsPerPkt <= 1) && pktsPerBox > 1) {
    return "2_tier_pcs_box";
  }

  // If pcsPerPkt > 1 but no box
  if (pcsPerPkt > 1 && (!pktsPerBox || pktsPerBox <= 1)) {
    return "3_tier"; // Has packet tier, master box = 1 pkt
  }

  return "single_tier";
}

/**
 * Computes complete packaging metrics, multipliers, and multi-unit purchase/selling costs.
 */
export function getProductPackagingInfo(product: ProductPackagingInput): ProductPackagingInfo {
  const baseUnit = (product.unit || "pcs").toLowerCase().trim();
  const rawPcsPerPkt = Number(product.pieces_per_packet);
  const rawPktsPerBox = Number(product.packets_per_box);

  const tierType = detectPackagingTierType(product);

  let hasPacketTier = false;
  let hasBoxTier = false;
  let piecesPerPacket = 1;
  let packetsPerBox = 1;
  let totalPiecesPerBox = 1;
  let tierTypeLabel = "Single Unit";
  let tierTypeDescription = "Standard single unit without multi-pack hierarchy.";

  switch (tierType) {
    case "3_tier": {
      hasPacketTier = true;
      hasBoxTier = rawPktsPerBox > 0;
      piecesPerPacket = rawPcsPerPkt > 1 ? rawPcsPerPkt : 12;
      packetsPerBox = rawPktsPerBox > 0 ? rawPktsPerBox : 12;
      totalPiecesPerBox = piecesPerPacket * packetsPerBox;
      tierTypeLabel = "3-Tier (Pcs → Packet → Box)";
      tierTypeDescription = `1 Pkt = ${piecesPerPacket} pcs | 1 Box = ${packetsPerBox} pkts (${totalPiecesPerBox} pcs)`;
      break;
    }
    case "2_tier_pcs_box": {
      // Direct Pcs -> Box (Cadbury style)
      hasPacketTier = false;
      hasBoxTier = true;
      piecesPerPacket = 1;
      packetsPerBox = rawPktsPerBox > 1 ? rawPktsPerBox : 24;
      totalPiecesPerBox = packetsPerBox; // direct pieces per box
      tierTypeLabel = "2-Tier (Direct Pcs → Box)";
      tierTypeDescription = `No intermediate packet tier. 1 Box contains ${totalPiecesPerBox} pcs directly.`;
      break;
    }
    case "2_tier_pkt_box": {
      hasPacketTier = true; // base unit is packet
      hasBoxTier = true;
      piecesPerPacket = 1;
      packetsPerBox = rawPktsPerBox > 1 ? rawPktsPerBox : 10;
      totalPiecesPerBox = packetsPerBox;
      tierTypeLabel = "2-Tier (Packet → Box)";
      tierTypeDescription = `Base unit is Packet. 1 Master Box = ${packetsPerBox} pkts.`;
      break;
    }
    case "single_tier":
    default: {
      hasPacketTier = false;
      hasBoxTier = false;
      piecesPerPacket = 1;
      packetsPerBox = 1;
      totalPiecesPerBox = 1;
      tierTypeLabel = "Single Unit";
      tierTypeDescription = "Standard item sold in base units only.";
      break;
    }
  }

  // Base pricing
  const baseSellingPrice = Number(product.selling_price ?? (product as any).price ?? 0);
  const basePurchasePrice =
    product.purchase_price !== null &&
    product.purchase_price !== undefined &&
    !isNaN(Number(product.purchase_price)) &&
    Number(product.purchase_price) > 0
      ? Number(product.purchase_price)
      : null;

  const rawMrp = Number((product as any).mrp);
  const baseMrp = rawMrp > 0 ? rawMrp : baseSellingPrice;

  // Custom pricing overrides
  const customPacketSelling =
    product.packet_selling_price !== null &&
    product.packet_selling_price !== undefined &&
    !isNaN(Number(product.packet_selling_price)) &&
    Number(product.packet_selling_price) > 0
      ? Number(product.packet_selling_price)
      : null;

  const customBoxSelling =
    product.box_selling_price !== null &&
    product.box_selling_price !== undefined &&
    !isNaN(Number(product.box_selling_price)) &&
    Number(product.box_selling_price) > 0
      ? Number(product.box_selling_price)
      : null;

  // 1. PCS Tier
  const pcsPurchase = basePurchasePrice;
  const pcsSelling = baseSellingPrice;
  const pcsMrpVal = baseMrp;
  const pcsProfit = pcsPurchase !== null ? pcsSelling - pcsPurchase : null;
  const pcsProfitMargin =
    pcsProfit !== null && pcsSelling > 0 ? (pcsProfit / pcsSelling) * 100 : null;
  const pcsMarkup =
    pcsProfit !== null && pcsPurchase !== null && pcsPurchase > 0
      ? (pcsProfit / pcsPurchase) * 100
      : null;

  const pcsTier: TierPricingInfo = {
    unit: "pcs",
    label: "Piece (Pcs)",
    multiplier: 1,
    description: "1 Single Pc",
    purchasePrice: pcsPurchase,
    sellingPrice: pcsSelling,
    mrp: pcsMrpVal,
    profit: pcsProfit,
    profitMarginPercent: pcsProfitMargin,
    markupPercent: pcsMarkup,
    isAvailable: baseUnit !== "pkt",
    unavailableReason: baseUnit === "pkt" ? "Base unit is Packet" : undefined,
  };

  // 2. PKT Tier
  let pktTier: TierPricingInfo;
  if (hasPacketTier) {
    const pktMultiplier = piecesPerPacket;
    const pktPurchase = basePurchasePrice !== null ? basePurchasePrice * pktMultiplier : null;
    const pktSelling = customPacketSelling ?? (baseSellingPrice * pktMultiplier);
    const pktMrpVal = baseMrp * pktMultiplier;
    const pktProfit = pktPurchase !== null ? pktSelling - pktPurchase : null;
    const pktProfitMargin =
      pktProfit !== null && pktSelling > 0 ? (pktProfit / pktSelling) * 100 : null;
    const pktMarkup =
      pktProfit !== null && pktPurchase !== null && pktPurchase > 0
        ? (pktProfit / pktPurchase) * 100
        : null;

    pktTier = {
      unit: "pkt",
      label: "Packet (Pkt)",
      multiplier: pktMultiplier,
      description: `1 Pkt = ${piecesPerPacket} pcs`,
      purchasePrice: pktPurchase,
      sellingPrice: pktSelling,
      mrp: pktMrpVal,
      profit: pktProfit,
      profitMarginPercent: pktProfitMargin,
      markupPercent: pktMarkup,
      isAvailable: true,
    };
  } else {
    pktTier = {
      unit: "pkt",
      label: "Packet (Pkt)",
      multiplier: 1,
      description: "No Packet tier configured",
      purchasePrice: null,
      sellingPrice: 0,
      mrp: 0,
      profit: null,
      profitMarginPercent: null,
      markupPercent: null,
      isAvailable: false,
      unavailableReason:
        tierType === "2_tier_pcs_box"
          ? "Item has direct Pcs → Box packaging (e.g., Cadbury / Chocolate bars)"
          : "Item does not have a packet tier",
    };
  }

  // 3. BOX Tier
  let boxTier: TierPricingInfo;
  if (hasBoxTier) {
    const boxMultiplier = totalPiecesPerBox;
    const boxPurchase = basePurchasePrice !== null ? basePurchasePrice * boxMultiplier : null;
    const boxSelling = customBoxSelling ?? (baseSellingPrice * boxMultiplier);
    const boxMrpVal = baseMrp * boxMultiplier;
    const boxProfit = boxPurchase !== null ? boxSelling - boxPurchase : null;
    const boxProfitMargin =
      boxProfit !== null && boxSelling > 0 ? (boxProfit / boxSelling) * 100 : null;
    const boxMarkup =
      boxProfit !== null && boxPurchase !== null && boxPurchase > 0
        ? (boxProfit / boxPurchase) * 100
        : null;

    let boxDesc = `1 Box = ${totalPiecesPerBox} pcs`;
    if (tierType === "3_tier") {
      boxDesc = `1 Box = ${packetsPerBox} pkts (${totalPiecesPerBox} pcs)`;
    } else if (tierType === "2_tier_pkt_box") {
      boxDesc = `1 Box = ${packetsPerBox} pkts`;
    }

    boxTier = {
      unit: "box",
      label: "Master Box (Box)",
      multiplier: boxMultiplier,
      description: boxDesc,
      purchasePrice: boxPurchase,
      sellingPrice: boxSelling,
      mrp: boxMrpVal,
      profit: boxProfit,
      profitMarginPercent: boxProfitMargin,
      markupPercent: boxMarkup,
      isAvailable: true,
    };
  } else {
    boxTier = {
      unit: "box",
      label: "Master Box (Box)",
      multiplier: 1,
      description: "No Master Box configured",
      purchasePrice: null,
      sellingPrice: 0,
      mrp: 0,
      profit: null,
      profitMarginPercent: null,
      markupPercent: null,
      isAvailable: false,
      unavailableReason: "Item does not have box packaging",
    };
  }

  // Available units for selector
  const availableUnits: ProductPackagingInfo["availableUnits"] = [];
  if (baseUnit !== "pkt") {
    availableUnits.push({
      unit: "pcs",
      label: "Pcs (1 pc)",
      multiplier: 1,
      description: "1 pc",
    });
  }
  if (hasPacketTier) {
    availableUnits.push({
      unit: "pkt",
      label: `Pkt (${piecesPerPacket} pcs)`,
      multiplier: piecesPerPacket,
      description: `${piecesPerPacket} pcs`,
    });
  }
  if (hasBoxTier) {
    const boxLabel =
      tierType === "3_tier"
        ? `Box (${packetsPerBox} pkts · ${totalPiecesPerBox} pcs)`
        : `Box (${totalPiecesPerBox} pcs)`;
    availableUnits.push({
      unit: "box",
      label: boxLabel,
      multiplier: totalPiecesPerBox,
      description: `${totalPiecesPerBox} pcs`,
    });
  }

  if (availableUnits.length === 0) {
    availableUnits.push({
      unit: baseUnit || "pcs",
      label: `${(baseUnit || "pcs").toUpperCase()} (1)`,
      multiplier: 1,
      description: "1 unit",
    });
  }

  return {
    tierType,
    tierTypeLabel,
    tierTypeDescription,
    baseUnit,
    hasPacketTier,
    hasBoxTier,
    piecesPerPacket,
    packetsPerBox,
    totalPiecesPerBox,
    availableUnits,
    pcsTier,
    pktTier,
    boxTier,
  };
}

/**
 * Safely cycles to the next available unit for a product.
 * For Cadbury (Pcs -> Box), skips 'pkt' completely.
 */
export function getNextAvailableUnit(
  product: ProductPackagingInput,
  currentUnit: string
): "pcs" | "pkt" | "box" | string {
  const info = getProductPackagingInfo(product);
  const units = info.availableUnits.map((u) => u.unit);
  if (units.length === 0) return "pcs";

  const currIdx = units.indexOf(currentUnit);
  if (currIdx === -1 || currIdx === units.length - 1) {
    return units[0];
  }
  return units[currIdx + 1];
}

/**
 * Checks if loose pieces quantity automatically equals full boxes or packets.
 * For Cadbury: converts directly to Box when reaching totalPiecesPerBox (never converts to pkt).
 */
export function autoConvertPiecesToPack(
  product: ProductPackagingInput,
  quantityPieces: number
): {
  unit: "box" | "pkt";
  quantity: number;
  multiplier: number;
  rate: number;
  message: string;
} | null {
  const info = getProductPackagingInfo(product);

  // 1. Check Box conversion first
  if (
    info.hasBoxTier &&
    info.totalPiecesPerBox > 1 &&
    quantityPieces >= info.totalPiecesPerBox &&
    quantityPieces % info.totalPiecesPerBox === 0
  ) {
    const boxes = quantityPieces / info.totalPiecesPerBox;
    const rate = info.boxTier.sellingPrice;
    return {
      unit: "box",
      quantity: boxes,
      multiplier: info.totalPiecesPerBox,
      rate,
      message: `Auto-converted: ${quantityPieces} pcs = ${boxes} Box (${info.boxTier.description})`,
    };
  }

  // 2. Check Packet conversion (ONLY if item actually has a packet tier!)
  if (
    info.hasPacketTier &&
    info.piecesPerPacket > 1 &&
    quantityPieces >= info.piecesPerPacket &&
    quantityPieces % info.piecesPerPacket === 0
  ) {
    const pkts = quantityPieces / info.piecesPerPacket;
    const rate = info.pktTier.sellingPrice;
    return {
      unit: "pkt",
      quantity: pkts,
      multiplier: info.piecesPerPacket,
      rate,
      message: `Auto-converted: ${quantityPieces} pcs = ${pkts} Packet (${info.pktTier.description})`,
    };
  }

  return null;
}


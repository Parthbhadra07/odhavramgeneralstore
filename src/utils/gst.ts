export interface GstBreakdown {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  totalWithGst: number;
}

/** Intra-state GST split (CGST + SGST) */
export function calculateGst(
  amount: number,
  gstPercent: number,
  isInterState = false
): GstBreakdown {
  const rate = gstPercent / 100;
  const taxableAmount = amount;
  const totalGst = Math.round(taxableAmount * rate * 100) / 100;

  if (isInterState) {
    return {
      taxableAmount,
      cgst: 0,
      sgst: 0,
      igst: totalGst,
      totalGst,
      totalWithGst: Math.round((taxableAmount + totalGst) * 100) / 100,
    };
  }

  const half = Math.round((totalGst / 2) * 100) / 100;
  return {
    taxableAmount,
    cgst: half,
    sgst: half,
    igst: 0,
    totalGst,
    totalWithGst: Math.round((taxableAmount + totalGst) * 100) / 100,
  };
}

export function lineItemGst(
  rate: number,
  qty: number,
  gstPercent: number,
  isInterState = false
) {
  const subtotal = rate * qty;
  return calculateGst(subtotal, gstPercent, isInterState);
}

/** Extract GST from a GST-inclusive amount (prices already include tax). */
export function extractGstFromInclusive(
  inclusiveAmount: number,
  gstPercent: number,
  isInterState = false
): GstBreakdown {
  if (gstPercent <= 0) {
    return {
      taxableAmount: inclusiveAmount,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalGst: 0,
      totalWithGst: inclusiveAmount,
    };
  }

  const rate = gstPercent / 100;
  const taxableAmount = Math.round((inclusiveAmount / (1 + rate)) * 100) / 100;
  const totalGst = Math.round((inclusiveAmount - taxableAmount) * 100) / 100;

  if (isInterState) {
    return {
      taxableAmount,
      cgst: 0,
      sgst: 0,
      igst: totalGst,
      totalGst,
      totalWithGst: inclusiveAmount,
    };
  }

  const half = Math.round((totalGst / 2) * 100) / 100;
  return {
    taxableAmount,
    cgst: half,
    sgst: half,
    igst: 0,
    totalGst,
    totalWithGst: inclusiveAmount,
  };
}

export function lineItemInclusiveGst(
  rate: number,
  qty: number,
  gstPercent: number,
  isInterState = false
) {
  const inclusiveTotal = rate * qty;
  return extractGstFromInclusive(inclusiveTotal, gstPercent, isInterState);
}

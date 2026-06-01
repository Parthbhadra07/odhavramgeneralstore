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

/** Normalize Indian mobile for lookup (digits only, strip leading 91). */
export function normalizeMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("91")) {
    return digits.slice(-10);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

export function isValidMobile(raw: string): boolean {
  const n = normalizeMobile(raw);
  return n.length === 10 && /^[6-9]/.test(n);
}

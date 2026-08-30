/** Generate unique numeric barcodes for products */
export function generateBarcode(prefix = "890"): string {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  const base = `${prefix}${ts}${rand}`.slice(0, 12);
  return base.padStart(12, "0");
}

export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === check;
}

export function generateEan13(prefix = "890"): string {
  let code = generateBarcode(prefix).slice(0, 12);
  while (code.length < 12) code += "0";
  const digits = code.split("").map(Number);
  const sum = digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return code + check;
}

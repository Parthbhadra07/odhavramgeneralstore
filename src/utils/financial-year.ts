/**
 * Indian Financial Year (April 1 to March 31) Utility System
 * Provides FY calculations, active FY management, numbering, and date ranges.
 */

export type FinancialYearQuarter = "Q1" | "Q2" | "Q3" | "Q4";

export interface DateRangeResult {
  dateFrom: string;
  dateTo: string;
  startDate: string;
  endDate: string;
}

export interface FinancialYearInfo {
  code: string; // e.g. "26-27"
  fullCode: string; // e.g. "2026-2027"
  label: string; // e.g. "FY 2026-27"
  startYear: number; // 2026
  endYear: number; // 2027
  startDate: Date; // 2026-04-01T00:00:00
  endDate: Date; // 2027-03-31T23:59:59.999
  quarter: FinancialYearQuarter;
  quarterLabel: string; // e.g. "Q2 (Jul - Sep)"
}

const ACTIVE_FY_STORAGE_KEY = "ogs-active-financial-year";

/**
 * Calculates the system Financial Year based on any given Date (defaults to now).
 * In India:
 * - Months 4 to 12 (Apr - Dec): FY start year is current year.
 * - Months 1 to 3 (Jan - Mar): FY start year is previous year.
 */
export function getSystemFinancialYear(targetDate = new Date()): FinancialYearInfo {
  const month = targetDate.getMonth() + 1; // 1 to 12
  const year = targetDate.getFullYear();

  let startYear: number;
  let endYear: number;
  let quarter: FinancialYearQuarter;
  let quarterLabel: string;

  if (month >= 4) {
    startYear = year;
    endYear = year + 1;
    if (month <= 6) {
      quarter = "Q1";
      quarterLabel = "Q1 (Apr - Jun)";
    } else if (month <= 9) {
      quarter = "Q2";
      quarterLabel = "Q2 (Jul - Sep)";
    } else {
      quarter = "Q3";
      quarterLabel = "Q3 (Oct - Dec)";
    }
  } else {
    startYear = year - 1;
    endYear = year;
    quarter = "Q4";
    quarterLabel = "Q4 (Jan - Mar)";
  }

  const code = `${String(startYear % 100).padStart(2, "0")}-${String(endYear % 100).padStart(2, "0")}`;
  const fullCode = `${startYear}-${endYear}`;
  const label = `FY ${startYear}-${String(endYear % 100).padStart(2, "0")}`;

  const startDate = new Date(startYear, 3, 1, 0, 0, 0, 0); // Apr 1
  const endDate = new Date(endYear, 2, 31, 23, 59, 59, 999); // Mar 31

  return {
    code,
    fullCode,
    label,
    startYear,
    endYear,
    startDate,
    endDate,
    quarter,
    quarterLabel,
  };
}

/**
 * Get the currently active Financial Year code from localStorage (or defaults to system FY).
 */
export function getActiveFinancialYearCode(): string {
  if (typeof window === "undefined") {
    return getSystemFinancialYear().code;
  }
  const stored = localStorage.getItem(ACTIVE_FY_STORAGE_KEY);
  if (stored && stored !== "auto" && /^\d{2}-\d{2}$/.test(stored)) {
    return stored;
  }
  return getSystemFinancialYear().code;
}

/**
 * Sets the active financial year code in localStorage.
 * Pass "auto" to revert to automatic system calendar calculation.
 */
export function setActiveFinancialYearCode(fyCode: string): void {
  if (typeof window === "undefined") return;
  if (fyCode === "auto" || /^\d{2}-\d{2}$/.test(fyCode)) {
    localStorage.setItem(ACTIVE_FY_STORAGE_KEY, fyCode);
    window.dispatchEvent(new CustomEvent("ogs-fy-changed", { detail: fyCode }));
  }
}

/**
 * Returns full FinancialYearInfo for a specific FY code (e.g. "26-27") or the current active FY.
 */
export function getFinancialYear(fyCode?: string): FinancialYearInfo {
  const targetCode = fyCode || getActiveFinancialYearCode();
  const match = targetCode.match(/^(\d{2})-(\d{2})$/);
  if (!match) {
    return getSystemFinancialYear();
  }

  const startYY = parseInt(match[1], 10);
  const endYY = parseInt(match[2], 10);
  const startYear = 2000 + startYY;
  const endYear = 2000 + endYY;

  const currentSys = getSystemFinancialYear();
  const isCurrent = currentSys.startYear === startYear;

  const startDate = new Date(startYear, 3, 1, 0, 0, 0, 0);
  const endDate = new Date(endYear, 2, 31, 23, 59, 59, 999);

  return {
    code: targetCode,
    fullCode: `${startYear}-${endYear}`,
    label: `FY ${startYear}-${String(endYY).padStart(2, "0")}`,
    startYear,
    endYear,
    startDate,
    endDate,
    quarter: isCurrent ? currentSys.quarter : "Q1",
    quarterLabel: isCurrent ? currentSys.quarterLabel : "Q1 (Apr - Jun)",
  };
}

/**
 * Returns a selectable list of Financial Years for dropdowns (e.g. FY 2024-25, FY 2025-26, FY 2026-27, FY 2027-28).
 */
export function getFinancialYearList(pastCount = 2, futureCount = 1): {
  code: string;
  label: string;
  isCurrent: boolean;
  startYear: number;
}[] {
  const current = getSystemFinancialYear();
  const list = [];

  for (let i = -pastCount; i <= futureCount; i++) {
    const sYear = current.startYear + i;
    const eYear = sYear + 1;
    const code = `${String(sYear % 100).padStart(2, "0")}-${String(eYear % 100).padStart(2, "0")}`;
    const label = `FY ${sYear}-${String(eYear % 100).padStart(2, "0")}${i === 0 ? " (Current)" : ""}`;
    list.push({
      code,
      label,
      isCurrent: i === 0,
      startYear: sYear,
    });
  }

  return list;
}

/**
 * Returns ISO date strings for querying a specific Financial Year or Quarter.
 */
export function getFYDateRange(fyCode?: string): DateRangeResult {
  const fy = getFinancialYear(fyCode);
  const dateFrom = `${fy.startYear}-04-01`;
  const dateTo = `${fy.endYear}-03-31`;
  return {
    dateFrom,
    dateTo,
    startDate: dateFrom,
    endDate: dateTo,
  };
}

export function getQuarterDateRange(
  fyCode: string,
  quarter: FinancialYearQuarter
): DateRangeResult {
  const fy = getFinancialYear(fyCode);
  let dateFrom = "";
  let dateTo = "";
  switch (quarter) {
    case "Q1":
      dateFrom = `${fy.startYear}-04-01`;
      dateTo = `${fy.startYear}-06-30`;
      break;
    case "Q2":
      dateFrom = `${fy.startYear}-07-01`;
      dateTo = `${fy.startYear}-09-30`;
      break;
    case "Q3":
      dateFrom = `${fy.startYear}-10-01`;
      dateTo = `${fy.startYear}-12-31`;
      break;
    case "Q4":
      dateFrom = `${fy.endYear}-01-01`;
      dateTo = `${fy.endYear}-03-31`;
      break;
  }
  return {
    dateFrom,
    dateTo,
    startDate: dateFrom,
    endDate: dateTo,
  };
}

/**
 * Format standard Indian FY bill number: POS/26-27/000001
 */
export function formatFiscalBillNumber(
  seqNumber: number,
  fyCode?: string,
  prefix = "POS"
): string {
  const fy = getFinancialYear(fyCode);
  const pad = String(seqNumber).padStart(6, "0");
  return `${prefix}/${fy.code}/${pad}`;
}

/**
 * Format standard Indian FY order number: OGS/26-27/000001
 */
export function formatFiscalOrderNumber(
  seqNumber: number,
  fyCode?: string,
  prefix = "OGS"
): string {
  const fy = getFinancialYear(fyCode);
  const pad = String(seqNumber).padStart(6, "0");
  return `${prefix}/${fy.code}/${pad}`;
}

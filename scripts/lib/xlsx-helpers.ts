import * as XLSX from "xlsx";

/** Reads a sheet as an array of rows, each row an array of cell values (0-indexed). Blank cells become "". */
export function sheetToRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in workbook`);
  }
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
}

export function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

export function num(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/**
 * NS-CMMF's per-control level descriptions ("L1 — Initial: ...") and
 * scoring text always lead with "L{n} — {Label}:". Used to derive the
 * maturity scale's labels from the workbook data itself instead of
 * hardcoding them.
 */
export function parseLevelLabel(cellText: string): { level: number; label: string } | null {
  const match = cellText.match(/^L(\d+)\s+—\s+([^:]+):/);
  if (!match) return null;
  return { level: Number(match[1]), label: `L${match[1]} — ${match[2].trim()}` };
}

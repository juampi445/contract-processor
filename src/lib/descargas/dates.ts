const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * A FECHA value → "ddmmyyyy" for the XML. Accepts a real Excel/JS date or a
 * dd/mm/yyyy (or dd-mm-yyyy) string; anything else is returned trimmed and
 * unchanged so the preview still shows what the user typed.
 *
 * A date read from an Excel cell is a pure calendar date with no time of
 * day — exceljs (and every other reader) materializes it as midnight UTC,
 * so it must be read back with UTC getters. Local getters roll it back a
 * day for anyone west of UTC (confirmed against a real SAP export: a
 * 04/02/2026 cell came back as 03/02/2026 in America/Argentina/Buenos_Aires).
 */
export function dateValueToDDMMYYYY(raw: string | Date): string {
  if (raw instanceof Date) {
    return `${pad2(raw.getUTCDate())}${pad2(raw.getUTCMonth() + 1)}${raw.getUTCFullYear()}`;
  }
  const trimmed = raw.trim();
  const m = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return trimmed;
  const [, dd, mm, yyyyRaw] = m;
  const yyyy = yyyyRaw.length === 2 ? `20${yyyyRaw}` : yyyyRaw;
  return `${dd.padStart(2, '0')}${mm.padStart(2, '0')}${yyyy}`;
}

/**
 * The inverse of `dateValueToDDMMYYYY`, for writing a real Date cell back
 * out. Built at midnight UTC (never the local constructor) so it round-trips
 * through `dateValueToDDMMYYYY`'s UTC getters regardless of the machine's
 * timezone, on both the writing and the reading end.
 */
export function ddmmyyyyToDate(value: string): Date | null {
  const m = value.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
}

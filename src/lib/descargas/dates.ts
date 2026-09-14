const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Excel's day 0 is 1899-12-30 (its serial dates count the fake 1900-02-29). */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

function dateToDDMMYYYY(date: Date): string {
  return `${pad2(date.getUTCDate())}${pad2(date.getUTCMonth() + 1)}${date.getUTCFullYear()}`;
}

/** "ddmmyyyy" only when day and month are in range (no 31/02 check needed here). */
function buildDDMMYYYY(dd: string, mm: string, yyyyRaw: string): string | null {
  const day = Number(dd);
  const month = Number(mm);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const yyyy = yyyyRaw.length === 2 ? `20${yyyyRaw}` : yyyyRaw;
  return `${pad2(day)}${pad2(month)}${yyyy}`;
}

/**
 * A FECHA value → "ddmmyyyy" for the XML. Accepts:
 *
 * - A real Excel/JS date, or an Excel serial number (a date cell whose
 *   format the reader didn't recognize, e.g. 46267).
 * - Day-first text with "/", "-" or "." between parts, 2- or 4-digit year,
 *   optionally followed by a time: "02/09/2026", "2-9-26", "02.09.2026 10:35".
 * - ISO text, year first: "2026-09-02", "2026-09-02T10:35:00".
 * - Text already in "ddmmyyyy".
 *
 * Anything else is returned trimmed and unchanged so the preview still shows
 * what the file had.
 *
 * A date read from an Excel cell is a pure calendar date with no time of
 * day — exceljs (and every other reader) materializes it as midnight UTC,
 * so it must be read back with UTC getters. Local getters roll it back a
 * day for anyone west of UTC (confirmed against a real SAP export: a
 * 04/02/2026 cell came back as 03/02/2026 in America/Argentina/Buenos_Aires).
 */
export function dateValueToDDMMYYYY(raw: string | number | Date): string {
  if (raw instanceof Date) return dateToDDMMYYYY(raw);

  if (typeof raw === 'number') {
    // Serials between 1954 and 2173: a plain quantity isn't mistaken for a date.
    if (!Number.isFinite(raw) || raw < 20_000 || raw > 100_000) return String(raw);
    return dateToDDMMYYYY(new Date(EXCEL_EPOCH_UTC + Math.floor(raw) * MS_PER_DAY));
  }

  const trimmed = raw.trim();

  const dayFirst = trimmed.match(/^(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})(?:[ T].*)?$/);
  if (dayFirst) return buildDDMMYYYY(dayFirst[1], dayFirst[3], dayFirst[4]) ?? trimmed;

  const iso = trimmed.match(/^(\d{4})([/.-])(\d{1,2})\2(\d{1,2})(?:[ T].*)?$/);
  if (iso) return buildDDMMYYYY(iso[4], iso[3], iso[1]) ?? trimmed;

  const compact = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compact) return buildDDMMYYYY(compact[1], compact[2], compact[3]) ?? trimmed;

  return trimmed;
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

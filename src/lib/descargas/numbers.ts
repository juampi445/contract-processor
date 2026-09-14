import type { SourceCell } from './readSourceWorkbook';

/** "33.840", "1,234,567": 1-3 leading digits (not a lone 0) then groups of exactly 3. */
const GROUPED_DOTS = /^[1-9]\d{0,2}(\.\d{3})+$/;
const GROUPED_COMMAS = /^[1-9]\d{0,2}(,\d{3})+$/;

/**
 * Reads a weight however the source wrote it. Real Excel numbers pass
 * through; text is parsed with these rules, in order:
 *
 * - Units, currency and spaces are ignored ("33 840 kg", "$ 33.840").
 *   A leading "-" or surrounding parentheses mean negative.
 * - Both "." and "," present: the last one is the decimal separator
 *   ("33.840,5" and "33,840.5" are both 33840.5).
 * - Only one kind of separator, grouping the number in threes after 1-3
 *   leading digits: thousands ("33,840" and "33.840" are 33840,
 *   "1.234.567" is 1234567). Kilos rarely carry three decimals, while
 *   thousands separators are everywhere.
 * - Any other single separator is decimal ("1000,5", "33,84", "0,500").
 *
 * Returns null when there's no number to read.
 */
export function parseQuantity(raw: SourceCell | undefined): number | null {
  if (raw === null || raw === undefined || raw instanceof Date) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;

  const trimmed = raw.trim();
  const negative = /^\(.*\)$/.test(trimmed) || /^[^\d]*-/.test(trimmed);
  let text = trimmed.replace(/[^\d.,]/g, '');
  if (!/\d/.test(text)) return null;

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    text =
      lastComma > lastDot
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
  } else if (GROUPED_DOTS.test(text) || GROUPED_COMMAS.test(text)) {
    text = text.replace(/[.,]/g, '');
  } else if (lastComma !== -1) {
    // Several commas that don't group in threes can't be a number.
    if (text.indexOf(',') !== lastComma) return null;
    text = text.replace(',', '.');
  } else if (lastDot !== -1 && text.indexOf('.') !== lastDot) {
    return null;
  }

  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Plain "1234.5" string, trimming float noise like 0.1 + 0.2. */
export function formatQuantity(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

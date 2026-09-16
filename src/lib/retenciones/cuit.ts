/**
 * CUIT recognition and validation.
 *
 * mod-11 alone is NOT enough to identify a CUIT in this text: the first 11
 * digits of bunge's comprobante (`03310---09362466` -> `33100936246`) pass the
 * check digit by coincidence, and that is exactly the number the extractor used
 * to export. Recognition is therefore structural — a label, or the canonical
 * `nn-nnnnnnnn-n` spelling — and never "any 11 digits that happen to validate".
 */

const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** `true` when `digits` is 11 digits and its mod-11 check digit is correct. */
export function isValidCuit(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false;

  const sum = WEIGHTS.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  const rest = 11 - (sum % 11);
  const expected = rest === 11 ? 0 : rest === 10 ? 9 : rest;

  return expected === Number(digits[10]);
}

/**
 * The canonical spelling: two digits, hyphen, eight digits, hyphen, the check
 * digit. A single space is tolerated after each hyphen because pdf.js splits
 * the run that way ("30-70086991- 8"). Both hyphens are required — that is what
 * rejects a bare 11-digit slice of a longer number.
 */
export const CUIT_CANONICAL = /\d{2}-\s?\d{8}-\s?\d/g;

/** Every canonically-spelled, mod-11-valid CUIT in `text`, in order. */
export function findCanonicalCuits(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(CUIT_CANONICAL)) {
    const digits = m[0].replace(/\D/g, '');
    if (isValidCuit(digits) && !found.includes(digits)) found.push(digits);
  }
  return found;
}

/**
 * The first valid CUIT at the START of `run`, accepting either the canonical
 * spelling or a bare 11-digit group. Used only right after a CUIT label, where
 * a bare group is unambiguous — amaggi prints "CUIT 30711615519".
 */
export function cuitAtStart(run: string): string | null {
  const m = run.match(/^\s*(\d{2}-\s?\d{8}-\s?\d|\d{11})(?!\d)/);
  if (!m) return null;
  const digits = m[1].replace(/\D/g, '');
  return isValidCuit(digits) ? digits : null;
}

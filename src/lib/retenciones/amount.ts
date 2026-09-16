/**
 * Amount parsing for the extraction layer.
 *
 * The 8 known mill formats disagree on the separators: `aca` prints US style
 * ("451,263.08" — comma thousands, dot decimal) while the other seven print
 * es-AR style ("12.500.000,00" — dot thousands, comma decimal). Running an AR
 * string through a US-only converter corrupts it, so the separator role is
 * detected per value instead of assumed.
 */

/** An amount, in the two shapes the rest of the pipeline consumes. */
export interface Monto {
  /** Decimal number — what the XLSX cell stores (numFmt General). */
  num: number;
  /** Canonical es-AR text WITHOUT thousands separators, e.g. "451263,08". */
  esAr: string;
}

/**
 * Parse an amount in either US or es-AR notation.
 *
 * A separator counts as the decimal one only when it is the LAST separator AND
 * exactly one or two digits follow it; otherwise every separator is thousands.
 * That rule is deliberately the same one `toCents` applies at the XML boundary,
 * so a value can never land as 1.234 in the sheet and 123400 in the XML.
 *
 * Returns `null` when no digits are present rather than throwing — the caller
 * turns a miss into a field error.
 */
export function parseMonto(raw: string): Monto | null {
  const s = String(raw).trim().replace(/\s/g, '');
  if (!/\d/.test(s)) return null;

  const lastSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  const decimals = lastSep === -1 ? '' : s.slice(lastSep + 1);
  const hasDecimals = /^\d{1,2}$/.test(decimals);

  const intPart = (hasDecimals ? s.slice(0, lastSep) : s).replace(/\D/g, '');
  if (!intPart) return null;

  const num = Number(`${intPart}.${hasDecimals ? decimals.padEnd(2, '0') : '00'}`);
  if (!Number.isFinite(num)) return null;

  return { num, esAr: num.toFixed(2).replace('.', ',') };
}

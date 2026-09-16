/**
 * Field-level extractors for a normalized "CONSTANCIA DE RETENCION" text.
 *
 * Every function is pure and synchronous. Each receives the fully normalized
 * single-line string of ONE certificate (see `extractPdfPages`) and returns the
 * parsed value or `null` when the field cannot be located. Aggregation,
 * validation and error reporting are done in `parseRetencion.ts`.
 *
 * ALL patterns here are derived from the real pdf.js text layer of the eight
 * reference files — dump it with `scripts/dump-retenciones-text.mjs` before
 * touching any of them. pdf.js emits text items in geometric order, so a label
 * that sits above its value on screen can end up after it in the string
 * (chs: "86119 Número"; arca: "1.077.923,83 : Monto de la Retención"). Reading
 * the PDF on screen and writing the "obvious" pattern does not work.
 *
 * Matching runs against the diacritic-stripped text, so patterns are written
 * without accents; extracted values are digits and dates, which the stripping
 * cannot alter.
 */

import { parseMonto, type Monto } from './amount';
import { cuitAtStart, findCanonicalCuits, isValidCuit } from './cuit';
import { ISSUERS, normalizeLiqCorrelDgi } from './issuers';

/** Escape a string for safe embedding inside a `RegExp`. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strip diacritics and collapse whitespace, so one pattern covers "Retención"
 * and "Retencion", "Número" and "Numero".
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

/** A date in any of the spellings the mills print. */
const DATE = String.raw`\d{2}[./-]\d{2}[./-](?:\d{4}|\d{2})`;
const DATE_RE = new RegExp(
  String.raw`\b(\d{2})[./-](\d{2})[./-](\d{4}|\d{2})\b`,
  'g',
);

/** An amount token: digits with optional `.`/`,` separators. */
const AMOUNT = String.raw`\d[\d.,]*`;

/**
 * An amount that really is one: it ends in a 2-decimal part and nothing
 * numeric follows. The trailing lookahead is what stops "20.08.2026" (cofco's
 * detail-row date, printed right after the "Importe Retenido" column header)
 * from matching as "20.08".
 */
const DECIMAL_AMOUNT = String.raw`\d[\d.,]*[.,]\d{2}(?![\d.,]*\d)`;

/** The withholding rate, as printed ("5,00" / "5.00"). */
const RATE_TOKEN = String.raw`\b5[.,]00\s*%?`;

/** Cities the mills issue from, used as a date anchor when there is no label. */
const ISSUER_CITIES = [
  'Ciudad de Buenos Aires',
  'Buenos Aires',
  'Rosario',
  'Cordoba',
  'Tancacha',
  'Canuelas',
];

/**
 * Normalize a matched date to `dd/mm/yyyy`, or `null` when the day/month are
 * out of range — the guard is what keeps token soup like "33-01-09278898" and
 * the "14.053.947" DNI from being read as dates. A 2-digit year (chs, cañuelas
 * print "31/08/26") is expanded to `20yy`.
 */
function toFecha(dd: string, mm: string, yy: string): string | null {
  const day = Number(dd);
  const month = Number(mm);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const year = yy.length === 2 ? `20${yy}` : yy;
  return `${dd}/${mm}/${year}`;
}

/** Normalize a whole matched date token ("01.06.2026") to `dd/mm/yyyy`. */
function normalizeMatchedDate(token: string): string | null {
  const [dd, mm, yy] = token.split(/[./-]/);
  return toFecha(dd, mm, yy);
}

/** Every valid date in `text`, normalized, in order of appearance. */
function allFechas(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    const fecha = toFecha(m[1], m[2], m[3]);
    if (fecha) out.push(fecha);
  }
  return out;
}

/**
 * K — CONCEPTO_RETIVA: the "3310-NNNNNNNN" comprobante number.
 *
 * The text layer mangles the separator in every imaginable way
 * (`--3310-09051822`, `3310A09345968`, `03310---09362466`, `331009379539`,
 * `0331009430817`), so we anchor on the literal `3310` and allow up to 4
 * non-digit characters before the 8-digit body. ARCA prints the C.1116 variant
 * `33-01-09278898`, handled by the fallback.
 */
export function extractConceptoRetIva(raw: string): string | null {
  const text = normalizeForMatch(raw);
  const m =
    text.match(/3310\D{0,4}(\d{8})/) ?? text.match(/33-01\D{0,4}(\d{8})/);
  return m ? `3310-${m[1]}` : null;
}

/** Issuer locality (the one next to the issue date), e.g. "Rosario". */
export function extractIssuerLocality(raw: string): string | null {
  const m = normalizeForMatch(raw).match(
    /LOCALIDAD\s*:\s*([A-Za-z\s]+?)\s*(?:CODIGO|C\.U\.I\.T|$)/i,
  );
  if (!m) return null;
  const locality = m[1].trim();
  return locality.length ? locality : null;
}

/**
 * The date on the document detail row (the `--NNNN-NNNNNN ...` line), e.g.
 * "15.05.2026". Used only to disambiguate FECHAORIGEN — never written out.
 */
export function extractTableDate(raw: string): string | null {
  const m = normalizeForMatch(raw).match(
    new RegExp(String.raw`-{1,2}\s*\d{4}\s*-\s*\d{6,10}\s+\d+\s+(${DATE})`),
  );
  return m ? normalizeMatchedDate(m[1]) : null;
}

/**
 * D — FECHAORIGEN: the certificate's ISSUE date, never the detail-row date.
 *
 * Priority: (1) an explicit `Fecha:` label immediately followed by a date —
 * bunge and idc print it that way, while the `Fecha` column HEADER is followed
 * by words and so cannot match; (2) the issuer city followed by a date (aca
 * "Rosario 01.06.2026", amaggi "Buenos Aires 14.08.2026", cofco "Buenos Aires,
 * 25.08.2026"); (3) the last date that is not the detail-row one (arca, chs,
 * cañuelas, whose only date IS the issue date).
 */
export function extractFechaOrigen(raw: string): string | null {
  const text = normalizeForMatch(raw);

  const labelled = text.match(
    new RegExp(String.raw`Fecha\s*:?\s*(${DATE})`, 'i'),
  );
  if (labelled) {
    const fecha = normalizeMatchedDate(labelled[1]);
    if (fecha) return fecha;
  }

  const locality = extractIssuerLocality(raw);
  const cities = locality ? [locality, ...ISSUER_CITIES] : ISSUER_CITIES;
  for (const city of cities) {
    const m = text.match(
      new RegExp(String.raw`${escapeRegExp(city)}[\s,]+(${DATE})`, 'i'),
    );
    if (!m) continue;
    const fecha = normalizeMatchedDate(m[1]);
    if (fecha) return fecha;
  }

  const tableDate = extractTableDate(raw);
  const all = allFechas(text);
  const candidates = all.filter((f) => f !== tableDate);
  return (candidates.length ? candidates : all).at(-1) ?? null;
}

/** The amounts printed on the `TOTAL ...` run, in order. */
function totalLineAmounts(text: string): string[] {
  const m = text.match(
    new RegExp(String.raw`\bTOTAL\b((?:\s+${AMOUNT})+)`, 'i'),
  );
  return m ? (m[1].match(new RegExp(AMOUNT, 'g')) ?? []) : [];
}

/**
 * The (base, retenido) pair implied by the 5% rate: the only pair of amounts on
 * the page where one is exactly 5% of the other.
 *
 * This is what rescues the formats that print neither a TOTAL row nor the
 * retained amount next to the rate — chs and cañuelas interleave the columns
 * ("... 5,00 31/08/26 331009383385 Ret IVA ... 14.285.600,00 285.712.000,00"),
 * so position-based rules read a date fragment instead of the amount. The rate
 * itself is the invariant, so we use it as the anchor.
 */
function findRatePair(text: string): { base: Monto; retenido: Monto } | null {
  const amounts = (text.match(new RegExp(AMOUNT, 'g')) ?? [])
    .map(parseMonto)
    .filter((m): m is Monto => m !== null && m.num > 0);

  let best: { base: Monto; retenido: Monto } | null = null;
  for (const base of amounts) {
    const expected = base.num * 0.05;
    for (const retenido of amounts) {
      if (retenido === base) continue;
      if (Math.abs(retenido.num - expected) / expected > 1e-4) continue;
      if (!best || base.num > best.base.num) best = { base, retenido };
    }
  }
  return best;
}

/**
 * F — IMPSINIVA: the amount actually withheld.
 *
 * In priority order: (1) an explicit label before the amount (amaggi); (2) an
 * explicit label AFTER it — arca's SICORE form prints "$ 1.077.923,83 : Monto
 * de la Retención"; (3) the last amount on the `TOTAL` run (aca, bunge, idc);
 * (4) the 5%-rate pair (chs, cañuelas, cofco); (5) the amount that follows the
 * rate, required to carry decimals so a date can never be read as an amount.
 */
export function extractImpSinIva(raw: string): Monto | null {
  const text = normalizeForMatch(raw);
  const LABEL = String.raw`(?:Importe\s+total\s+Retenido|Monto\s+de\s+la\s+Retencion|Importe\s+Retenido)`;

  // Both label rules demand a real 2-decimal amount: in cofco "Importe
  // Retenido" is a column HEADER followed by the row's date, and an amount
  // pattern loose enough to accept "20.08.2026" reads it as 20082026.
  const forward = text.match(
    new RegExp(String.raw`${LABEL}\s*:?\s*\$?\s*(${DECIMAL_AMOUNT})`, 'i'),
  );
  if (forward) return parseMonto(forward[1]);

  const backward = text.match(
    new RegExp(String.raw`(${DECIMAL_AMOUNT})\s*:?\s*${LABEL}`, 'i'),
  );
  if (backward) return parseMonto(backward[1]);

  const totals = totalLineAmounts(text);
  if (totals.length) return parseMonto(totals[totals.length - 1]);

  const pair = findRatePair(text);
  if (pair) return pair.retenido;

  const afterRate = text.match(
    new RegExp(String.raw`${RATE_TOKEN}\s+(${DECIMAL_AMOUNT})`, 'i'),
  );
  return afterRate ? parseMonto(afterRate[1]) : null;
}

/**
 * The taxable base, used only for the 5%-coherence warning: the amount before
 * the withheld one on the `TOTAL` run, else an explicit label, else the base of
 * the rate pair.
 */
export function extractBaseImponible(raw: string): Monto | null {
  const text = normalizeForMatch(raw);

  const totals = totalLineAmounts(text);
  if (totals.length >= 2) return parseMonto(totals[totals.length - 2]);

  const labelled = text.match(
    new RegExp(
      String.raw`(?:Base\s+Imponible|Base\s+de\s+calculo|Base\s+retencion)\s*:?\s*\$?\s*(${AMOUNT})`,
      'i',
    ),
  );
  if (labelled) return parseMonto(labelled[1]);

  return findRatePair(text)?.base ?? null;
}

/**
 * Digit strings a CUIT candidate must not be part of: the comprobante number
 * and any long bare digit run (internal document numbers). This is the guard
 * that stopped bunge exporting `33100936246`, the first 11 digits of
 * `3310-09362466`, which passes mod-11 by coincidence.
 */
function forbiddenRuns(text: string): string[] {
  const runs: string[] = [];
  const concepto = extractConceptoRetIva(text);
  if (concepto) runs.push(concepto.replace(/\D/g, ''));
  for (const m of text.matchAll(/\d{12,}/g)) runs.push(m[0]);
  return runs;
}

/** `true` when `cuit` is merely a slice of a longer, unrelated number. */
function overlapsAnotherNumber(cuit: string, forbidden: string[]): boolean {
  return forbidden.some((run) => run.includes(cuit));
}

/**
 * I — CUITCORREDOR: the withholding AGENT's CUIT.
 *
 * In priority order: (1) next to an "agente de retención" label — idc must use
 * this one, since the first CUIT in its text belongs to the proveedor; (2) next
 * to a "C.U.I.T." label, accepting the bare 11-digit spelling amaggi prints;
 * (3) the first canonically-spelled CUIT in the document (arca, cofco), which
 * is the issuer's because it sits in the letterhead.
 *
 * Candidates that fail mod-11, or that are a slice of the comprobante or of
 * another long number, are discarded at every step.
 */
export function extractCuitCorredor(raw: string): string | null {
  const text = normalizeForMatch(raw);
  const forbidden = forbiddenRuns(text);
  const accept = (cuit: string | null): string | null =>
    cuit && !overlapsAnotherNumber(cuit, forbidden) ? cuit : null;

  for (const m of text.matchAll(
    /(?:NRO\.?\s*|N[°ºo]\s*)?AGENTE\s*(?:DE\s*)?RETENCION\s*:?\s*(.{0,20})/gi,
  )) {
    const cuit = accept(cuitAtStart(m[1]));
    if (cuit) return cuit;
  }

  for (const m of text.matchAll(
    /C\.?U\.?I\.?T\.?\s*(?:N[°ºo]\s*)?:?\s*(.{0,20})/gi,
  )) {
    const cuit = accept(cuitAtStart(m[1]));
    if (cuit) return cuit;
  }

  for (const cuit of findCanonicalCuits(text)) {
    const accepted = accept(cuit);
    if (accepted) return accepted;
  }

  return null;
}

/**
 * A — CONTRATO: only bunge prints one ("Número de contrato: 1000562291").
 * Empty string when absent — cofco has a "Nro Contrato" column HEADER whose
 * value is alphanumeric, and it must not be picked up.
 */
export function extractContrato(raw: string): string {
  const m = normalizeForMatch(raw).match(
    /(?:Numero\s+de\s+contrato|Nro\.?\s*Contrato|N[°ºo]\s*Contrato)\s*:?\s*(\d[\d-]*)/i,
  );
  return m ? m[1].replace(/\D/g, '') : '';
}

/**
 * C — LIQCORRELDGI: the certificate number, as TEXT (leading zeros matter).
 *
 * Looks up the issuer's patterns by agent CUIT first, then falls back to the
 * generic labels. The raw match keeps its block separators, because the
 * normalization to BIT's value is block-aware and per issuer — see
 * `normalizeLiqCorrelDgi`. A candidate that ends in the comprobante's 8 digits
 * is rejected and the next pattern tried: the certificate is never the
 * comprobante. Returns `null` when nothing matches, so the row is flagged for
 * manual review rather than exported with a wrong identifier.
 */
export function extractLiqCorrelDgi(
  raw: string,
  cuitCorredor?: string | null,
  conceptoRetIva?: string | null,
): string | null {
  const text = normalizeForMatch(raw);
  const conceptoBody = conceptoRetIva?.replace(/\D/g, '').slice(-8) ?? null;
  const issuer = cuitCorredor ? ISSUERS[cuitCorredor] : undefined;

  const patterns: readonly RegExp[] = [
    ...(issuer?.patterns ?? []),
    /CONSTANCIA\s*DE\s*RETENCION\s*(?:N[°ºo]?\s*)?(\d[\d\s/-]*?)(?=\s|$)/i,
    /(?:Numero|Nro\.?|N[°ºo])\s*(?:de\s*)?(?:certificado|constancia|comprobante)\s*:?\s*(\d[\d\s/-]*?)(?=\s|$)/i,
    /Certificado\s*(?:Numero|Nro\.?|N[°ºo])?\s*:?\s*(\d[\d\s/-]*?)(?=\s|$)/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const value = normalizeLiqCorrelDgi(m[1], issuer?.normalization);
    if (!value.length) continue;
    if (conceptoBody && value.endsWith(conceptoBody)) continue;
    return value;
  }

  return null;
}

/** Re-exported so callers can validate a CUIT without importing `cuit.ts`. */
export { isValidCuit };

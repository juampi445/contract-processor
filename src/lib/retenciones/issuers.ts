/**
 * Per-issuer rules for LIQCORRELDGI (C), the most format-dependent field.
 *
 * Two things vary per mill and neither is derivable from the PDF:
 *
 *  1. WHERE the number is. Every mill labels it differently and few put the
 *     label next to the value, so the lookup is keyed by the withholding
 *     agent's CUIT. Every pattern was derived from the REAL pdf.js text layer
 *     (`scripts/dump-retenciones-text.mjs`), not from how the PDF looks on
 *     screen: pdf.js emits items in geometric order, which regularly puts the
 *     value before its label (chs, arca) or strands the label in another block
 *     of the page (arca).
 *
 *  2. HOW it is normalized. The value BIT expects is a destination-side rule,
 *     not a property of the certificate: arca's `0000-2026-125081` must drop
 *     the empty `0000-` point-of-sale block and become `2026125081`, while
 *     bunge's `0020-01500121` keeps everything and becomes `002001500121`.
 *     That is NOT "strip leading zeros" — doing that to bunge yields
 *     `2001500121`, which is wrong.
 *
 * The value is TEXT throughout the pipeline: leading zeros are part of the
 * identifier. Patterns match against the diacritic-stripped text, so they are
 * written without accents.
 */

/** How a mill's raw, block-separated number becomes the value BIT stores. */
export type LiqNormalization =
  /** Concatenate every block, keeping leading zeros (aca, bunge). */
  | 'concat'
  /** Drop a leading all-zeros block, then concatenate (arca). */
  | 'drop-empty-block'
  /** Decide per value — see `normalizeLiqCorrelDgi`. */
  | 'heuristic';

/**
 * How much we trust the normalization.
 *
 * `confirmed` — the resulting value was approved against BIT. It is pinned:
 * the heuristic never gets to second-guess an approved datum.
 * `assumed` — the heuristic's answer, PROVISIONAL until a real import to BIT
 * confirms it. These mills may well have arca's twist (an empty leading block)
 * and we would not know from the certificate alone.
 */
export type IssuerConfidence = 'confirmed' | 'assumed';

export interface IssuerSpec {
  name: string;
  /** Where to find the certificate number, tried in order. */
  patterns: readonly RegExp[];
  normalization: LiqNormalization;
  confidence: IssuerConfidence;
}

export const ISSUERS: Record<string, IssuerSpec> = {
  // aca — "CONSTANCIA DE RETENCION 2000/00490345" -> 200000490345
  '30500120882': {
    name: 'ACA',
    patterns: [/CONSTANCIA\s*DE\s*RETENCION\s*([\d\s/]+?)(?=\s|$)/i],
    normalization: 'concat',
    confidence: 'confirmed',
  },

  // amaggi — "N° de Certificado: 0003-00117798"
  '30711615519': {
    name: 'Amaggi',
    patterns: [/N[°ºo]?\s*de\s*Certificado\s*:?\s*([\d-]+)/i],
    normalization: 'heuristic',
    confidence: 'assumed',
  },

  // arca (SI.CO.RE.) — the label "Certificado N°" sits in the header block and
  // the value in the data block, with a date and two CUITs in between, so the
  // only reliable anchor is the nnnn-yyyy-nnnnnn shape itself.
  // "0000-2026-125081" -> 2026125081: the point of sale is empty and dropped.
  '30511534492': {
    name: 'ARCA',
    patterns: [/\b(\d{4}-\d{4}-\d{6})\b/],
    normalization: 'drop-empty-block',
    confidence: 'confirmed',
  },

  // bunge — "Nº de certificado: 0020-01500121" -> 002001500121, point of sale
  // INCLUDED. This is the case that rules out "strip leading zeros".
  '30700869918': {
    name: 'Bunge',
    patterns: [/N[°ºo]?\s*de\s*certificado\s*:?\s*([\d-]+)/i],
    normalization: 'concat',
    confidence: 'confirmed',
  },

  // chs — "CERTIFICADO DE RETENCION DE IVA 86119 Número": the short correlative
  // PRECEDES its label. Deliberately not the long "00001-2026-016603 Nº lega",
  // to stay consistent with cañuelas / idc.
  '30711160163': {
    name: 'CHS',
    patterns: [/(\d{4,})\s+Numero\b/i],
    normalization: 'heuristic',
    confidence: 'assumed',
  },

  // cofco — "N° 1001-00405442" in the letterhead, with no "certificado" word.
  '33506737449': {
    name: 'COFCO',
    patterns: [/N[°ºo]\s*(\d{3,4}-\d{6,10})\b/],
    normalization: 'heuristic',
    confidence: 'assumed',
  },

  // idc / LDC — "Nro. 6-0117947-023714" (not "Nro. Cuenta interno: 77538").
  // Three blocks, but the first is a real "6", so nothing is dropped.
  '30526712729': {
    name: 'LDC / IDC',
    patterns: [/Nro\.?\s*(\d-\d{7}-\d{6})\b/i],
    normalization: 'heuristic',
    confidence: 'assumed',
  },

  // molino cañuelas — "Número 654274", one per page.
  '30507950848': {
    name: 'Molino Cañuelas',
    patterns: [/Numero\s+(\d{4,})\b/i],
    normalization: 'heuristic',
    confidence: 'assumed',
  },
};

/**
 * Normalize a raw certificate number to the value BIT stores.
 *
 * The heuristic: a number printed as THREE blocks whose first block is all
 * zeros is a point-of-sale-less SICORE number, and that block is dropped;
 * anything else is concatenated as-is, keeping leading zeros.
 *
 * Confidence note, deliberately recorded here: the "concatenate" branch rests
 * on two real cases (aca, bunge), the "drop the empty block" branch on exactly
 * ONE (arca). For a mill we have not seen, trust the second branch little and
 * lean on the safety net instead — a flagged row beats a wrong identifier.
 */
export function normalizeLiqCorrelDgi(
  raw: string,
  mode: LiqNormalization = 'heuristic',
): string {
  const blocks = raw.split(/[^\d]+/).filter((b) => b.length > 0);
  if (blocks.length === 0) return '';

  const dropLeadingZeros =
    mode === 'drop-empty-block' ||
    (mode === 'heuristic' && blocks.length === 3 && /^0+$/.test(blocks[0]));

  const kept = dropLeadingZeros ? blocks.slice(1) : blocks;
  return (kept.length ? kept : blocks).join('');
}

/** Human label for an issuer CUIT, used only in messages. */
export const ISSUER_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(ISSUERS).map(([cuit, spec]) => [cuit, spec.name]),
);

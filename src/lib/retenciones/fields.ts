/**
 * Field-level extractors for a normalized "CONSTANCIA DE RETENCION" text.
 *
 * Every function is pure and synchronous. Each receives the fully normalized
 * single-line string (see `extractPdfText`) and returns the parsed value or
 * `null` when the field cannot be located. Aggregation / error reporting is
 * done in `parseRetencion.ts`.
 */

/** Escape a string for safe embedding inside a `RegExp`. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert a US-style amount ("1,234,567.89") to es-AR text ("1234567,89").
 * Purely textual: no rounding, no Number parsing.
 */
export function formatUsToEsAr(us: string): string {
  return us.replace(/,/g, '').replace('.', ',');
}

/** C — LIQCORRELDGI: digits of the "CONSTANCIA DE RETENCION <n>/<n>" token. */
export function extractLiqCorrelDgi(text: string): string | null {
  const m = text.match(/CONSTANCIA\s*DE\s*RETENCI[OÓ]N\s*([\d\s/]+?)(?=\s|$)/i);
  if (!m) return null;
  const digits = m[1].replace(/\D/g, '');
  return digits.length ? digits : null;
}

/** Issuer locality (the one next to the issue date), e.g. "Rosario". */
export function extractIssuerLocality(text: string): string | null {
  const m = text.match(
    /LOCALIDAD\s*:\s*([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+?)\s*(?:CODIGO|C\.U\.I\.T|$)/i,
  );
  if (!m) return null;
  const locality = m[1].trim();
  return locality.length ? locality : null;
}

/**
 * The date on the document detail row (the `--NNNN-NNNNNN ...` line), e.g.
 * "15.05.2026". Used only to disambiguate FECHAORIGEN — never written out.
 */
export function extractTableDate(text: string): string | null {
  const m = text.match(
    /-{1,2}\s*\d{4}\s*-\s*\d{6,10}\s+\d+\s+(\d{2}\.\d{2}\.\d{4})/,
  );
  return m ? m[1] : null;
}

/**
 * D — FECHAORIGEN: the issue date next to the issuer city, as dd/mm/yyyy.
 * Primary anchor is the issuer locality; falls back to the last dd.mm.yyyy
 * that is not the document-table date.
 */
export function extractFechaOrigen(text: string): string | null {
  const locality = extractIssuerLocality(text);
  if (locality) {
    const re = new RegExp(
      `${escapeRegExp(locality)}\\s+(\\d{2})\\.(\\d{2})\\.(\\d{4})`,
      'i',
    );
    const m = text.match(re);
    if (m) return `${m[1]}/${m[2]}/${m[3]}`;
  }

  // Fallback: last dd.mm.yyyy that isn't the document-detail-row date.
  const tableDate = extractTableDate(text);
  const all = [...text.matchAll(/(\d{2})\.(\d{2})\.(\d{4})/g)];
  const candidates = all.filter((m) => m[0] !== tableDate);
  const pick = (candidates.length ? candidates : all).at(-1);
  return pick ? `${pick[1]}/${pick[2]}/${pick[3]}` : null;
}

/**
 * F — IMPSINIVA: the "Monto retenido" amount from the TOTAL line, in es-AR
 * text. Falls back to the last amount on the document detail row.
 */
export function extractImpSinIva(text: string): string | null {
  const total = text.match(/TOTAL\s+([\d.,]+)\s+([\d.,]+)/i);
  if (total) return formatUsToEsAr(total[2]);

  const doc = text.match(
    /-{1,2}\s*\d{4}\s*-\s*\d{6,10}\s+\d+\s+\d{2}\.\d{2}\.\d{4}\s+([\d.,]+)\s+([\d.,]+)/,
  );
  if (doc) return formatUsToEsAr(doc[2]);

  return null;
}

/**
 * I — CUITCORREDOR: the withholding agent's CUIT (11 digits). Anchors on the
 * "NRO. AGENTE RETENCION" line; falls back to the first "C.U.I.T." match.
 */
export function extractCuitCorredor(text: string): string | null {
  let m = text.match(
    /NRO\.?\s*AGENTE\s*RETENCI[OÓ]N\s*:?\s*([\d\-\s]+?)(?=\s*C\.U\.I\.T|$)/i,
  );
  if (!m) m = text.match(/C\.U\.I\.T\.?\s*:?\s*([\d\-\s]+)/i);
  if (!m) return null;

  const digits = m[1].replace(/\D/g, '');
  return digits.length === 11 ? digits : null;
}

/** K — CONCEPTO_RETIVA: the "NNNN-NNNNNNNN" token on the `--` detail row. */
export function extractConceptoRetIva(text: string): string | null {
  const m = text.match(/-{1,2}\s*(\d{4}\s*-\s*\d{6,10})/);
  if (!m) return null;
  return m[1].replace(/\s+/g, '');
}

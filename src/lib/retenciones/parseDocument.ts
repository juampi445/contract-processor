import { extractConceptoRetIva } from './fields';
import { parseRetencion } from './parseRetencion';
import type { ParseResult } from './types';

/** One certificate found in a PDF, with the page it came from. */
export interface ParsedCertificate {
  /** 1-indexed page, or `null` when the whole document was parsed as one. */
  page: number | null;
  result: ParseResult;
}

/** `true` when a page carries a 3310 comprobante, i.e. it is a certificate. */
function hasCertificate(pageText: string): boolean {
  return extractConceptoRetIva(pageText) !== null;
}

/** Normalize the way `extractPdfText` does: one line, single spaces. */
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Parse a whole PDF, given the text layer of each page.
 *
 * One page = one certificate: molinocañuelas prints several certificates in a
 * single file, and parsing per page is what keeps their amounts and numbers
 * from bleeding into each other. Pages without a 3310 comprobante (covers,
 * continuation sheets) are skipped.
 *
 * Two safety nets:
 *  - a document whose pages carry no comprobante at all, or whose single
 *    certificate page fails to parse, is retried as one joined text — that is
 *    the legacy behaviour, for layouts split across pages;
 *  - duplicates are dropped by `(CONCEPTO_RETIVA, LIQCORRELDGI)`, because
 *    idc/LDC repeats its detail row inside the same document.
 */
export function parseRetencionPages(pages: string[]): ParsedCertificate[] {
  const joined = normalize(pages.join(' '));
  const certificatePages = pages
    .map((text, i) => ({ page: i + 1, text: normalize(text) }))
    .filter((p) => hasCertificate(p.text));

  if (certificatePages.length === 0) {
    return [{ page: null, result: parseRetencion(joined) }];
  }

  const parsed = certificatePages.map(({ page, text }) => ({
    page,
    result: parseRetencion(text),
  }));

  // A lone certificate that failed per-page may have had its TOTAL row on
  // another page; the joined text is the fallback that used to always be used.
  if (parsed.length === 1 && !parsed[0].result.ok) {
    const retry = parseRetencion(joined);
    if (retry.ok) return [{ page: null, result: retry }];
  }

  return dedupe(parsed);
}

/** Drop repeated certificates, keeping the first occurrence. */
function dedupe(certificates: ParsedCertificate[]): ParsedCertificate[] {
  const seen = new Set<string>();
  return certificates.filter((c) => {
    if (!c.result.ok) return true; // failures are always shown, never merged
    const key = `${c.result.row.conceptoRetIva}|${c.result.row.liqCorrelDgi}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

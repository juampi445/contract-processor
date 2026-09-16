import {
  extractBaseImponible,
  extractConceptoRetIva,
  extractContrato,
  extractCuitCorredor,
  extractFechaOrigen,
  extractImpSinIva,
  extractLiqCorrelDgi,
} from './fields';
import { isValidCuit } from './cuit';
import { ISSUER_NAMES } from './issuers';
import type { ParseError, ParseResult, RetencionRow } from './types';

/** Minimum text length below which we treat the PDF as having no text layer. */
const MIN_TEXT_LENGTH = 50;

/** The withholding rate is 5% on every format we know. */
const RATE = 0.05;

/** How far retención/base may drift from the rate before we flag the row. */
const RATE_TOLERANCE = 0.02;

/**
 * Parse a normalized "CONSTANCIA DE RETENCION" string into a `RetencionRow`.
 * Pure and synchronous. Returns either the row or the list of field errors.
 *
 * A missing or implausible field is always reported — never silently written
 * with a wrong value. Errors block the row; warnings let it through but mark it
 * for manual review in the preview.
 */
export function parseRetencion(text: string): ParseResult {
  if (text.trim().length < MIN_TEXT_LENGTH) {
    return {
      ok: false,
      errors: [
        {
          field: 'text',
          message: 'PDF sin capa de texto (no soportado, requiere OCR)',
        },
      ],
    };
  }

  const errors: ParseError[] = [];
  const warnings: string[] = [];

  const conceptoRetIva = extractConceptoRetIva(text);
  if (!conceptoRetIva) {
    errors.push({
      field: 'conceptoRetIva',
      message: 'No se encontró CONCEPTO_RETIVA (comprobante 3310)',
    });
  }

  const cuitCorredor = extractCuitCorredor(text);
  if (!cuitCorredor) {
    errors.push({
      field: 'cuitCorredor',
      message: 'No se encontró CUITCORREDOR válido (11 dígitos, módulo 11)',
    });
  } else if (!isValidCuit(cuitCorredor)) {
    errors.push({
      field: 'cuitCorredor',
      message: `CUITCORREDOR no pasa el dígito verificador: ${cuitCorredor}`,
    });
  }

  // The certificate number is looked up per issuer, so it needs the CUIT first;
  // the comprobante is passed in so it can never be mistaken for the number.
  const liqCorrelDgi = extractLiqCorrelDgi(text, cuitCorredor, conceptoRetIva);
  if (!liqCorrelDgi) {
    const issuer = cuitCorredor ? (ISSUER_NAMES[cuitCorredor] ?? null) : null;
    errors.push({
      field: 'liqCorrelDgi',
      message: issuer
        ? `No se encontró LIQCORRELDGI (Nº de certificado) de ${issuer}`
        : 'No se encontró LIQCORRELDGI (Nº de certificado) — formato no reconocido',
    });
  }

  const fechaOrigen = extractFechaOrigen(text);
  if (!fechaOrigen) {
    errors.push({
      field: 'fechaOrigen',
      message: 'No se encontró FECHAORIGEN (fecha de emisión)',
    });
  }

  const impSinIva = extractImpSinIva(text);
  if (!impSinIva) {
    errors.push({
      field: 'impSinIva',
      message: 'No se encontró IMPSINIVA (monto retenido / TOTAL)',
    });
  } else if (impSinIva.num <= 0) {
    errors.push({
      field: 'impSinIva',
      message: `IMPSINIVA debe ser mayor a cero: ${impSinIva.esAr}`,
    });
  }

  if (
    errors.length > 0 ||
    liqCorrelDgi === null ||
    fechaOrigen === null ||
    impSinIva === null ||
    cuitCorredor === null ||
    conceptoRetIva === null
  ) {
    return { ok: false, errors };
  }

  // Coherence: the retained amount must be ~5% of the base. When it isn't,
  // one of the two amounts was read from the wrong column — the row is exported
  // but flagged, because we cannot tell which one is wrong.
  const base = extractBaseImponible(text);
  if (base && base.num > 0) {
    const expected = base.num * RATE;
    const drift = Math.abs(impSinIva.num - expected) / expected;
    if (drift > RATE_TOLERANCE) {
      warnings.push(
        `Revisar: el retenido (${impSinIva.esAr}) no es el 5% de la base (${base.esAr})`,
      );
    }
  }

  if (cuitCorredor && !ISSUER_NAMES[cuitCorredor]) {
    warnings.push(
      `Revisar: emisor no conocido (CUIT ${cuitCorredor}), campos leídos con reglas genéricas`,
    );
  }

  const row: RetencionRow = {
    contrato: extractContrato(text),
    ordenInter: '',
    liqCorrelDgi,
    fechaOrigen,
    fechaVto: fechaOrigen, // E === D
    impSinIva: impSinIva.esAr,
    impTotal: impSinIva.esAr, // G === F
    nroRegOlcu: 1,
    cuitCorredor,
    observacion: null,
    conceptoRetIva,
  };

  return { ok: true, row, warnings };
}

import {
  extractConceptoRetIva,
  extractCuitCorredor,
  extractFechaOrigen,
  extractImpSinIva,
  extractLiqCorrelDgi,
} from './fields';
import type { ParseError, ParseResult, RetencionRow } from './types';

/** Minimum text length below which we treat the PDF as having no text layer. */
const MIN_TEXT_LENGTH = 50;

/**
 * Parse a normalized "CONSTANCIA DE RETENCION" string into a `RetencionRow`.
 * Pure and synchronous. Returns either the row or the list of field errors.
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

  const liqCorrelDgi = extractLiqCorrelDgi(text);
  if (!liqCorrelDgi) {
    errors.push({
      field: 'liqCorrelDgi',
      message: 'No se encontró LIQCORRELDGI (Nº de constancia)',
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
  }

  const cuitCorredor = extractCuitCorredor(text);
  if (!cuitCorredor) {
    errors.push({
      field: 'cuitCorredor',
      message: 'No se encontró CUITCORREDOR válido (11 dígitos)',
    });
  }

  const conceptoRetIva = extractConceptoRetIva(text);
  if (!conceptoRetIva) {
    errors.push({
      field: 'conceptoRetIva',
      message: 'No se encontró CONCEPTO_RETIVA',
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

  const row: RetencionRow = {
    contrato: null,
    ordenInter: null,
    liqCorrelDgi,
    fechaOrigen,
    fechaVto: fechaOrigen, // E === D
    impSinIva,
    impTotal: impSinIva, // G === F
    nroRegOlcu: 1,
    cuitCorredor,
    observacion: null,
    conceptoRetIva,
  };

  return { ok: true, row };
}

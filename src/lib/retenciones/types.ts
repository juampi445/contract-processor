/**
 * One appended row of the target sheet "Hoja1" (columns A–K).
 * CONTRATO/ORDENINTER aren't on the PDF, so parsing starts them at `''`;
 * the preview table lets the user fill them in before exporting. The
 * remaining empty columns are `null` on purpose so the writer can leave the
 * cell genuinely empty (not an empty string) while keeping column alignment.
 */
export interface RetencionRow {
  contrato: string; // A - CONTRATO (filled in the preview, or later by hand)
  ordenInter: string; // B - ORDENINTER (filled in the preview, or later by hand)
  liqCorrelDgi: string; // C - LIQCORRELDGI  e.g. '200000490345'
  fechaOrigen: string; // D - FECHAORIGEN   e.g. '01/06/2026'
  fechaVto: string; // E - FECHAVTO      same as D
  impSinIva: string; // F - IMPSINIVA     e.g. '451263,08'
  impTotal: string; // G - IMPTOTAL      same as F
  nroRegOlcu: number; // H - NROREGOLCU    literal 1
  cuitCorredor: string; // I - CUITCORREDOR  e.g. '30500120882'
  observacion: null; // J - OBSERVACION   (empty)
  conceptoRetIva: string; // K - CONCEPTO_RETIVA e.g. '3310-09051822'
}

/** A single field-level extraction failure. */
export interface ParseError {
  field: keyof RetencionRow | 'text';
  message: string;
}

/**
 * Result of parsing a normalized PDF string. Either a fully-populated row,
 * or the list of field errors that prevented it.
 */
export type ParseResult =
  | { ok: true; row: RetencionRow; warnings: string[] }
  | { ok: false; errors: ParseError[] };

/**
 * One certificate's outcome, surfaced in the UI. A single PDF can yield more
 * than one of these: molinocañuelas prints one certificate per page.
 *
 * `warnings` are non-blocking: the row is exportable but something did not add
 * up (the 5% coherence check, an unknown issuer), so the UI marks it for manual
 * review instead of dropping it.
 */
export interface FileResult {
  id: string;
  fileName: string;
  /** 1-indexed page this certificate came from, when the PDF had several. */
  page?: number;
  status: 'ok' | 'error';
  row?: RetencionRow;
  errors?: ParseError[];
  warnings?: string[];
}

/**
 * One appended row of the target sheet "Hoja1" (columns A–K).
 * Empty columns are `null` on purpose so the writer can leave the cell
 * genuinely empty (not an empty string) while keeping column alignment.
 */
export interface RetencionRow {
  contrato: null; // A - CONTRATO (empty)
  ordenInter: null; // B - ORDENINTER (empty)
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
  | { ok: true; row: RetencionRow }
  | { ok: false; errors: ParseError[] };

/** Per-file outcome surfaced in the UI. */
export interface FileResult {
  id: string;
  fileName: string;
  status: 'ok' | 'error';
  row?: RetencionRow;
  errors?: ParseError[];
}

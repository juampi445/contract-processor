export type DescargaFieldType = 'text' | 'num' | 'date' | 'blank';

/**
 * One `<TAG>value</TAG>` in the generated XML, in output order. `source`
 * points at the Excel column a value is read from when it differs from
 * `tag` (only the two date fields, which both derive from FECHA); `type`
 * picks the default used when that column is missing or empty.
 */
export interface DescargaField {
  tag: string;
  type: DescargaFieldType;
  source?: string;
  fixedDefault?: string;
}

/** One data row of the uploaded Excel, keyed by column header verbatim. */
export type DescargaRow = Record<string, string>;

export interface DescargaReadResult {
  rows: DescargaRow[];
  headers: string[];
  /** Columns every row needs that aren't in the file at all. */
  missingRequired: string[];
  /** Columns in the file that don't map to any known XML tag. */
  unknownColumns: string[];
  /** Known, non-required columns absent from the file (fall back to defaults). */
  missingOptional: string[];
  /** Set when the whole file is unusable; rows/headers stay empty. */
  fatal: string | null;
}

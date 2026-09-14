/**
 * The 15 columns of the "base" descargas spreadsheet (`public/templates/
 * base_descargas.xlsx`), in file order.
 */
export const BASE_COLUMNS = [
  'CTG',
  'CPORTE',
  'FECHA',
  'CODGRANO',
  'COMPRADOR',
  'CORREDOR',
  'PESOBRUT',
  'PESOEGRE',
  'TOTBRUT',
  'TOTMERM',
  'TOTNETO',
  'PORHUME',
  'PMERMAHUME',
  'KGSHUME',
  'OBS',
] as const;

export type BaseColumn = (typeof BASE_COLUMNS)[number];

/**
 * The fields the user maps to a column name in the *source* Excel — every
 * other format calls these something different, and a company can rename
 * one at any time, so instead of guessing from a fixed alias list we ask
 * once, per upload, which header holds each of these.
 */
export const MAPPABLE_COLUMNS = [
  'CTG',
  'CPORTE',
  'FECHA',
  'TOTNETO',
  'PORHUME',
] as const;

export type MappableColumn = (typeof MAPPABLE_COLUMNS)[number];

/**
 * Which of the mappable columns get an "obligatorio" toggle in the UI.
 * Humidity is never one of them — it's always best-effort.
 */
export const TOGGLEABLE_COLUMNS: readonly MappableColumn[] = [
  'CTG',
  'CPORTE',
  'FECHA',
  'TOTNETO',
];

/** Starting toggle state: all four required, matching the old fixed behavior. */
export const DEFAULT_REQUIRED_FLAGS: Record<MappableColumn, boolean> = {
  CTG: true,
  CPORTE: true,
  FECHA: true,
  TOTNETO: true,
  PORHUME: false,
};

/** Sensible starting point: works with zero typing for a file that already
 * uses these exact names; humidity starts blank since it's often absent. */
export const DEFAULT_COLUMN_NAMES: Record<MappableColumn, string> = {
  CTG: 'CTG',
  CPORTE: 'CPORTE',
  FECHA: 'FECHA',
  TOTNETO: 'TOTNETO',
  PORHUME: '',
};

/** The base columns that aren't currently required — everything else falls
 * back to a manual per-batch value when the source file doesn't have it. */
export function optionalBaseColumns(
  requiredFields: readonly MappableColumn[],
): BaseColumn[] {
  return BASE_COLUMNS.filter(
    (c) => !requiredFields.includes(c as MappableColumn),
  );
}

/** Lowercase, accent-stripped, punctuation/whitespace-stripped comparison key. */
export function normalizeHeader(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

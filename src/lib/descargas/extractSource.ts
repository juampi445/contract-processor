import { dateValueToDDMMYYYY } from './dates';
import type { SourceCell, SourceMatrix } from './readSourceWorkbook';
import {
  BASE_COLUMNS,
  MAPPABLE_COLUMNS,
  normalizeHeader,
  type BaseColumn,
  type MappableColumn,
} from './sourceFields';
import type { DescargaRow } from './types';

/** How many leading rows we'll scan looking for the header row — covers
 * report-style exports where the real header isn't row 1, or has blank
 * rows / a report title above it (see the SAP-style "transferencias" format,
 * whose header is row 2). */
const HEADER_SCAN_ROWS = 30;

export interface SourceExtractResult {
  /** One entry per accepted data row, holding only the mapped columns. */
  rows: Array<Partial<Record<BaseColumn, string>>>;
  detectedFields: Set<BaseColumn>;
  /** Required column names that were declared but not found in the file. */
  missingRequired: MappableColumn[];
  /** Rows with some data that were dropped for lacking a required value. */
  skippedRows: number;
  fatal: string | null;
}

function normalizeFieldValue(field: BaseColumn, raw: SourceCell): string {
  if (raw === null || raw === undefined) return '';
  if (field === 'FECHA') return dateValueToDDMMYYYY(raw as string | Date);
  if (field === 'TOTNETO') {
    const n = Number(raw);
    return Number.isFinite(n) ? String(Math.abs(n)) : String(raw).trim();
  }
  if (raw instanceof Date) return dateValueToDDMMYYYY(raw);
  return String(raw).trim();
}

const isBlank = (v: SourceCell): boolean =>
  v === null || v === undefined || String(v).trim() === '';

/**
 * Find the header row — by matching cell text against the column names the
 * user declared for this upload, not a fixed alias list — and pull out
 * every row after it that has a value for each *currently required* field
 * (`requiredFields`, driven by the toggles in the UI — a field the user
 * marked optional never disqualifies a row, even when its value is blank).
 * Scanning several leading rows (rather than assuming row 1) is what lets
 * this work when there are blank rows or report chrome above the header.
 */
export function extractSourceRows(
  matrix: SourceMatrix,
  columnNames: Partial<Record<MappableColumn, string>>,
  requiredFields: readonly MappableColumn[],
): SourceExtractResult {
  const wanted = MAPPABLE_COLUMNS.map((field) => ({
    field,
    key: normalizeHeader(columnNames[field]?.trim() ?? ''),
  })).filter((w) => w.key !== '');

  const missingConfig = requiredFields.filter((f) => !columnNames[f]?.trim());
  if (missingConfig.length > 0) {
    return {
      rows: [],
      detectedFields: new Set(),
      missingRequired: missingConfig,
      skippedRows: 0,
      fatal: `Indicá el nombre de columna para: ${missingConfig.join(', ')}.`,
    };
  }

  let headerRow = -1;
  let columnMap = new Map<number, MappableColumn>();
  let bestScore = -1;

  for (let r = 0; r < Math.min(HEADER_SCAN_ROWS, matrix.length); r += 1) {
    const candidate = new Map<number, MappableColumn>();
    const matched = new Set<MappableColumn>();
    matrix[r]?.forEach((cell, c) => {
      if (typeof cell !== 'string') return;
      const key = normalizeHeader(cell);
      const match = wanted.find((w) => w.key === key);
      if (match && !matched.has(match.field)) {
        candidate.set(c, match.field);
        matched.add(match.field);
      }
    });
    if (candidate.size > bestScore) {
      bestScore = candidate.size;
      headerRow = r;
      columnMap = candidate;
    }
  }

  const detectedFields = new Set<BaseColumn>(columnMap.values());
  const missingRequired = requiredFields.filter((f) => !detectedFields.has(f));

  if (headerRow === -1 || missingRequired.length > 0) {
    return {
      rows: [],
      detectedFields,
      missingRequired,
      skippedRows: 0,
      fatal: `No encontramos en este archivo la${missingRequired.length === 1 ? '' : 's'} columna${missingRequired.length === 1 ? '' : 's'}: ${missingRequired
        .map((f) => `"${columnNames[f]}"`)
        .join(', ')}.`,
    };
  }

  const requiredColumns = requiredFields.map(
    (f) => [...columnMap.entries()].find(([, field]) => field === f)![0],
  );

  const rows: Array<Partial<Record<BaseColumn, string>>> = [];
  let skippedRows = 0;

  for (let r = headerRow + 1; r < matrix.length; r += 1) {
    const row = matrix[r];
    if (!row) continue;
    if (!row.some((v) => !isBlank(v))) continue; // blank separator row

    const hasAllRequired = requiredColumns.every((col) => !isBlank(row[col]));
    if (!hasAllRequired) {
      skippedRows += 1;
      continue;
    }

    const record: Partial<Record<BaseColumn, string>> = {};
    columnMap.forEach((field, col) => {
      record[field] = normalizeFieldValue(field, row[col] ?? null);
    });
    rows.push(record);
  }

  return { rows, detectedFields, missingRequired: [], skippedRows, fatal: null };
}

/**
 * Combine auto-detected per-row values with the manual, per-batch inputs
 * that cover every column the source file didn't have — into the same
 * `DescargaRow` shape the XML builder and the base-workbook writer expect.
 */
export function mergeWithManualValues(
  extracted: Array<Partial<Record<BaseColumn, string>>>,
  detectedFields: Set<BaseColumn>,
  manualValues: Partial<Record<BaseColumn, string>>,
): DescargaRow[] {
  // PESOBRUT = TOTBRUT + TOTNETO whenever both are known and PESOBRUT itself
  // isn't coming straight from the source file — only ever a derived
  // default, never overriding real extracted PESOBRUT data.
  const pesobrutIsDerivable = !detectedFields.has('PESOBRUT');

  return extracted.map((extractedRow) => {
    const row: DescargaRow = {};
    for (const column of BASE_COLUMNS) {
      row[column] = detectedFields.has(column)
        ? (extractedRow[column] ?? '')
        : (manualValues[column] ?? '');
    }

    if (pesobrutIsDerivable) {
      const totbrut = Number(row.TOTBRUT);
      const totneto = Number(row.TOTNETO);
      if (
        row.TOTBRUT !== '' &&
        Number.isFinite(totbrut) &&
        Number.isFinite(totneto)
      ) {
        row.PESOBRUT = String(totbrut + totneto);
      }
    }

    return row;
  });
}

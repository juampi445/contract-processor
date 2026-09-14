import ExcelJS from 'exceljs';
import { dateValueToDDMMYYYY } from './dates';
import { FIELDS, REQUIRED_COLUMNS } from './fields';
import type { DescargaReadResult, DescargaRow } from './types';

const KNOWN_TAGS = new Set(FIELDS.map((f) => f.tag));
/** Known columns that aren't required and do have their own Excel column
 * (skips FECING/FECSAL, sourced from FECHA, and HORING/HORSAL, always blank). */
const OPTIONAL_TAGS = FIELDS.filter(
  (f) => f.type !== 'date' && f.type !== 'blank',
).map((f) => f.tag);

/** Read a cell as a string, or as a Date when Excel stored it as a date. */
function readCell(cell: ExcelJS.Cell): string | Date {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') return cell.text ?? ''; // rich text / formula
  return String(v).trim();
}

const asString = (v: string | Date): string =>
  v instanceof Date ? v.toISOString() : v;

/**
 * Read an uploaded "descargas" Excel into rows keyed by column header —
 * unlike retenciones' fixed-position sheet, these columns are named exactly
 * like the XML tags, so we map by header instead of by index. Fully empty
 * rows are skipped silently.
 */
export async function readDescargasXlsx(
  file: File,
): Promise<DescargaReadResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];

  if (!ws) {
    return {
      rows: [],
      headers: [],
      missingRequired: [],
      unknownColumns: [],
      missingOptional: [],
      fatal: 'El archivo no tiene ninguna hoja',
    };
  }

  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
    const text = asString(readCell(cell)).trim();
    if (text) headers.push(text);
  });

  if (headers.length === 0) {
    return {
      rows: [],
      headers: [],
      missingRequired: [],
      unknownColumns: [],
      missingOptional: [],
      fatal: 'No se encontraron columnas en la primera fila',
    };
  }

  const rows: DescargaRow[] = [];
  for (let rowNo = 2; rowNo <= ws.rowCount; rowNo += 1) {
    const row = ws.getRow(rowNo);
    const record: DescargaRow = {};
    let hasValue = false;

    headers.forEach((header, i) => {
      const cellValue = readCell(row.getCell(i + 1));
      const value =
        header === 'FECHA'
          ? dateValueToDDMMYYYY(cellValue)
          : asString(cellValue);
      if (value !== '') hasValue = true;
      record[header] = value;
    });

    if (hasValue) rows.push(record);
  }

  return {
    rows,
    headers,
    missingRequired: REQUIRED_COLUMNS.filter((c) => !headers.includes(c)),
    unknownColumns: headers.filter(
      (h) => !KNOWN_TAGS.has(h) && h !== 'FECHA',
    ),
    missingOptional: OPTIONAL_TAGS.filter((t) => !headers.includes(t)),
    fatal: null,
  };
}

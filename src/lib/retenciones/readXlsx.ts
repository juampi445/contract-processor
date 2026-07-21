import ExcelJS from 'exceljs';
import type { RetencionXmlInput } from './buildXml';
import { normalizeFecha, toCents } from './toXmlValues';

const SHEET_NAME = 'Hoja1';

// Position-based mapping (1-indexed columns), not by header name.
const COL = {
  liqCorrelDgi: 3, // C
  fecha: 4, // D
  importe: 6, // F
  cuitCorredor: 9, // I
  concepto: 11, // K
} as const;

// Expected header text per mapped column, used only to reject foreign files.
const EXPECTED_HEADERS: ReadonlyArray<[number, string]> = [
  [COL.liqCorrelDgi, 'LIQCORRELDGI'],
  [COL.fecha, 'FECHAORIGEN'],
  [COL.importe, 'IMPSINIVA'],
  [COL.cuitCorredor, 'CUITCORREDOR'],
  [COL.concepto, 'CONCEPTO_RETIVA'],
];

const FIELD_LABEL: Record<keyof typeof COL, string> = {
  liqCorrelDgi: 'LIQCORRELDGI',
  fecha: 'FECHAORIGEN',
  importe: 'IMPSINIVA',
  cuitCorredor: 'CUITCORREDOR',
  concepto: 'CONCEPTO_RETIVA',
};

export interface XlsxRowError {
  /** 1-indexed Excel row number. */
  row: number;
  message: string;
}

export interface XlsxReadResult {
  rows: RetencionXmlInput[];
  errors: XlsxRowError[];
  /** Set when the whole file is unusable (wrong format); rows/errors empty. */
  fatal: string | null;
}

/** Read a cell as a string, or as a Date when Excel stored it as a date. */
function readCell(cell: ExcelJS.Cell): string | Date {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') return cell.text ?? ''; // rich text / formula
  return String(v).trim();
}

const asString = (v: string | Date): string =>
  v instanceof Date ? v.toISOString() : v.trim();

/**
 * Read an XLSX previously produced by this tool (possibly hand-edited) and
 * return the rows ready for `buildXml`, plus per-row errors keyed by Excel row
 * number. Fully empty rows are skipped silently (the template ships ~1000
 * formatted-but-empty rows).
 */
export async function readXlsx(file: File): Promise<XlsxReadResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets[0];

  if (!ws) {
    return { rows: [], errors: [], fatal: 'El archivo no tiene el formato esperado' };
  }

  const headerRow = ws.getRow(1);
  const headersOk = EXPECTED_HEADERS.every(
    ([col, expected]) =>
      asString(readCell(headerRow.getCell(col))).toUpperCase() ===
      expected.toUpperCase(),
  );
  if (!headersOk) {
    return { rows: [], errors: [], fatal: 'El archivo no tiene el formato esperado' };
  }

  const rows: RetencionXmlInput[] = [];
  const errors: XlsxRowError[] = [];

  for (let rowNo = 2; rowNo <= ws.rowCount; rowNo += 1) {
    const row = ws.getRow(rowNo);

    const rawLiq = asString(readCell(row.getCell(COL.liqCorrelDgi)));
    const rawFechaCell = readCell(row.getCell(COL.fecha));
    const rawFecha = asString(rawFechaCell);
    const rawImporte = asString(readCell(row.getCell(COL.importe)));
    const rawCuit = asString(readCell(row.getCell(COL.cuitCorredor)));
    const rawConcepto = asString(readCell(row.getCell(COL.concepto)));

    const present = {
      liqCorrelDgi: rawLiq.length > 0,
      fecha: rawFecha.length > 0,
      importe: rawImporte.length > 0,
      cuitCorredor: rawCuit.length > 0,
      concepto: rawConcepto.length > 0,
    };
    const presentCount = Object.values(present).filter(Boolean).length;

    if (presentCount === 0) continue; // fully empty row → skip silently

    if (presentCount < 5) {
      const missing = (Object.keys(present) as (keyof typeof COL)[])
        .filter((k) => !present[k])
        .map((k) => FIELD_LABEL[k]);
      errors.push({
        row: rowNo,
        message: `Fila incompleta — faltan: ${missing.join(', ')}`,
      });
      continue;
    }

    const cuitDigits = rawCuit.replace(/\D/g, '');
    if (cuitDigits.length !== 11) {
      errors.push({
        row: rowNo,
        message: `CUITCORREDOR inválido (se esperaban 11 dígitos): ${rawCuit}`,
      });
      continue;
    }

    let fecha: string;
    try {
      fecha = normalizeFecha(rawFechaCell);
    } catch {
      errors.push({
        row: rowNo,
        message: `FECHAORIGEN inválida (dd/mm/yyyy): ${rawFecha}`,
      });
      continue;
    }

    try {
      toCents(rawImporte); // validate; buildXml re-runs the same conversion
    } catch {
      errors.push({
        row: rowNo,
        message: `IMPSINIVA inválido: ${rawImporte}`,
      });
      continue;
    }

    rows.push({
      liqCorrelDgi: rawLiq,
      fecha,
      importe: rawImporte,
      cuitCorredor: cuitDigits,
      concepto: rawConcepto,
    });
  }

  return { rows, errors, fatal: null };
}

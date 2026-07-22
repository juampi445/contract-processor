import ExcelJS from 'exceljs';
import type { RetencionXmlInput } from './buildXml';
import { normalizeFecha, toCents } from './toXmlValues';

const SHEET_NAME = 'Hoja1';

// Position-based mapping (1-indexed columns), not by header name.
const COL = {
  contrato: 1, // A — filled in by hand
  ordenInter: 2, // B — filled in by hand
  liqCorrelDgi: 3, // C
  fecha: 4, // D
  importe: 6, // F
  cuitCorredor: 9, // I
  concepto: 11, // K
} as const;

// Expected header text per mapped column, used only to reject foreign files.
const EXPECTED_HEADERS: ReadonlyArray<[number, string]> = [
  [COL.contrato, 'CONTRATO'],
  [COL.ordenInter, 'ORDENINTER'],
  [COL.liqCorrelDgi, 'LIQCORRELDGI'],
  [COL.fecha, 'FECHAORIGEN'],
  [COL.importe, 'IMPSINIVA'],
  [COL.cuitCorredor, 'CUITCORREDOR'],
  [COL.concepto, 'CONCEPTO_RETIVA'],
];

const FIELD_LABEL: Record<keyof typeof COL, string> = {
  contrato: 'CONTRATO',
  ordenInter: 'ORDENINTER',
  liqCorrelDgi: 'LIQCORRELDGI',
  fecha: 'FECHAORIGEN',
  importe: 'IMPSINIVA',
  cuitCorredor: 'CUITCORREDOR',
  concepto: 'CONCEPTO_RETIVA',
};

// Number of mapped data fields; a row with all of them present is complete.
const FIELD_COUNT = Object.keys(COL).length;

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
 * Read an integer ID cell (CONTRATO / ORDENINTER) as a plain string. Excel
 * stores these as numbers; `String()` on the numeric value is fine in this
 * range, but if it ever surfaces as scientific notation ("1.22608e+9") the
 * read went wrong — fall back to the cell's displayed text.
 */
function readIdCell(cell: ExcelJS.Cell): string {
  const s = asString(readCell(cell));
  if (/[eE]/.test(s)) return (cell.text ?? '').trim();
  return s;
}

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

    const rawContrato = readIdCell(row.getCell(COL.contrato));
    const rawOrdenInter = readIdCell(row.getCell(COL.ordenInter));
    const rawLiq = asString(readCell(row.getCell(COL.liqCorrelDgi)));
    const rawFechaCell = readCell(row.getCell(COL.fecha));
    const rawFecha = asString(rawFechaCell);
    const rawImporte = asString(readCell(row.getCell(COL.importe)));
    const rawCuit = asString(readCell(row.getCell(COL.cuitCorredor)));
    const rawConcepto = asString(readCell(row.getCell(COL.concepto)));

    const present = {
      contrato: rawContrato.length > 0,
      ordenInter: rawOrdenInter.length > 0,
      liqCorrelDgi: rawLiq.length > 0,
      fecha: rawFecha.length > 0,
      importe: rawImporte.length > 0,
      cuitCorredor: rawCuit.length > 0,
      concepto: rawConcepto.length > 0,
    };
    const presentCount = Object.values(present).filter(Boolean).length;

    if (presentCount === 0) continue; // fully empty row → skip silently

    if (presentCount < FIELD_COUNT) {
      const missing = (Object.keys(present) as (keyof typeof COL)[])
        .filter((k) => !present[k])
        .map((k) => FIELD_LABEL[k]);
      // A/B don't come from the PDFs, so an incomplete row is most often those
      // two — spell out that they're the ones the user fills in by hand.
      const handHint =
        !present.contrato || !present.ordenInter
          ? ' (CONTRATO y ORDENINTER se completan a mano, una por fila)'
          : '';
      errors.push({
        row: rowNo,
        message: `Fila incompleta — faltan: ${missing.join(', ')}${handHint}`,
      });
      continue;
    }

    const contratoDigits = rawContrato.replace(/\D/g, '');
    if (contratoDigits.length === 0) {
      errors.push({
        row: rowNo,
        message: `CONTRATO inválido (solo dígitos): ${rawContrato}`,
      });
      continue;
    }

    const ordenInterDigits = rawOrdenInter.replace(/\D/g, '');
    if (ordenInterDigits.length === 0) {
      errors.push({
        row: rowNo,
        message: `ORDENINTER inválido (solo dígitos): ${rawOrdenInter}`,
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
      contrato: contratoDigits,
      ordenInter: ordenInterDigits,
      liqCorrelDgi: rawLiq,
      fecha,
      importe: rawImporte,
      cuitCorredor: cuitDigits,
      concepto: rawConcepto,
    });
  }

  return { rows, errors, fatal: null };
}

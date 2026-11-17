import ExcelJS from 'exceljs';
import type { RetencionXmlInput } from './buildXml';
import { validarXmlInput } from './requeridos';
import { normalizeFecha } from './toXmlValues';

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

export interface XlsxRowError {
  /** 1-indexed Excel row number. */
  row: number;
  message: string;
}

export interface XlsxReadResult {
  rows: RetencionXmlInput[];
  /** Excel row number of each entry of `rows`, to name it in messages. */
  rowNumbers: number[];
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
    return { rows: [], rowNumbers: [], errors: [], fatal: 'El archivo no tiene el formato esperado' };
  }

  const headerRow = ws.getRow(1);
  const headersOk = EXPECTED_HEADERS.every(
    ([col, expected]) =>
      asString(readCell(headerRow.getCell(col))).toUpperCase() ===
      expected.toUpperCase(),
  );
  if (!headersOk) {
    return { rows: [], rowNumbers: [], errors: [], fatal: 'El archivo no tiene el formato esperado' };
  }

  const rows: RetencionXmlInput[] = [];
  const rowNumbers: number[] = [];
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

    // A row missing any of the PDF-derived columns (C, D, F, I, K) is not a
    // certificate we can do anything with. A and B (CONTRATO / ORDENINTER)
    // are different: they are filled in by hand, so a row without them is
    // READ, and it is the XML step that blocks it — with the message of which
    // one is missing — through `CAMPOS_REQUERIDOS_XML`. That keeps this reader
    // and the PDF preview on the same rule.
    const missingData = (Object.keys(present) as (keyof typeof COL)[])
      .filter((k) => k !== 'contrato' && k !== 'ordenInter' && !present[k])
      .map((k) => FIELD_LABEL[k]);
    if (missingData.length > 0) {
      errors.push({
        row: rowNo,
        message: `Fila incompleta — faltan: ${missingData.join(', ')}`,
      });
      continue;
    }

    // The hand-typed IDs are digits: strip separators Excel may have added
    // ("126.080.440"), but reject text that has no digits at all.
    const contratoDigits = rawContrato.replace(/\D/g, '');
    if (rawContrato.length > 0 && contratoDigits.length === 0) {
      errors.push({ row: rowNo, message: `CONTRATO inválido (solo dígitos): ${rawContrato}` });
      continue;
    }
    const ordenInterDigits = rawOrdenInter.replace(/\D/g, '');
    if (rawOrdenInter.length > 0 && ordenInterDigits.length === 0) {
      errors.push({ row: rowNo, message: `ORDENINTER inválido (solo dígitos): ${rawOrdenInter}` });
      continue;
    }

    const cuitDigits = rawCuit.replace(/\D/g, '');
    let fecha: string | Date = rawFechaCell;
    try {
      fecha = normalizeFecha(rawFechaCell);
    } catch {
      // Reported below by validarXmlInput, with the same wording as the PDF flow.
    }

    const input: RetencionXmlInput = {
      contrato: contratoDigits,
      ordenInter: ordenInterDigits,
      liqCorrelDgi: rawLiq,
      fecha,
      importe: rawImporte,
      cuitCorredor: cuitDigits,
      concepto: rawConcepto,
    };

    // Same validations the parser applies to a PDF (CUIT mod-11, comprobante
    // 3310, date, amount), so a hand-edited spreadsheet cannot slip a value
    // past them. Missing A/B are deliberately NOT errors here (see above).
    const invalid = validarXmlInput(input).filter((e) => !e.startsWith('Falta '));
    if (invalid.length > 0) {
      errors.push({ row: rowNo, message: invalid.join(' · ') });
      continue;
    }

    rows.push(input);
    rowNumbers.push(rowNo);
  }

  return { rows, rowNumbers, errors, fatal: null };
}

import ExcelJS from 'exceljs';
import { toCents } from './toXmlValues';
import type { RetencionRow } from './types';

const TEMPLATE_URL = '/templates/base.xlsx';
const SHEET_NAME = 'Hoja1';
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Build a local `Date` from a `dd/mm/yyyy` string using the local constructor,
 * never `new Date(iso)` / `Date.parse` — an ISO string is read as UTC and in a
 * negative timezone the stored day rolls back one. The three components come
 * straight from the already-extracted string.
 */
function toLocalDate(fecha: string): Date {
  const [dd, mm, yyyy] = fecha.split('/').map(Number);
  return new Date(yyyy, mm - 1, dd);
}

/**
 * es-AR amount string ("451263,08") → the decimal `Number` Excel stores in the
 * cell (451263.08). We route through `toCents` so the parsing rules are the
 * single canonical ones; the cent→decimal division is display-only and never
 * feeds the XML, which keeps its own string arithmetic.
 */
function toAmountNumber(importe: string): number {
  return Number(toCents(importe)) / 100;
}

/**
 * Write one typed row per `RetencionRow`, starting at row 2 (row 1 is the
 * header). Cells are written with the correct types + explicit number formats
 * to match the destination system's reference template:
 *
 *   A CONTRATO      — left empty (filled by hand)
 *   B ORDENINTER    — left empty (filled by hand)
 *   C LIQCORRELDGI  number,   numFmt '0'
 *   D FECHAORIGEN   Date,     numFmt 'dd/mm/yyyy'
 *   E FECHAVTO      formula =D{n}, numFmt 'dd/mm/yyyy'
 *   F IMPSINIVA     number,   numFmt 'General'
 *   G IMPTOTAL      formula =F{n}, numFmt 'General'
 *   H NROREGOLCU    number
 *   I CUITCORREDOR  number
 *   J OBSERVACION   — left empty
 *   K CONCEPTO_RETIVA string (must stay text: "3310-08773775" as a number is a
 *     subtraction)
 *
 * The explicit `numFmt` is deliberate: the original template used built-in
 * format 14, which renders per the machine's locale. An explicit mask looks
 * identical everywhere; the stored serial is the same either way.
 */
export function applyRows(ws: ExcelJS.Worksheet, rows: RetencionRow[]): void {
  rows.forEach((r, i) => {
    const rowNo = 2 + i;
    const row = ws.getRow(rowNo);

    const c = row.getCell(3); // C — number
    c.value = Number(r.liqCorrelDgi);
    c.numFmt = '0';

    const d = row.getCell(4); // D — Date
    d.value = toLocalDate(r.fechaOrigen);
    d.numFmt = 'dd/mm/yyyy';

    const e = row.getCell(5); // E — formula mirroring D
    e.value = { formula: `D${rowNo}` };
    e.numFmt = 'dd/mm/yyyy';

    const f = row.getCell(6); // F — number
    f.value = toAmountNumber(r.impSinIva);
    f.numFmt = 'General';

    const g = row.getCell(7); // G — formula mirroring F
    g.value = { formula: `F${rowNo}` };
    g.numFmt = 'General';

    row.getCell(8).value = r.nroRegOlcu; // H — number
    row.getCell(9).value = Number(r.cuitCorredor); // I — number
    row.getCell(11).value = r.conceptoRetIva; // K — string
    // A, B and J stay genuinely empty — never touched.

    row.commit();
  });
}

/**
 * Load `base.xlsx`, append one typed row per `RetencionRow` starting at row 2
 * (row 1 is the existing header), and return the resulting workbook as a Blob.
 * The template's formatting is preserved — we only set cell values and formats.
 */
export async function buildWorkbook(rows: RetencionRow[]): Promise<Blob> {
  const templateBuffer = await fetch(TEMPLATE_URL).then((r) => {
    if (!r.ok) {
      throw new Error(`No se pudo cargar la plantilla (${r.status})`);
    }
    return r.arrayBuffer();
  });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);

  const ws = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets[0];
  if (!ws) {
    throw new Error('La plantilla no contiene ninguna hoja');
  }

  applyRows(ws, rows);

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: XLSX_MIME });
}

/** Build a timestamped filename: `retenciones_yyyyMMdd_HHmm.<ext>`. */
export function retencionesFileName(ext = 'xlsx', date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `retenciones_${stamp}.${ext}`;
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

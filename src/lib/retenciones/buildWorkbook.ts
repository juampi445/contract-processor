import ExcelJS from 'exceljs';
import type { RetencionRow } from './types';

const TEMPLATE_URL = '/templates/base.xlsx';
const SHEET_NAME = 'Hoja1';
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Columns written as text. The template stamps number formats on some of these
// (e.g. `0` on C); forcing `@` (text) stops Excel from reinterpreting long
// numeric IDs, leading zeros or comma decimals. D/E are included defensively
// because dates are intentionally written as strings, never as JS Dates.
const TEXT_COLUMNS = [3, 4, 5, 6, 7, 9, 11] as const;

/**
 * Load `base.xlsx`, append one row per `RetencionRow` starting at row 2 (row 1
 * is the existing header), and return the resulting workbook as a Blob. The
 * template's formatting is preserved — we only set cell values and text format.
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

  rows.forEach((r, i) => {
    const row = ws.getRow(2 + i);

    row.getCell(3).value = r.liqCorrelDgi; // C
    row.getCell(4).value = r.fechaOrigen; // D
    row.getCell(5).value = r.fechaVto; // E
    row.getCell(6).value = r.impSinIva; // F
    row.getCell(7).value = r.impTotal; // G
    row.getCell(8).value = r.nroRegOlcu; // H (number)
    row.getCell(9).value = r.cuitCorredor; // I
    row.getCell(11).value = r.conceptoRetIva; // K
    // A, B and J stay genuinely empty — never touched.

    for (const col of TEXT_COLUMNS) {
      row.getCell(col).numFmt = '@';
    }

    row.commit();
  });

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

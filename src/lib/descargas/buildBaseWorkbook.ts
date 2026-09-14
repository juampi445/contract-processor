import ExcelJS from 'exceljs';
import { downloadBlob } from '@/lib/downloadBlob';
import { ddmmyyyyToDate } from './dates';
import { BASE_COLUMNS, type BaseColumn } from './sourceFields';
import type { DescargaRow } from './types';

export { downloadBlob };

const TEMPLATE_URL = '/templates/base_descargas.xlsx';
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const NUMERIC_COLUMNS = new Set<BaseColumn>([
  'CTG',
  'CPORTE',
  'CODGRANO',
  'PESOBRUT',
  'PESOEGRE',
  'TOTBRUT',
  'TOTMERM',
  'TOTNETO',
  'PORHUME',
  'PMERMAHUME',
  'KGSHUME',
]);

/**
 * Load `base_descargas.xlsx`, append one row per `DescargaRow` starting at
 * row 2 (row 1 is the header), and return the resulting workbook as a Blob.
 */
export async function buildBaseWorkbook(rows: DescargaRow[]): Promise<Blob> {
  const templateBuffer = await fetch(TEMPLATE_URL).then((r) => {
    if (!r.ok) {
      throw new Error(`No se pudo cargar la plantilla (${r.status})`);
    }
    return r.arrayBuffer();
  });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);

  const ws = wb.worksheets[0];
  if (!ws) {
    throw new Error('La plantilla no contiene ninguna hoja');
  }

  rows.forEach((r, i) => {
    const rowNo = 2 + i;
    const row = ws.getRow(rowNo);

    BASE_COLUMNS.forEach((column, index) => {
      const value = r[column] ?? '';
      if (value === '') return;
      const cell = row.getCell(index + 1);

      if (column === 'FECHA') {
        const date = ddmmyyyyToDate(value);
        if (date) {
          cell.value = date;
          cell.numFmt = 'dd/mm/yyyy';
        } else {
          cell.value = value;
        }
        return;
      }

      if (NUMERIC_COLUMNS.has(column)) {
        const n = Number(value);
        cell.value = Number.isFinite(n) ? n : value;
        return;
      }

      cell.value = value;
    });

    row.commit();
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: XLSX_MIME });
}

/** Build a timestamped filename: `descargas_base_yyyy-MM-dd_HHmm.xlsx`. */
export function baseDescargasFileName(date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `descargas_base_${stamp}.xlsx`;
}

import ExcelJS from 'exceljs';
import { read as readLegacyBook, utils as legacyUtils } from 'xlsx';

export type SourceCell = string | number | Date | null;
/** Row-major, 0-indexed: `matrix[0]` is spreadsheet row 1. */
export type SourceMatrix = SourceCell[][];

/** `.xls` is OLE2/CFBF — a completely different container than `.xlsx`'s zip. */
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

async function isLegacyXls(file: File): Promise<boolean> {
  if (/\.xlsx$|\.xlsm$/i.test(file.name)) return false;
  if (/\.xls$/i.test(file.name)) return true;
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return OLE2_MAGIC.every((byte, i) => head[i] === byte);
}

/** Unwrap exceljs's formula ({result}) and rich-text cell shapes to a plain value. */
function unwrapCellValue(value: unknown): SourceCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('result' in value) {
      return unwrapCellValue((value as { result: unknown }).result);
    }
    if ('richText' in value) {
      return (value as { richText: { text: string }[] }).richText
        .map((t) => t.text)
        .join('');
    }
    if ('text' in value) return String((value as { text: unknown }).text).trim();
    return null;
  }
  if (typeof value === 'number') return value;
  return String(value).trim();
}

/** Read the first worksheet of a modern `.xlsx`/`.xlsm` file into a raw matrix. */
async function readModernWorkbook(file: File): Promise<SourceMatrix> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const matrix: SourceMatrix = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells: SourceCell[] = [];
    for (let c = 1; c <= ws.columnCount; c += 1) {
      cells.push(unwrapCellValue(row.getCell(c).value));
    }
    matrix.push(cells);
  });
  return matrix;
}

/** Read the first worksheet of a legacy `.xls` (BIFF/OLE2) file into a raw matrix. */
async function readLegacyWorkbook(file: File): Promise<SourceMatrix> {
  const wb = readLegacyBook(await file.arrayBuffer(), {
    type: 'array',
    cellDates: true,
  });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return legacyUtils.sheet_to_json<SourceCell[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
  });
}

/**
 * Read the first worksheet of an uploaded descargas source file — `.xlsx`/
 * `.xlsm` via exceljs, legacy `.xls` via SheetJS (exceljs can't parse the
 * OLE2 binary format at all) — into one raw cell matrix so the extractor
 * doesn't need to care which library produced it.
 */
export async function readSourceWorkbook(file: File): Promise<SourceMatrix> {
  return (await isLegacyXls(file))
    ? readLegacyWorkbook(file)
    : readModernWorkbook(file);
}

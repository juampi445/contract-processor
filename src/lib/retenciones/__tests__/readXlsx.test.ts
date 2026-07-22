import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { readXlsx } from '../readXlsx';

const HEADERS: Record<number, string> = {
  1: 'CONTRATO',
  2: 'ORDENINTER',
  3: 'LIQCORRELDGI',
  4: 'FECHAORIGEN',
  6: 'IMPSINIVA',
  9: 'CUITCORREDOR',
  11: 'CONCEPTO_RETIVA',
};

const FULL_ROW: Record<number, string | number> = {
  1: 126080440,
  2: 62997621,
  3: 200000490345,
  4: '01/06/2026',
  6: '451263,08',
  9: 30500120882,
  11: '3310-09051822',
};

/** Build an in-memory XLSX File with the given data row (col → value). */
async function makeFile(data: Record<number, string | number>): Promise<File> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Hoja1');

  const header = ws.getRow(1);
  for (const [col, text] of Object.entries(HEADERS)) {
    header.getCell(Number(col)).value = text;
  }
  header.commit();

  const row = ws.getRow(2);
  for (const [col, value] of Object.entries(data)) {
    row.getCell(Number(col)).value = value;
  }
  row.commit();

  const buffer = await wb.xlsx.writeBuffer();
  return new File([buffer], 'test.xlsx');
}

describe('readXlsx — CONTRATO / ORDENINTER', () => {
  it('reads A and B as digit-only strings on a complete row', async () => {
    const res = await readXlsx(await makeFile(FULL_ROW));
    expect(res.fatal).toBeNull();
    expect(res.errors).toHaveLength(0);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].contrato).toBe('126080440');
    expect(res.rows[0].ordenInter).toBe('62997621');
  });

  it('reports a row missing A, naming the row and the field', async () => {
    const { 1: _omitContrato, ...withoutA } = FULL_ROW;
    const res = await readXlsx(await makeFile(withoutA));
    expect(res.rows).toHaveLength(0);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].row).toBe(2);
    expect(res.errors[0].message).toContain('CONTRATO');
  });
});

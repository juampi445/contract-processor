import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { applyRows } from '../buildWorkbook';
import type { RetencionRow } from '../types';

const baseRow: RetencionRow = {
  contrato: null,
  ordenInter: null,
  liqCorrelDgi: '200000490345',
  fechaOrigen: '01/06/2026',
  fechaVto: '01/06/2026',
  impSinIva: '451263,08',
  impTotal: '451263,08',
  nroRegOlcu: 1,
  cuitCorredor: '30500120882',
  observacion: null,
  conceptoRetIva: '3310-09051822',
};

function sheetWithRow(row: RetencionRow = baseRow): ExcelJS.Worksheet {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Hoja1');
  applyRows(ws, [row]);
  return ws;
}

describe('applyRows — cell types', () => {
  it('writes each column with the correct type', () => {
    const r = sheetWithRow().getRow(2);
    expect(typeof r.getCell(3).value).toBe('number'); // C LIQCORRELDGI
    expect(r.getCell(4).value).toBeInstanceOf(Date); // D FECHAORIGEN
    expect(r.getCell(5).value).toMatchObject({ formula: 'D2' }); // E FECHAVTO
    expect(typeof r.getCell(6).value).toBe('number'); // F IMPSINIVA
    expect(r.getCell(7).value).toMatchObject({ formula: 'F2' }); // G IMPTOTAL
    expect(typeof r.getCell(8).value).toBe('number'); // H NROREGOLCU
    expect(typeof r.getCell(9).value).toBe('number'); // I CUITCORREDOR
    expect(typeof r.getCell(11).value).toBe('string'); // K CONCEPTO_RETIVA
  });

  it('leaves A, B and J genuinely empty', () => {
    const r = sheetWithRow().getRow(2);
    expect(r.getCell(1).value).toBeNull(); // A
    expect(r.getCell(2).value).toBeNull(); // B
    expect(r.getCell(10).value).toBeNull(); // J
  });

  it('stores the amount as a decimal, not cents', () => {
    expect(sheetWithRow().getRow(2).getCell(6).value).toBe(451263.08);
  });

  it('keeps CONCEPTO as text so Excel never reads it as a subtraction', () => {
    expect(sheetWithRow().getRow(2).getCell(11).value).toBe('3310-09051822');
  });

  it('applies explicit number formats', () => {
    const r = sheetWithRow().getRow(2);
    expect(r.getCell(3).numFmt).toBe('0');
    expect(r.getCell(4).numFmt).toBe('dd/mm/yyyy');
    expect(r.getCell(5).numFmt).toBe('dd/mm/yyyy');
    expect(r.getCell(6).numFmt).toBe('General');
    expect(r.getCell(7).numFmt).toBe('General');
  });
});

describe('applyRows — local date', () => {
  it('builds 01/06/2026 with the local constructor (no TZ day-shift)', () => {
    const d = sheetWithRow().getRow(2).getCell(4).value as Date;
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(5); // June, 0-indexed
    expect(d.getFullYear()).toBe(2026);
  });
});

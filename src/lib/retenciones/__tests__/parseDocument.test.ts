import { describe, expect, it } from 'vitest';
import { parseRetencionPages } from '../parseDocument';

/** A minimal certificate page, parameterized by the bits that vary. */
function page(opts: {
  concepto: string;
  liq: string;
  fecha: string;
  base: string;
  retenido: string;
}): string {
  return [
    'CONSTANCIA DE RETENCION',
    opts.liq,
    'NRO. AGENTE RETENCION: 30-50012088-2',
    'Fecha:',
    opts.fecha,
    `--${opts.concepto} 3300402844`,
    'TOTAL',
    opts.base,
    opts.retenido,
  ].join(' ');
}

const CANUELAS_1 = page({
  concepto: '3310-09383385',
  liq: '654274',
  fecha: '31/08/2026',
  base: '285.712.000,00',
  retenido: '14.285.600,00',
});

const CANUELAS_2 = page({
  concepto: '3310-09396127',
  liq: '654275',
  fecha: '31/08/2026',
  base: '20.832.000,00',
  retenido: '1.041.600,00',
});

describe('parseRetencionPages — one certificate per page', () => {
  it('emits one row per page for a multi-certificate PDF', () => {
    const certificates = parseRetencionPages([CANUELAS_1, CANUELAS_2]);
    expect(certificates).toHaveLength(2);

    const rows = certificates.map((c) => {
      if (!c.result.ok) throw new Error('expected ok');
      return c.result.row;
    });
    expect(rows.map((r) => r.liqCorrelDgi)).toEqual(['654274', '654275']);
    expect(rows.map((r) => r.conceptoRetIva)).toEqual([
      '3310-09383385',
      '3310-09396127',
    ]);
    expect(rows.map((r) => r.impSinIva)).toEqual([
      '14285600,00',
      '1041600,00',
    ]);
    expect(certificates.map((c) => c.page)).toEqual([1, 2]);
  });

  it('keeps the amounts of one page from bleeding into the next', () => {
    const [first] = parseRetencionPages([CANUELAS_1, CANUELAS_2]);
    if (!first.result.ok) throw new Error('expected ok');
    expect(first.result.row.impSinIva).toBe('14285600,00');
  });

  it('deduplicates a detail row repeated inside the same document', () => {
    const certificates = parseRetencionPages([CANUELAS_1, CANUELAS_1]);
    expect(certificates).toHaveLength(1);
  });

  it('skips pages with no comprobante (covers, continuation sheets)', () => {
    const cover = 'Hoja de cortesia sin ningun comprobante de retencion aqui.';
    const certificates = parseRetencionPages([cover, CANUELAS_1]);
    expect(certificates).toHaveLength(1);
    expect(certificates[0].page).toBe(2);
  });

  it('falls back to the joined text when one certificate spans two pages', () => {
    const head = [
      'CONSTANCIA DE RETENCION 2000/00490345',
      'NRO. AGENTE RETENCION: 30-50012088-2',
      'Fecha: 01/06/2026',
      '--3310-09051822 3300402844',
    ].join(' ');
    const tail = 'TOTAL 9.025.261,56 451.263,08';

    const certificates = parseRetencionPages([head, tail]);
    expect(certificates).toHaveLength(1);
    if (!certificates[0].result.ok) throw new Error('expected ok');
    expect(certificates[0].result.row.impSinIva).toBe('451263,08');
    expect(certificates[0].page).toBeNull();
  });

  it('reports a document with no certificate at all', () => {
    const certificates = parseRetencionPages([
      'Un documento largo que no es una constancia de retencion de ningun molino.',
    ]);
    expect(certificates).toHaveLength(1);
    expect(certificates[0].result.ok).toBe(false);
  });
});

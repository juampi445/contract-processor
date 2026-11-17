import { describe, expect, it } from 'vitest';
import {
  computeKpis,
  currentMonthRange,
  defaultRange,
  filterByRange,
  formatIsoDay,
  formatMoney,
  formatMoneyCompact,
  monthLabel,
  monthlyTotals,
  monthsBetween,
  parseRange,
  sumCents,
  toCentsFromNumeric,
  totalsByEmisor,
  type HistorialEntry,
} from '../dashboard';

const entry = (
  fechaOrigen: string,
  importeCents: number,
  emisor: string | null = 'Molino A',
): HistorialEntry => ({
  id: `${fechaOrigen}-${importeCents}`,
  liquidacion: '3310-09051822',
  liqCorrelDgi: '200000490345',
  emisor,
  cuitAgente: '30500120882',
  fechaOrigen,
  importeCents,
  contrato: null,
  sourceFilename: null,
  createdAt: '2026-06-01T10:00:00Z',
  lastExportedAt: '2026-06-01T10:00:00Z',
  exportCount: 1,
  processedBy: null,
});

describe('toCentsFromNumeric', () => {
  it('converts what PostgREST sends for numeric(18,2)', () => {
    expect(toCentsFromNumeric(451263.08)).toBe(45126308);
    expect(toCentsFromNumeric('451263.08')).toBe(45126308);
    expect(toCentsFromNumeric(0)).toBe(0);
  });

  it('does not lose a cent on amounts in the millions', () => {
    expect(toCentsFromNumeric(14285600.01)).toBe(1428560001);
  });

  it('falls back to zero rather than NaN', () => {
    expect(toCentsFromNumeric('' as unknown as number)).toBe(0);
  });
});

describe('sumCents', () => {
  it('adds integers, so a long list stays exact', () => {
    const entries = Array.from({ length: 300 }, () => entry('2026-06-01', 10));
    expect(sumCents(entries)).toBe(3000);
  });
});

describe('parseRange', () => {
  const today = new Date(2026, 8, 17); // 17/09/2026

  it('defaults to the last 12 months', () => {
    expect(parseRange(undefined, undefined, today)).toEqual({
      from: '2025-10-01',
      to: '2026-09-17',
    });
  });

  it('takes a well-formed range from the URL', () => {
    expect(parseRange('2026-01-01', '2026-03-31', today)).toEqual({
      from: '2026-01-01',
      to: '2026-03-31',
    });
  });

  it('swaps a reversed range instead of rejecting it', () => {
    expect(parseRange('2026-03-31', '2026-01-01', today)).toEqual({
      from: '2026-01-01',
      to: '2026-03-31',
    });
  });

  it('ignores garbage and falls back to the default', () => {
    expect(parseRange('ayer', '<script>', today)).toEqual(defaultRange(today));
  });
});

describe('currentMonthRange', () => {
  it('covers the whole month, including a 31st', () => {
    expect(currentMonthRange(new Date(2026, 7, 14))).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('gets February right on a leap year', () => {
    expect(currentMonthRange(new Date(2028, 1, 3))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
  });
});

describe('filterByRange', () => {
  it('includes both ends', () => {
    const entries = [entry('2026-01-01', 1), entry('2026-03-31', 1), entry('2026-04-01', 1)];
    const kept = filterByRange(entries, { from: '2026-01-01', to: '2026-03-31' });
    expect(kept.map((e) => e.fechaOrigen)).toEqual(['2026-01-01', '2026-03-31']);
  });
});

describe('monthsBetween', () => {
  it('walks across a year boundary', () => {
    expect(monthsBetween({ from: '2025-11-15', to: '2026-02-01' })).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('returns a single month when both ends share it', () => {
    expect(monthsBetween({ from: '2026-06-02', to: '2026-06-28' })).toEqual(['2026-06']);
  });
});

describe('monthlyTotals', () => {
  it('keeps months with no retenciones as empty slots', () => {
    const totals = monthlyTotals(
      [entry('2026-01-10', 1000), entry('2026-03-05', 500)],
      { from: '2026-01-01', to: '2026-03-31' },
    );
    expect(totals.map((t) => [t.month, t.cents, t.count])).toEqual([
      ['2026-01', 1000, 1],
      ['2026-02', 0, 0],
      ['2026-03', 500, 1],
    ]);
  });

  it('adds up several certificates in the same month', () => {
    const totals = monthlyTotals(
      [entry('2026-01-10', 1000), entry('2026-01-28', 250)],
      { from: '2026-01-01', to: '2026-01-31' },
    );
    expect(totals[0]).toMatchObject({ cents: 1250, count: 2 });
  });
});

describe('totalsByEmisor', () => {
  it('sorts by amount, descending', () => {
    const totals = totalsByEmisor([
      entry('2026-01-10', 100, 'Molino A'),
      entry('2026-01-11', 900, 'Molino B'),
      entry('2026-01-12', 50, 'Molino A'),
    ]);
    expect(totals).toEqual([
      { emisor: 'Molino B', cuit: null, sinIdentificar: false, cents: 900, count: 1 },
      { emisor: 'Molino A', cuit: null, sinIdentificar: false, cents: 150, count: 2 },
    ]);
  });

  it('groups an unknown issuer under its CUIT, flagged, rather than dropping it', () => {
    const totals = totalsByEmisor([entry('2026-01-10', 100, null)]);
    expect(totals).toEqual([
      {
        emisor: '30-50012088-2',
        cuit: '30500120882',
        sinIdentificar: true,
        cents: 100,
        count: 1,
      },
    ]);
  });
});

describe('computeKpis', () => {
  const today = new Date(2026, 8, 17); // septiembre 2026

  it('scopes three numbers to the range and pins the month one', () => {
    const all = [
      entry('2026-09-02', 1000, 'Molino A'),
      entry('2026-09-15', 500, 'Molino B'),
      entry('2026-03-01', 7000, 'Molino C'),
    ];
    const range = { from: '2026-01-01', to: '2026-12-31' };

    const kpis = computeKpis(filterByRange(all, range), all, today);
    expect(kpis).toEqual({
      rangeCents: 8500,
      rangeCount: 3,
      emisores: 3,
      currentMonthCents: 1500,
      currentMonthCount: 2,
    });
  });

  it('leaves the month card alone when the range excludes this month', () => {
    const all = [entry('2026-09-02', 1000), entry('2026-03-01', 7000)];
    const range = { from: '2026-03-01', to: '2026-03-31' };

    const kpis = computeKpis(filterByRange(all, range), all, today);
    expect(kpis.rangeCents).toBe(7000);
    expect(kpis.currentMonthCents).toBe(1000);
  });
});

describe('formatMoney', () => {
  it('formats es-AR without relying on Intl', () => {
    expect(formatMoney(45126308)).toBe('$ 451.263,08');
    expect(formatMoney(5)).toBe('$ 0,05');
    expect(formatMoney(0)).toBe('$ 0,00');
    expect(formatMoney(100000000000)).toBe('$ 1.000.000.000,00');
  });
});

describe('formatMoneyCompact', () => {
  it('shortens for a chart axis', () => {
    expect(formatMoneyCompact(150000000)).toBe('$1,5M');
    expect(formatMoneyCompact(45000000)).toBe('$450k');
    expect(formatMoneyCompact(50000)).toBe('$500');
  });
});

describe('monthLabel / formatIsoDay', () => {
  it('renders month keys and dates in Spanish conventions', () => {
    expect(monthLabel('2026-08')).toBe('ago 26');
    expect(formatIsoDay('2026-08-14')).toBe('14/08/2026');
  });
});

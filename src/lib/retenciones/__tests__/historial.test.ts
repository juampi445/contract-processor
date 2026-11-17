import { describe, expect, it } from 'vitest';
import {
  exportXmlBatch,
  formatDdMm,
  importeDecimal,
  isUnreliable,
  saveableResults,
  toHistorialRecord,
  toHistorialRecordFromXmlInput,
  toIsoDate,
  XmlBloqueadoError,
} from '../historial';
import { toCents } from '../toXmlValues';
import type { FileResult, RetencionRow } from '../types';

const row = (overrides: Partial<RetencionRow> = {}): RetencionRow => ({
  contrato: '126080440',
  ordenInter: '62997621',
  liqCorrelDgi: '200000490345',
  fechaOrigen: '01/06/2026',
  fechaVto: '01/06/2026',
  impSinIva: '451263,08',
  impTotal: '451263,08',
  nroRegOlcu: 1,
  cuitCorredor: '30500120882', // molino de prueba
  observacion: null,
  conceptoRetIva: '3310-09051822',
  ...overrides,
});

const result = (overrides: Partial<FileResult> = {}): FileResult => ({
  id: 'r1',
  fileName: 'aca.pdf',
  status: 'ok',
  row: row(),
  warnings: [],
  ...overrides,
});

describe('toIsoDate', () => {
  it('converts the spreadsheet format to a date column value', () => {
    expect(toIsoDate('01/06/2026')).toBe('2026-06-01');
    expect(toIsoDate('31/12/2025')).toBe('2025-12-31');
  });

  it('rejects anything that is not dd/mm/yyyy', () => {
    expect(() => toIsoDate('2026-06-01')).toThrow();
    expect(() => toIsoDate('1/6/2026')).toThrow();
    expect(() => toIsoDate('')).toThrow();
  });
});

describe('importeDecimal', () => {
  it('agrees with the value the XML carries, in every notation', () => {
    for (const raw of ['451263,08', '451.263,08', '451,263.08', '451263']) {
      const cents = toCents(raw);
      const decimal = importeDecimal(raw);
      // The stored amount and the exported one must be the same number.
      expect(decimal.replace('.', '')).toBe(cents);
    }
  });

  it('formats amounts of every size with two decimals', () => {
    expect(importeDecimal('451263,08')).toBe('451263.08');
    expect(importeDecimal('14285600,00')).toBe('14285600.00');
    expect(importeDecimal('0,05')).toBe('0.05');
    expect(importeDecimal('5')).toBe('5.00');
  });
});

describe('saveableResults', () => {
  it('keeps clean rows', () => {
    expect(saveableResults([result()])).toHaveLength(1);
  });

  it('drops rows whose amount is unreliable (not 5% of the base)', () => {
    const flagged = result({
      id: 'r2',
      warnings: [{ code: 'retencion_no_5pct', message: 'Revisar: el retenido no es el 5%' }],
    });
    expect(isUnreliable(flagged)).toBe(true);
    expect(saveableResults([result(), flagged])).toEqual([result()]);
  });

  it('KEEPS rows whose issuer is merely unnamed: only the label is missing', () => {
    const unnamed = result({
      id: 'r2',
      row: row({ cuitCorredor: '30710123450' }),
      warnings: [{ code: 'emisor_desconocido', message: 'Revisar: emisor no conocido' }],
    });
    expect(isUnreliable(unnamed)).toBe(false);
    expect(saveableResults([unnamed])).toEqual([unnamed]);
  });

  it('drops rows that failed to parse', () => {
    const failed = result({ id: 'r3', status: 'error', row: undefined });
    expect(saveableResults([failed])).toHaveLength(0);
  });
});

/** The catalog as the tests see it: one CUIT named, everything else not. */
const catalog = (cuit: string): string | null => (cuit === '30500120882' ? 'Molino A' : null);

describe('toHistorialRecord', () => {
  it('maps a preview row to its database record', () => {
    expect(toHistorialRecord(result(), catalog)).toEqual({
      liquidacion: '3310-09051822',
      liq_correl_dgi: '200000490345',
      emisor: 'Molino A',
      cuit_agente: '30500120882',
      fecha_origen: '2026-06-01',
      importe: '451263.08',
      contrato: '126080440',
      source_filename: 'aca.pdf',
    });
  });

  it('saves the hand-typed CONTRATO, not the parsed one', () => {
    const edited = result({ row: row({ contrato: '999000111' }) });
    expect(toHistorialRecord(edited).contrato).toBe('999000111');
  });

  it('leaves emisor null when the catalog does not know the CUIT', () => {
    const unknown = result({ row: row({ cuitCorredor: '30710865607' }) });
    expect(toHistorialRecord(unknown, catalog).emisor).toBeNull();
  });

  it('never names a row from the code table: without a resolver it is null, even for a CUIT with reading rules', () => {
    expect(toHistorialRecord(result()).emisor).toBeNull();
  });

  it('takes the name the catalog resolver gives', () => {
    const named = result({ row: row({ cuitCorredor: '30710865607' }) });
    const resolver = (cuit: string) => (cuit === '30710865607' ? 'Molino Nuevo' : null);
    expect(toHistorialRecord(named, resolver).emisor).toBe('Molino Nuevo');
    expect(toHistorialRecord(result(), () => 'Molino A (renombrado)').emisor).toBe('Molino A (renombrado)');
  });

  it('turns empty optional fields into null instead of empty strings', () => {
    const bare = result({ row: row({ contrato: '' }) });
    expect(toHistorialRecord(bare).contrato).toBeNull();
  });
});

describe('toHistorialRecordFromXmlInput', () => {
  const input = {
    contrato: '126080440',
    ordenInter: '62997621',
    liqCorrelDgi: '200000490345',
    fecha: '01/06/2026',
    importe: '451.263,08',
    cuitCorredor: '30500120882',
    concepto: '3310-09051822',
  };

  it('records exactly what the XML carried', () => {
    expect(toHistorialRecordFromXmlInput(input, 'retenciones.xlsx', catalog)).toEqual({
      liquidacion: '3310-09051822',
      liq_correl_dgi: '200000490345',
      emisor: 'Molino A',
      cuit_agente: '30500120882',
      fecha_origen: '2026-06-01',
      importe: '451263.08',
      contrato: '126080440',
      source_filename: 'retenciones.xlsx',
    });
  });

  it('accepts a cell Excel handed back as a Date', () => {
    const edited = { ...input, fecha: new Date(2026, 5, 1) };
    expect(toHistorialRecordFromXmlInput(edited, null).fecha_origen).toBe('2026-06-01');
  });

  it('agrees with the PDF flow for the same values', () => {
    expect(toHistorialRecordFromXmlInput(input, 'aca.pdf', catalog)).toEqual(
      toHistorialRecord(result(), catalog),
    );
  });
});

describe('formatDdMm', () => {
  it('names the previous export date', () => {
    expect(formatDdMm(new Date(2026, 7, 14, 10, 30).toISOString())).toBe('14/08');
  });

  it('returns an empty string for an unusable timestamp', () => {
    expect(formatDdMm('no es una fecha')).toBe('');
  });
});

describe('exportXmlBatch — the one path every XML takes', () => {
  const input = {
    contrato: '126080440',
    ordenInter: '62997621',
    liqCorrelDgi: '200000490345',
    fecha: '01/06/2026',
    importe: '451263,08',
    cuitCorredor: '30500120882',
    concepto: '3310-09051822',
  };

  /** A supabase stub whose rpc records what it was asked to save. */
  function fakeClient() {
    const calls: unknown[] = [];
    const client = {
      rpc: async (_fn: string, args: { p_rows: unknown }) => {
        calls.push(args.p_rows);
        const rows = args.p_rows as unknown[];
        return { data: rows.map(() => ({ export_count: 1 })), error: null };
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { client: client as any, calls };
  }

  it('blocks the whole batch when a required field is missing: no download, no save', async () => {
    const { client, calls } = fakeClient();
    const downloads: string[] = [];
    await expect(
      exportXmlBatch(
        client,
        'company',
        [
          { input, sourceFilename: 'a.pdf', saveable: true },
          { input: { ...input, ordenInter: '' }, sourceFilename: 'b.pdf', saveable: true },
        ],
        () => 'Molino A',
        (_blob, name) => downloads.push(name),
      ),
    ).rejects.toBeInstanceOf(XmlBloqueadoError);
    expect(downloads).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('names the missing field the way BIT knows it', async () => {
    const { client } = fakeClient();
    const err = await exportXmlBatch(
      client,
      'company',
      [{ input: { ...input, contrato: '' }, sourceFilename: null, saveable: true }],
      () => null,
      () => undefined,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(XmlBloqueadoError);
    expect((err as Error).message).toMatch(/Falta CONTRATO/);
  });

  it('downloads, then saves the saveable rows and counts the unreliable ones as skipped', async () => {
    const { client, calls } = fakeClient();
    const downloads: string[] = [];
    const outcome = await exportXmlBatch(
      client,
      'company',
      [
        { input, sourceFilename: 'a.pdf', saveable: true },
        { input: { ...input, concepto: '3310-00000001' }, sourceFilename: 'b.pdf', saveable: false },
      ],
      () => 'Molino A',
      (_blob, name) => downloads.push(name),
    );
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/^DSEND_ENVIO_LIQUIDA_.*\.xml$/);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([
      {
        liquidacion: '3310-09051822',
        liq_correl_dgi: '200000490345',
        emisor: 'Molino A',
        cuit_agente: '30500120882',
        fecha_origen: '2026-06-01',
        importe: '451263.08',
        contrato: '126080440',
        source_filename: 'a.pdf',
      },
    ]);
    expect(outcome).toEqual({ saved: 1, updated: 0, skipped: 1, saveError: null });
  });

  it('saves an unnamed issuer with its CUIT instead of leaving it out', async () => {
    const { client, calls } = fakeClient();
    await exportXmlBatch(
      client,
      'company',
      [{ input: { ...input, cuitCorredor: '30710123450' }, sourceFilename: null, saveable: true }],
      () => null,
      () => undefined,
    );
    expect(calls[0]).toEqual([
      expect.objectContaining({ emisor: null, cuit_agente: '30710123450' }),
    ]);
  });

  it('reports a failed write instead of throwing: the XML is already on disk', async () => {
    const client = {
      rpc: async () => ({ data: null, error: { code: '42501', message: 'not_allowed', details: '' } }),
    };
    const outcome = await exportXmlBatch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      'company',
      [{ input, sourceFilename: null, saveable: true }],
      () => 'Molino A',
      () => undefined,
    );
    expect(outcome.saved).toBe(0);
    expect(outcome.saveError).toBeTruthy();
  });
});

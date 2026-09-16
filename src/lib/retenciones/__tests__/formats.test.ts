import { describe, expect, it } from 'vitest';
import { parseMonto } from '../amount';
import { cuitAtStart, findCanonicalCuits, isValidCuit } from '../cuit';
import { ISSUERS, normalizeLiqCorrelDgi } from '../issuers';
import {
  extractConceptoRetIva,
  extractContrato,
  extractCuitCorredor,
  extractFechaOrigen,
  extractImpSinIva,
} from '../fields';
import { toCents } from '../toXmlValues';

/**
 * Cross-format rules, exercised with the real tokens each mill prints.
 *
 * The strings here are verbatim excerpts of what pdf.js emits for the 8
 * reference files (dump them with `scripts/dump-retenciones-text.mjs`). They
 * pin one rule at a time; the end-to-end run over the real PDFs lives in
 * `golden.test.ts`.
 */

describe('parseMonto — US and es-AR notation', () => {
  it('reads aca US notation (comma thousands, dot decimal)', () => {
    expect(parseMonto('451,263.08')).toEqual({
      num: 451263.08,
      esAr: '451263,08',
    });
  });

  it('reads es-AR notation (dot thousands, comma decimal)', () => {
    expect(parseMonto('12.500.000,00')).toEqual({
      num: 12500000,
      esAr: '12500000,00',
    });
    expect(parseMonto('1.077.923,83')).toEqual({
      num: 1077923.83,
      esAr: '1077923,83',
    });
  });

  it('reads a bare integer', () => {
    expect(parseMonto('13075000')).toEqual({
      num: 13075000,
      esAr: '13075000,00',
    });
  });

  it('treats a 3-digit group after the last separator as thousands, like toCents', () => {
    // The sheet and the XML must never disagree about what "1.234" means.
    const parsed = parseMonto('1.234');
    expect(parsed?.num).toBe(1234);
    expect(toCents(parsed!.esAr)).toBe(toCents('1.234'));
  });

  it('stays consistent with toCents across every reference amount', () => {
    const amounts = [
      ['451,263.08', '45126308'],
      ['12.500.000,00', '1250000000'],
      ['1.077.923,83', '107792383'],
      ['3.117.857,46', '311785746'],
      ['13.075.000,00', '1307500000'],
      ['2.111.293,44', '211129344'],
      ['301.478,88', '30147888'],
      ['14.285.600,00', '1428560000'],
      ['1.041.600,00', '104160000'],
    ] as const;
    for (const [raw, cents] of amounts) {
      const m = parseMonto(raw);
      expect(m, raw).not.toBeNull();
      expect(toCents(m!.esAr), raw).toBe(cents);
    }
  });

  it('returns null when there are no digits', () => {
    expect(parseMonto('')).toBeNull();
    expect(parseMonto('—')).toBeNull();
  });
});

describe('isValidCuit — mod 11', () => {
  const KNOWN = [
    '30500120882', // aca
    '30711615519', // amaggi
    '30511534492', // arca
    '30700869918', // bunge
    '30711160163', // chs
    '33506737449', // cofco
    '30526712729', // idc / LDC
    '30507950848', // molino cañuelas
  ];

  it('accepts every known withholding agent', () => {
    for (const cuit of KNOWN) expect(isValidCuit(cuit), cuit).toBe(true);
  });

  it('rejects a wrong check digit', () => {
    expect(isValidCuit('30500120883')).toBe(false);
  });

  it('rejects anything that is not 11 digits', () => {
    expect(isValidCuit('3050012088')).toBe(false);
    expect(isValidCuit('305001208820')).toBe(false);
    expect(isValidCuit('')).toBe(false);
  });

  it('reads the canonical spelling pdf.js splits with a space', () => {
    expect(findCanonicalCuits('C.U.I.T.: 30-50012088- 2 algo')).toEqual([
      '30500120882',
    ]);
  });

  it('skips numbers that merely look like a CUIT', () => {
    // An 11-digit invoice number with a bad check digit must not be picked up.
    expect(findCanonicalCuits('Comprobante 12-3456789-1')).toEqual([]);
  });

  it('never accepts a bare 11-digit run as a CUIT', () => {
    // 33100936246 is the head of bunge's comprobante 3310-09362466 and passes
    // mod-11 by coincidence — the exact number that used to be exported.
    expect(isValidCuit('33100936246')).toBe(true);
    expect(findCanonicalCuits('03310---09362466 1019247127')).toEqual([]);
  });

  it('accepts a bare group only right after a CUIT label (amaggi)', () => {
    expect(cuitAtStart('30711615519 IIBB 901-302460-1')).toBe('30711615519');
    expect(cuitAtStart('Ingresos brutos 30711615519')).toBeNull();
  });
});

describe('extractCuitCorredor — the agent, not any CUIT on the page', () => {
  it('rejects the head of the comprobante (bunge regression)', () => {
    const bunge =
      '03310---09362466 1019247127 14.08.2026 G2 Liq Sec Granos ' +
      'Nº de certificado: 0020-01500121 C.U.I.T.: 30-70086991- 8 ' +
      'Ingresos brutos: 30700869918-904';
    expect(extractCuitCorredor(bunge)).toBe('30700869918');
  });

  it('prefers the agente label over an earlier unrelated CUIT (idc)', () => {
    const idc =
      'Datos del Proveedor C.U.I.T.: 20-12536852-3 0331009430817 ' +
      'Nº Agente Retención: 30526712729 C.U.I.T.: 30-52671272-9';
    expect(extractCuitCorredor(idc)).toBe('30526712729');
  });

  it('falls back to the first canonical CUIT when there is no label (arca)', () => {
    const arca = '0000-2026-125081 31/07/2026 30-51153449-2 30-50836064-5';
    expect(extractCuitCorredor(arca)).toBe('30511534492');
  });
});

describe('extractConceptoRetIva — every mangled spelling', () => {
  const CASES: ReadonlyArray<[string, string]> = [
    ['--3310-09051822 3300402844', '3310-09051822'], // aca
    ['3310A09345968', '3310-09345968'], // amaggi
    ['03310---09362466', '3310-09362466'], // bunge
    ['331009379539', '3310-09379539'], // chs
    ['0331009430817', '3310-09430817'], // idc
    ['33-01-09278898', '3310-09278898'], // arca (C.1116 variant)
  ];

  for (const [raw, expected] of CASES) {
    it(`normalizes ${raw}`, () => {
      expect(extractConceptoRetIva(raw)).toBe(expected);
    });
  }

  it('returns null when there is no comprobante at all', () => {
    expect(extractConceptoRetIva('una constancia cualquiera 1234')).toBeNull();
  });
});

describe('extractFechaOrigen — label, city and separators', () => {
  it('prefers an explicit Fecha: label', () => {
    expect(extractFechaOrigen('Fecha: 14/08/2026 y algo 01.01.2020')).toBe(
      '14/08/2026',
    );
  });

  it('accepts a 2-digit year', () => {
    expect(extractFechaOrigen('Fecha: 31/07/26')).toBe('31/07/2026');
  });

  it('falls back to the issuer city', () => {
    expect(extractFechaOrigen('Tancacha 31.08.2026 resto')).toBe('31/08/2026');
  });

  it('is not fooled by comprobante tokens that look like dates', () => {
    // 33-01-09278898 must never be read as day 33.
    expect(extractFechaOrigen('33-01-09278898 Fecha: 31/07/2026')).toBe(
      '31/07/2026',
    );
  });

  it('ignores a date whose day or month is out of range', () => {
    expect(extractFechaOrigen('algo 45.13.2026 sin mas')).toBeNull();
  });
});

describe('extractImpSinIva — the three amount rules', () => {
  it('rule 1 — explicit label', () => {
    expect(
      extractImpSinIva('Importe total Retenido: 12.500.000,00'),
    ).toEqual({ num: 12500000, esAr: '12500000,00' });
    expect(extractImpSinIva('Monto de la Retención: $ 301.478,88')).toEqual({
      num: 301478.88,
      esAr: '301478,88',
    });
  });

  it('rule 2 — last amount on the TOTAL run', () => {
    expect(extractImpSinIva('TOTAL 9.025.261,56 451.263,08')).toEqual({
      num: 451263.08,
      esAr: '451263,08',
    });
  });

  it('rule 3 — the amount after the 5% rate, for formats with no TOTAL', () => {
    expect(
      extractImpSinIva('Base 261.500.000,00 Alicuota 5,00 % 13.075.000,00'),
    ).toEqual({ num: 13075000, esAr: '13075000,00' });
  });

  it('returns null when no rule matches', () => {
    expect(extractImpSinIva('sin importes aqui')).toBeNull();
  });
});

describe('normalizeLiqCorrelDgi — block rule, not "strip leading zeros"', () => {
  it('concatenates every block for the confirmed issuers', () => {
    expect(normalizeLiqCorrelDgi('2000/00490345', 'concat')).toBe(
      '200000490345',
    ); // aca
    expect(normalizeLiqCorrelDgi('0020-01500121', 'concat')).toBe(
      '002001500121',
    ); // bunge
  });

  it('drops the empty point-of-sale block for arca', () => {
    expect(normalizeLiqCorrelDgi('0000-2026-125081', 'drop-empty-block')).toBe(
      '2026125081',
    );
  });

  it('never strips leading zeros of a REAL point of sale', () => {
    // The trap: "remove leading zeros" would turn bunge into 2001500121.
    expect(normalizeLiqCorrelDgi('0020-01500121', 'heuristic')).toBe(
      '002001500121',
    );
    expect(normalizeLiqCorrelDgi('0020-01500121', 'heuristic')).not.toBe(
      '2001500121',
    );
  });

  it('heuristic: 3 blocks with an all-zeros first block drop it', () => {
    expect(normalizeLiqCorrelDgi('0000-2026-125081')).toBe('2026125081');
  });

  it('heuristic: 3 blocks with a real first block keep everything', () => {
    expect(normalizeLiqCorrelDgi('6-0117947-023714')).toBe('60117947023714');
  });

  it('heuristic: a single block passes through untouched', () => {
    expect(normalizeLiqCorrelDgi('86119')).toBe('86119');
    expect(normalizeLiqCorrelDgi('654274')).toBe('654274');
  });
});

describe('issuer confidence — approved values are pinned', () => {
  const CONFIRMED = ['30500120882', '30511534492', '30700869918']; // aca, arca, bunge

  it('never lets the heuristic recompute a confirmed issuer', () => {
    for (const cuit of CONFIRMED) {
      expect(ISSUERS[cuit].confidence, cuit).toBe('confirmed');
      expect(ISSUERS[cuit].normalization, cuit).not.toBe('heuristic');
    }
  });

  it('marks the rest as assumed, pending a real import to BIT', () => {
    const assumed = Object.entries(ISSUERS)
      .filter(([, spec]) => spec.confidence === 'assumed')
      .map(([cuit]) => cuit);
    expect(assumed.sort()).toEqual(
      [
        '30507950848', // cañuelas
        '30526712729', // idc
        '30711160163', // chs
        '30711615519', // amaggi
        '33506737449', // cofco
      ].sort(),
    );
  });
});

describe('extractContrato', () => {
  it('reads the bunge spelling', () => {
    expect(extractContrato('Número de contrato: 1000562291')).toBe('1000562291');
  });

  it('reads the cofco spelling', () => {
    expect(extractContrato('Nro Contrato 1000562291 resto')).toBe('1000562291');
  });

  it('is empty on formats that do not print it', () => {
    expect(extractContrato('CONSTANCIA DE RETENCION 2000/00490345')).toBe('');
  });
});

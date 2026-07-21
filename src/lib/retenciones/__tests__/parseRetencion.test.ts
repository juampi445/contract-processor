import { describe, expect, it } from 'vitest';
import {
  extractConceptoRetIva,
  extractCuitCorredor,
  extractFechaOrigen,
  extractImpSinIva,
  extractIssuerLocality,
  extractLiqCorrelDgi,
  formatUsToEsAr,
} from '../fields';
import { parseRetencion } from '../parseRetencion';

/**
 * Reference text layer of one file, normalized the same way `extractPdfText`
 * does it: all items joined with spaces, whitespace collapsed to single spaces.
 */
const RAW = `
Asociación de Cooperativas Argentinas
Coop Ltda
DOMICILIO:Rioja 875
LOCALIDAD:Rosario
CODIGO POSTAL:2000
PROVINCIA: Santa Fé
NRO. AGENTE RETENCION: 30-50012088-2
 C.U.I.T.: 30-50012088- 2
 I.V.A.: IVA Responsable Inscripto
 Emitido por: Asociación de Cooperativas Argentinas
 Nro.doc.interno: 3300425509
 IMPUESTO: Ret. IVA Rég. Granos RG AFIP 2300
CONSTANCIA DE RETENCION 2000/00490345
 Rosario 01.06.2026
COOP.AGROPECUARIA DE TANDIL LT
DOMICILIO: RUTA 226 Y 30
LOCALIDAD:TANDIL
C.U.I.T.: 30-50836064- 5
Ingresos brutos: 30508360645
Nº Documento  Nº Documento interno  Fecha  Clase documento  Base Imponible  Monto retenido
--3310-09051822  3300402844  15.05.2026  9,025,261.56  451,263.08
Código retención oficial   Base retención   Retenido mon.   Alícuota
157 IVA4310Granos(NoArroz)CoopOpAl
 9,025,261.56  451,263.08  5.00 %
TOTAL  9,025,261.56  451,263.08
`;

const TEXT = RAW.replace(/\s+/g, ' ').trim();

describe('field extractors', () => {
  it('formatUsToEsAr converts US amounts to es-AR text', () => {
    expect(formatUsToEsAr('451,263.08')).toBe('451263,08');
    expect(formatUsToEsAr('9,025,261.56')).toBe('9025261,56');
  });

  it('C — LIQCORRELDGI: digits of the constancia number', () => {
    expect(extractLiqCorrelDgi(TEXT)).toBe('200000490345');
  });

  it('issuer locality is the first LOCALIDAD (Rosario)', () => {
    expect(extractIssuerLocality(TEXT)).toBe('Rosario');
  });

  it('D — FECHAORIGEN: issue date next to issuer city (not the table date)', () => {
    expect(extractFechaOrigen(TEXT)).toBe('01/06/2026');
  });

  it('F — IMPSINIVA: Monto retenido from TOTAL line, es-AR', () => {
    expect(extractImpSinIva(TEXT)).toBe('451263,08');
  });

  it('I — CUITCORREDOR: withholding agent CUIT, 11 digits', () => {
    expect(extractCuitCorredor(TEXT)).toBe('30500120882');
  });

  it('K — CONCEPTO_RETIVA: token on the -- detail row', () => {
    expect(extractConceptoRetIva(TEXT)).toBe('3310-09051822');
  });
});

describe('parseRetencion', () => {
  it('parses the full reference row', () => {
    const result = parseRetencion(TEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');

    expect(result.row).toEqual({
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
    });
  });

  it('reports a missing text layer', () => {
    const result = parseRetencion('too short');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.errors[0].field).toBe('text');
  });

  it('collects field errors for garbage input of sufficient length', () => {
    const result = parseRetencion('x'.repeat(80));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

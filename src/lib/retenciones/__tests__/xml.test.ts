import { describe, expect, it } from 'vitest';
import { buildXml, type RetencionXmlInput } from '../buildXml';
import { toCents } from '../toXmlValues';

describe('toCents', () => {
  it('handles the four format variants', () => {
    expect(toCents('451263,08')).toBe('45126308'); // es-AR
    expect(toCents('451.263,08')).toBe('45126308'); // es-AR con miles
    expect(toCents('451,263.08')).toBe('45126308'); // US
    expect(toCents('451263')).toBe('45126300'); // sin decimales
  });

  it('pads a single decimal digit', () => {
    expect(toCents('451263,8')).toBe('45126380');
  });

  it('throws on a value with no digits', () => {
    expect(() => toCents('')).toThrow();
  });
});

const rec = (i: number): RetencionXmlInput => ({
  liqCorrelDgi: `20000049034${i}`,
  fecha: '01/06/2026',
  importe: '451263,08',
  cuitCorredor: '30500120882',
  concepto: `3310-0905182${i}`,
});

const CABEZAL_1 = `<SubTask_SELECT_ENVIO_CABEZAL_001>
<CONTINTERNO></CONTINTERNO>
<CONTRATO></CONTRATO>
<ORDENINTER></ORDENINTER>
<LIQCORRELDGI>200000490341</LIQCORRELDGI>
<COMPANULA>0</COMPANULA>
<FECHAORIGEN>01/06/2026</FECHAORIGEN>
<DIASVTO>0</DIASVTO>
<FECHAVTO>01/06/2026</FECHAVTO>
<TIPOCOMP>RETIVA</TIPOCOMP>
<KILOS>0</KILOS>
<PRECIO>0</PRECIO>
<MONEDA>7</MONEDA>
<IMPSINIVA>45126308</IMPSINIVA>
<IMPIVA>0</IMPIVA>
<IMPTOTAL>45126308</IMPTOTAL>
<OBSERVACION> </OBSERVACION>
<NROCAI></NROCAI>
<FECVTOCAI></FECVTOCAI>
<NROREGOLCU>1</NROREGOLCU>
<LIQPREIMPDGI>0</LIQPREIMPDGI>
<CUITCORREDOR>30500120882</CUITCORREDOR>
<DEBCRE>CRE</DEBCRE>
</SubTask_SELECT_ENVIO_CABEZAL_001>`;

const CUERPO_RETIVA_1 = `<SubTask_SELECT_ENVIO_CUERPO_001>
<ORDENINTER></ORDENINTER>
<CODIMOVI>RETIVA</CODIMOVI>
<DETALLE>3310-09051821</DETALLE>
<SUMAIMP>0</SUMAIMP>
<BASE>45126308</BASE>
<TIPOMOV>2</TIPOMOV>
<POR_PRE>0</POR_PRE>
<IMPORIGEN>45126308</IMPORIGEN>
<ALIIVA>0</ALIIVA>
<IVA>0</IVA>
<ALIRETENCION>0</ALIRETENCION>
<RETENCION>0</RETENCION>
<ALIPERCEPCION>0</ALIPERCEPCION>
<PERCEPCION>0</PERCEPCION>
<IMPTOTAL>45126308</IMPTOTAL>
<MONEDA>7</MONEDA>
<CUITCORREDOR>30500120882</CUITCORREDOR>
</SubTask_SELECT_ENVIO_CUERPO_001>`;

const CUERPO_IN_1 = `<SubTask_SELECT_ENVIO_CUERPO_001>
<ORDENINTER></ORDENINTER>
<CODIMOVI>IN</CODIMOVI>
<DETALLE>Importe Neto</DETALLE>
<SUMAIMP>1</SUMAIMP>
<BASE>0</BASE>
<TIPOMOV>2</TIPOMOV>
<POR_PRE>0</POR_PRE>
<IMPORIGEN>45126308</IMPORIGEN>
<ALIIVA>0</ALIIVA>
<IVA>0</IVA>
<ALIRETENCION>0</ALIRETENCION>
<RETENCION>0</RETENCION>
<ALIPERCEPCION>0</ALIPERCEPCION>
<PERCEPCION>0</PERCEPCION>
<IMPTOTAL>45126308</IMPTOTAL>
<MONEDA>7</MONEDA>
<CUITCORREDOR>30500120882</CUITCORREDOR>
</SubTask_SELECT_ENVIO_CUERPO_001>`;

const header = (n: number): string =>
  `<?xml version="1.0" encoding="utf-8"?>
<CONTENT cryp="0" size="0" dataTableNames="SubTask_UPDATE_ENVIO_LIQUIDA_001,SubTask_SELECT_ENVIO_CABEZAL_001,SubTask_SELECT_ENVIO_CUERPO_001,SubTask_SELECT_ENVIO_CCPP_001,SubTask_SELECT_ENVIO_PARCIAL_001,SubTask_DELETE_ENVIO_LIQUIDA_001">
<TaskDS>
<SubTask_UPDATE_ENVIO_LIQUIDA_001>
<affectedRows>${n}</affectedRows>
</SubTask_UPDATE_ENVIO_LIQUIDA_001>`;

const footer = (n: number): string =>
  `<SubTask_DELETE_ENVIO_LIQUIDA_001>
<affectedRows>${n}</affectedRows>
</SubTask_DELETE_ENVIO_LIQUIDA_001>
</TaskDS>
</CONTENT>`;

describe('buildXml', () => {
  it('emits the exact string for 1 record', () => {
    const expected =
      header(1) +
      '\n' +
      CABEZAL_1 +
      '\n' +
      CUERPO_RETIVA_1 +
      CUERPO_IN_1 +
      '\n' +
      footer(1);

    expect(buildXml([rec(1)])).toBe(expected);
  });

  it('emits the exact string for 3 records', () => {
    // CABEZAL differ only by LIQCORRELDGI suffix; CUERPO RETIVA only by DETALLE.
    const cabezal = (i: number): string =>
      CABEZAL_1.replace('200000490341', `20000049034${i}`);
    const cuerpoRet = (i: number): string =>
      CUERPO_RETIVA_1.replace('3310-09051821', `3310-0905182${i}`);

    const cabezalGroup = [cabezal(1), cabezal(2), cabezal(3)].join('');
    const cuerpoGroup = [1, 2, 3]
      .map((i) => cuerpoRet(i) + CUERPO_IN_1)
      .join('');

    const expected =
      header(3) + '\n' + cabezalGroup + '\n' + cuerpoGroup + '\n' + footer(3);

    expect(buildXml([rec(1), rec(2), rec(3)])).toBe(expected);
  });

  it('never self-closes empty tags and never pretty-prints', () => {
    const xml = buildXml([rec(1)]);
    expect(xml).toContain('<CONTRATO></CONTRATO>');
    expect(xml).not.toContain('<CONTRATO/>');
    expect(xml).toContain('<OBSERVACION> </OBSERVACION>');
    // adjacent CABEZAL/CUERPO of same kind are glued, one newline between groups
    expect(xml).toContain(
      '</SubTask_SELECT_ENVIO_CABEZAL_001>\n<SubTask_SELECT_ENVIO_CUERPO_001>',
    );
    expect(xml).toContain(
      '</SubTask_SELECT_ENVIO_CUERPO_001><SubTask_SELECT_ENVIO_CUERPO_001>',
    );
  });
});

import { escapeXml, normalizeFecha, toCents } from './toXmlValues';

/**
 * One record's values in spreadsheet format, as they live in memory or in an
 * XLSX cell. Both entry points (in-memory rows, uploaded XLSX) build these and
 * hand them to `buildXml`, which does all format conversion internally so the
 * two paths are guaranteed byte-identical.
 */
export interface RetencionXmlInput {
  liqCorrelDgi: string; // C
  fecha: string | Date; // D (FECHAORIGEN, also FECHAVTO)
  importe: string; // F (IMPSINIVA, also IMPTOTAL/BASE/IMPORIGEN)
  cuitCorredor: string; // I
  concepto: string; // K
}

const DATA_TABLE_NAMES = [
  'SubTask_UPDATE_ENVIO_LIQUIDA_001',
  'SubTask_SELECT_ENVIO_CABEZAL_001',
  'SubTask_SELECT_ENVIO_CUERPO_001',
  'SubTask_SELECT_ENVIO_CCPP_001',
  'SubTask_SELECT_ENVIO_PARCIAL_001',
  'SubTask_DELETE_ENVIO_LIQUIDA_001',
].join(',');

/** `<TAG>value</TAG>` — never self-closed, even when empty. */
const el = (tag: string, value = ''): string => `<${tag}>${value}</${tag}>`;

/** Values of a record, already converted to XML format and escaped. */
interface XmlValues {
  liq: string;
  fecha: string;
  importe: string;
  cuit: string;
  concepto: string;
}

const toXmlValues = (r: RetencionXmlInput): XmlValues => ({
  liq: escapeXml(r.liqCorrelDgi),
  fecha: escapeXml(normalizeFecha(r.fecha)),
  importe: escapeXml(toCents(r.importe)),
  cuit: escapeXml(r.cuitCorredor),
  concepto: escapeXml(r.concepto),
});

function buildCabezal(v: XmlValues): string {
  return [
    '<SubTask_SELECT_ENVIO_CABEZAL_001>',
    el('CONTINTERNO'),
    el('CONTRATO'),
    el('ORDENINTER'),
    el('LIQCORRELDGI', v.liq),
    el('COMPANULA', '0'),
    el('FECHAORIGEN', v.fecha),
    el('DIASVTO', '0'),
    el('FECHAVTO', v.fecha),
    el('TIPOCOMP', 'RETIVA'),
    el('KILOS', '0'),
    el('PRECIO', '0'),
    el('MONEDA', '7'),
    el('IMPSINIVA', v.importe),
    el('IMPIVA', '0'),
    el('IMPTOTAL', v.importe),
    el('OBSERVACION', ' '),
    el('NROCAI'),
    el('FECVTOCAI'),
    el('NROREGOLCU', '1'),
    el('LIQPREIMPDGI', '0'),
    el('CUITCORREDOR', v.cuit),
    el('DEBCRE', 'CRE'),
    '</SubTask_SELECT_ENVIO_CABEZAL_001>',
  ].join('\n');
}

/**
 * A CUERPO block. Two per record: the retention line (RETIVA) and the net
 * amount line (IN). They differ only in codimovi/detalle/sumaimp/base.
 */
function buildCuerpo(
  v: XmlValues,
  opts: { codimovi: string; detalle: string; sumaimp: string; base: string },
): string {
  return [
    '<SubTask_SELECT_ENVIO_CUERPO_001>',
    el('ORDENINTER'),
    el('CODIMOVI', opts.codimovi),
    el('DETALLE', opts.detalle),
    el('SUMAIMP', opts.sumaimp),
    el('BASE', opts.base),
    el('TIPOMOV', '2'),
    el('POR_PRE', '0'),
    el('IMPORIGEN', v.importe),
    el('ALIIVA', '0'),
    el('IVA', '0'),
    el('ALIRETENCION', '0'),
    el('RETENCION', '0'),
    el('ALIPERCEPCION', '0'),
    el('PERCEPCION', '0'),
    el('IMPTOTAL', v.importe),
    el('MONEDA', '7'),
    el('CUITCORREDOR', v.cuit),
    '</SubTask_SELECT_ENVIO_CUERPO_001>',
  ].join('\n');
}

/**
 * Build the downstream XML from spreadsheet-format records. Byte-exact: no
 * pretty-print, no reordering, no self-closing empty tags. Adjacent blocks of
 * the same kind are concatenated with no separator; a single newline splits the
 * CABEZAL group from the CUERPO group.
 */
export function buildXml(records: RetencionXmlInput[]): string {
  const values = records.map(toXmlValues);
  const n = String(records.length);

  const cabezalGroup = values.map(buildCabezal).join('');
  const cuerpoGroup = values
    .map(
      (v) =>
        buildCuerpo(v, {
          codimovi: 'RETIVA',
          detalle: v.concepto,
          sumaimp: '0',
          base: v.importe,
        }) +
        buildCuerpo(v, {
          codimovi: 'IN',
          detalle: 'Importe Neto',
          sumaimp: '1',
          base: '0',
        }),
    )
    .join('');

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<CONTENT cryp="0" size="0" dataTableNames="${DATA_TABLE_NAMES}">`,
    '<TaskDS>',
    '<SubTask_UPDATE_ENVIO_LIQUIDA_001>',
    el('affectedRows', n),
    '</SubTask_UPDATE_ENVIO_LIQUIDA_001>',
    cabezalGroup,
    cuerpoGroup,
    '<SubTask_DELETE_ENVIO_LIQUIDA_001>',
    el('affectedRows', n),
    '</SubTask_DELETE_ENVIO_LIQUIDA_001>',
    '</TaskDS>',
    '</CONTENT>',
  ].join('\n');
}

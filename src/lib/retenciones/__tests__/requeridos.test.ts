import { describe, expect, it } from 'vitest';
import type { RetencionXmlInput } from '../buildXml';
import {
  CAMPOS_REQUERIDOS_XML,
  camposFaltantes,
  registrosBloqueados,
  validarXmlInput,
} from '../requeridos';

const full: RetencionXmlInput = {
  contrato: '126080440',
  ordenInter: '62997621',
  liqCorrelDgi: '200000490345',
  fecha: '01/06/2026',
  importe: '451263,08',
  cuitCorredor: '30500120882',
  concepto: '3310-09051822',
};

describe('CAMPOS_REQUERIDOS_XML', () => {
  it('is the single list BIT needs, CONTRATO and ORDENINTER included', () => {
    expect(CAMPOS_REQUERIDOS_XML.map((c) => c.etiqueta)).toEqual([
      'LIQCORRELDGI',
      'IMPSINIVA',
      'CUITCORREDOR',
      'FECHAORIGEN',
      'CONCEPTO_RETIVA',
      'CONTRATO',
      'ORDENINTER',
    ]);
  });

  it('drives camposFaltantes without per-field ifs: every key is checked', () => {
    for (const campo of CAMPOS_REQUERIDOS_XML) {
      const missing = { ...full, [campo.key]: '' };
      expect(camposFaltantes(missing)).toEqual([campo.etiqueta]);
    }
  });
});

describe('validarXmlInput', () => {
  it('accepts a complete, valid record', () => {
    expect(validarXmlInput(full)).toEqual([]);
  });

  it('names the missing field the way BIT knows it', () => {
    expect(validarXmlInput({ ...full, ordenInter: '' })).toEqual([
      'Falta ORDENINTER: BIT rechazaría la importación',
    ]);
    expect(validarXmlInput({ ...full, contrato: '  ' })).toEqual([
      'Falta CONTRATO: BIT rechazaría la importación',
    ]);
  });

  it('rejects a CUIT that fails the mod-11 check', () => {
    expect(validarXmlInput({ ...full, cuitCorredor: '30500120883' })).toEqual([
      expect.stringMatching(/dígito verificador/),
    ]);
  });

  it('rejects a comprobante that is not a 3310', () => {
    expect(validarXmlInput({ ...full, concepto: '3320-09051822' })).toEqual([
      expect.stringMatching(/3310/),
    ]);
    expect(validarXmlInput({ ...full, concepto: '3310-123' })).toEqual([
      expect.stringMatching(/3310/),
    ]);
  });

  it('rejects an unreadable date, a zero amount and non-numeric ids', () => {
    expect(validarXmlInput({ ...full, fecha: '2026-06-01' })).toEqual([
      expect.stringMatching(/FECHAORIGEN/),
    ]);
    expect(validarXmlInput({ ...full, importe: '0,00' })).toEqual([
      expect.stringMatching(/mayor a cero/),
    ]);
    expect(validarXmlInput({ ...full, contrato: '12a' })).toEqual([
      expect.stringMatching(/CONTRATO inválido/),
    ]);
  });

  it('accepts a date cell Excel handed back as a Date', () => {
    expect(validarXmlInput({ ...full, fecha: new Date(2026, 5, 1) })).toEqual([]);
  });

  it('reports every problem of a record, not just the first', () => {
    const errores = validarXmlInput({ ...full, contrato: '', ordenInter: '', cuitCorredor: '30500120883' });
    expect(errores).toHaveLength(3);
  });
});

describe('registrosBloqueados', () => {
  it('points at the offending rows by index and leaves valid ones alone', () => {
    const bloqueados = registrosBloqueados([full, { ...full, ordenInter: '' }, full]);
    expect(bloqueados).toEqual([
      { index: 1, errores: ['Falta ORDENINTER: BIT rechazaría la importación'] },
    ]);
  });

  it('is empty for a clean batch', () => {
    expect(registrosBloqueados([full, full])).toEqual([]);
  });
});

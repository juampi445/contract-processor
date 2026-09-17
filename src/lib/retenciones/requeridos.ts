/**
 * Qué tiene que tener un registro para que el XML sea importable en BIT.
 *
 * Es la ÚNICA lista de requeridos y la única batería de validaciones de un
 * registro antes del XML. La usan los dos caminos que generan XML (PDF →
 * parse → XML y Excel completado a mano → `readXlsx` → XML), así que ninguno
 * puede ser la puerta de atrás para meter un dato sucio en BIT ni en el
 * histórico.
 *
 * Sumar o quitar un requerido es una línea en `CAMPOS_REQUERIDOS_XML`; nada
 * más abajo hace `if` por campo.
 *
 * El Excel NO pasa por acá: es un borrador de trabajo y se puede exportar
 * incompleto. Solo el XML se bloquea.
 */

import type { RetencionXmlInput } from './buildXml';
import { isValidCuit } from './cuit';
import { normalizeFecha, toCents } from './toXmlValues';

export interface CampoRequeridoXml {
  key: keyof RetencionXmlInput;
  /** El nombre con el que BIT lo conoce, para el mensaje. */
  etiqueta: string;
}

/** Los campos sin los cuales BIT rechaza la importación. */
export const CAMPOS_REQUERIDOS_XML: readonly CampoRequeridoXml[] = [
  { key: 'liqCorrelDgi', etiqueta: 'LIQCORRELDGI' },
  { key: 'importe', etiqueta: 'IMPSINIVA' },
  { key: 'cuitCorredor', etiqueta: 'CUITCORREDOR' },
  { key: 'fecha', etiqueta: 'FECHAORIGEN' },
  { key: 'concepto', etiqueta: 'CONCEPTO_RETIVA' },
  // Confirmados como obligatorios por BIT. No vienen del PDF: se completan a
  // mano en la vista previa o en el Excel.
  { key: 'contrato', etiqueta: 'CONTRATO' },
  { key: 'ordenInter', etiqueta: 'ORDENINTER' },
];

/** El comprobante 3310 con su cuerpo de 8 dígitos, como lo arma el parser. */
const CONCEPTO_3310 = /^3310-\d{8}$/;

function presente(value: string | Date | undefined | null): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  return String(value ?? '').trim().length > 0;
}

/** Etiquetas de los requeridos que faltan, en el orden de la lista. */
export function camposFaltantes(input: RetencionXmlInput): string[] {
  return CAMPOS_REQUERIDOS_XML.filter((c) => !presente(input[c.key])).map((c) => c.etiqueta);
}

/**
 * Todo lo que impide que este registro viaje en un XML: requeridos faltantes
 * y valores que BIT no aceptaría (CUIT que no pasa el módulo 11, comprobante
 * que no es 3310, fecha o importe ilegibles). Vacío = válido.
 *
 * El chequeo "retención = 5% de la base" no está acá porque necesita la base
 * imponible, que no viaja en el XML ni en el Excel: lo hace el parser sobre
 * el PDF y marca la fila como no confiable (ver `parseRetencion`).
 */
export function validarXmlInput(input: RetencionXmlInput): string[] {
  const errores = camposFaltantes(input).map(
    (etiqueta) => `Falta ${etiqueta}: BIT rechazaría la importación`,
  );

  const cuit = String(input.cuitCorredor ?? '').replace(/\D/g, '');
  if (presente(input.cuitCorredor) && !isValidCuit(cuit)) {
    errores.push(`CUITCORREDOR no pasa el dígito verificador: ${input.cuitCorredor}`);
  }

  if (presente(input.concepto) && !CONCEPTO_3310.test(String(input.concepto).trim())) {
    errores.push(`CONCEPTO_RETIVA no es un comprobante 3310: ${input.concepto}`);
  }

  if (presente(input.fecha)) {
    try {
      normalizeFecha(input.fecha);
    } catch {
      errores.push(`FECHAORIGEN inválida (dd/mm/yyyy): ${String(input.fecha)}`);
    }
  }

  if (presente(input.importe)) {
    try {
      if (/^0+$/.test(toCents(input.importe))) {
        errores.push(`IMPSINIVA debe ser mayor a cero: ${input.importe}`);
      }
    } catch {
      errores.push(`IMPSINIVA inválido: ${input.importe}`);
    }
  }

  if (presente(input.contrato) && !/^\d+$/.test(String(input.contrato).trim())) {
    errores.push(`CONTRATO inválido (solo dígitos): ${input.contrato}`);
  }
  if (presente(input.ordenInter) && !/^\d+$/.test(String(input.ordenInter).trim())) {
    errores.push(`ORDENINTER inválido (solo dígitos): ${input.ordenInter}`);
  }

  return errores;
}

/** Un registro del lote que no puede ir al XML, con el porqué. */
export interface RegistroBloqueado {
  /** Posición en el lote (0-based), para que la UI señale la fila. */
  index: number;
  errores: string[];
}

/** Los registros del lote que bloquean la exportación. Vacío = se puede. */
export function registrosBloqueados(inputs: readonly RetencionXmlInput[]): RegistroBloqueado[] {
  const bloqueados: RegistroBloqueado[] = [];
  inputs.forEach((input, index) => {
    const errores = validarXmlInput(input);
    if (errores.length > 0) bloqueados.push({ index, errores });
  });
  return bloqueados;
}

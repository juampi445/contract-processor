/**
 * Histórico: persisting the metadata of what was exported to BIT.
 *
 * Only the extracted metadata is stored. The PDF, the XLSX and the XML never
 * leave the browser — they are parsed and downloaded locally, exactly as
 * before. This module adds a row per certificate, nothing else.
 *
 * Three rules shape everything here:
 *
 *  1. It runs when an XML is GENERATED and only then, wherever it comes from
 *     (the PDF batch or a hand-completed Excel): the XML is what gets imported
 *     into BIT, so it is the moment a certificate becomes a fact. There is one
 *     function for that, `exportXmlBatch`, and both flows call it. The Excel
 *     download is a working copy and writes nothing.
 *  2. The values saved are the FINAL ones of the preview table, including the
 *     hand-typed CONTRATO — the same values that went into that XML. They are
 *     converted through `toCents`, so the stored amount is byte-for-byte the
 *     one the XML carried, never a re-parse of the PDF.
 *  3. A row is only left out for UNRELIABLE data (the 5% check failed), never
 *     for a missing label. An issuer nobody has named yet is saved with its
 *     `cuit_agente` and shows up as "sin identificar" until someone names it.
 */

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { dbErrorMessage } from '@/lib/auth/errors';
import type { Database, Json } from '@/lib/supabase/database.types';
import { downloadBlob } from './buildWorkbook';
import { buildXml, retencionesXmlFileName, type RetencionXmlInput } from './buildXml';
import { resolveEmisorNombre, type NameResolver } from './emisores';
import { registrosBloqueados, type RegistroBloqueado } from './requeridos';
import { normalizeFecha, toCents } from './toXmlValues';
import type { FileResult, RetencionRow } from './types';

const XML_MIME = 'application/xml;charset=utf-8';

type Client = SupabaseClient<Database>;

/**
 * A recognized database code gets its friendly message; anything else keeps
 * the raw one.
 *
 * The generic "probá de nuevo" is right for a form the user can retry, but the
 * histórico writes itself in the background: swallowing a schema or permission
 * error behind it leaves nobody — user or developer — with anything to act on.
 * The detail only ever reaches the person who just exported the batch.
 */
function saveErrorMessage(error: PostgrestError): string {
  console.error('[retenciones/historial]', error.code, error.message, error.details);
  const friendly = dbErrorMessage(error);
  return friendly === dbErrorMessage(null)
    ? `${error.message}${error.code ? ` (${error.code})` : ''}`
    : friendly;
}

/** One row of `public.retenciones`, in the shape `save_retenciones` expects. */
export interface HistorialRecord {
  liquidacion: string;
  liq_correl_dgi: string | null;
  emisor: string | null;
  cuit_agente: string;
  /** `yyyy-mm-dd`. */
  fecha_origen: string;
  /** Decimal string ("451263.08") — never a float, see `importeDecimal`. */
  importe: string;
  contrato: string | null;
  source_filename: string | null;
}

/**
 * `dd/mm/yyyy` (spreadsheet format) → `yyyy-mm-dd` (what a `date` column
 * takes). Throws on anything else, the same way `normalizeFecha` does at the
 * XML boundary: a row that cannot be dated must not be saved silently.
 */
export function toIsoDate(fecha: string): string {
  const m = String(fecha).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) throw new Error(`Fecha inválida: ${fecha}`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Amount → decimal string for `numeric(18,2)`, via the SAME `toCents` the XML
 * uses. Going through cents is what guarantees the stored value and the
 * exported one can never disagree, and it keeps the conversion in string
 * arithmetic: with amounts in the millions a float loses cents.
 */
export function importeDecimal(raw: string): string {
  const cents = toCents(raw).padStart(3, '0');
  return `${cents.slice(0, -2)}.${cents.slice(-2)}`;
}

/**
 * `true` when the row's DATA cannot be trusted: the retained amount is not 5%
 * of the base, so one of the two amounts was read from the wrong column and we
 * cannot tell which. Such a row may still be exported — that is the user's
 * call — but it is never written to the histórico.
 *
 * An unknown issuer is NOT unreliable: only the name is missing.
 */
export function isUnreliable(result: FileResult): boolean {
  return (result.warnings ?? []).some((w) => w.code === 'retencion_no_5pct');
}

/**
 * Certificates that may be saved: parsed cleanly and with reliable data.
 * Missing a name is not a reason to leave a certificate out of the history.
 */
export function saveableResults(results: FileResult[]): FileResult[] {
  return results.filter((r) => r.status === 'ok' && !!r.row && !isUnreliable(r));
}

/** The `buildXml` input for one preview row, with its manual edits. */
export function toXmlInput(row: RetencionRow): RetencionXmlInput {
  return {
    contrato: row.contrato,
    ordenInter: row.ordenInter,
    liqCorrelDgi: row.liqCorrelDgi,
    fecha: row.fechaOrigen,
    importe: row.impSinIva,
    cuitCorredor: row.cuitCorredor,
    concepto: row.conceptoRetIva,
  };
}

/**
 * Map the values that are about to be written into the XML to their
 * `retenciones` record.
 *
 * It takes `RetencionXmlInput` — the exact struct `buildXml` consumes — so
 * both flows that produce an XML (the PDF batch and the uploaded Excel) record
 * precisely what they exported, and neither can drift from the other.
 *
 * The name is resolved through `resolveName` (database first, then the code
 * table; see `emisores.ts`) and stored as a snapshot. Display always
 * re-resolves it live, so naming a mill later fixes old rows too.
 */
export function toHistorialRecordFromXmlInput(
  input: RetencionXmlInput,
  sourceFilename: string | null,
  resolveName: NameResolver = (cuit) => resolveEmisorNombre(cuit),
): HistorialRecord {
  return {
    liquidacion: input.concepto,
    liq_correl_dgi: input.liqCorrelDgi || null,
    emisor: resolveName(input.cuitCorredor),
    cuit_agente: input.cuitCorredor,
    // normalizeFecha first: a hand-edited Excel cell can come back as a Date.
    fecha_origen: toIsoDate(normalizeFecha(input.fecha)),
    importe: importeDecimal(input.importe),
    contrato: input.contrato || null,
    source_filename: sourceFilename,
  };
}

/** Map one preview row (with its manual edits) to its `retenciones` record. */
export function toHistorialRecord(
  result: FileResult,
  resolveName?: NameResolver,
): HistorialRecord {
  const row = result.row;
  if (!row) throw new Error('El certificado no tiene fila para guardar.');
  return toHistorialRecordFromXmlInput(toXmlInput(row), result.fileName || null, resolveName);
}

/** A liquidación of this batch that is already in the histórico. */
export interface ExistingExport {
  liquidacion: string;
  /** ISO timestamp of the last time it was exported. */
  lastExportedAt: string;
  exportCount: number;
}

/** "14/08" — how the double-load warning names the previous export date. */
export function formatDdMm(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

/**
 * Which of these liquidaciones were already exported. Read with the signed-in
 * user's client, so RLS scopes it to the company on its own; the explicit
 * `company_id` filter is there because the unique key is per company.
 */
export async function findExistingExports(
  supabase: Client,
  companyId: string,
  liquidaciones: string[],
): Promise<ExistingExport[]> {
  const unique = [...new Set(liquidaciones.filter(Boolean))];
  if (unique.length === 0) return [];

  const { data, error } = await supabase
    .from('retenciones')
    .select('liquidacion, last_exported_at, export_count')
    .eq('company_id', companyId)
    .in('liquidacion', unique);

  if (error) throw new Error(saveErrorMessage(error));

  return data.map((r) => ({
    liquidacion: r.liquidacion,
    lastExportedAt: r.last_exported_at,
    exportCount: r.export_count,
  }));
}

export interface SaveOutcome {
  /** Rows written, new and updated together. */
  saved: number;
  /** How many of those were a re-export of a liquidación already on file. */
  updated: number;
}

/**
 * Upsert the batch. The authenticated client calls `save_retenciones`, which
 * deduplicates by `(company_id, liquidacion)`: last write wins on the data
 * columns, `export_count` goes up, and `created_by` / `created_at` keep
 * pointing at whoever exported it first.
 */
export async function saveRetenciones(
  supabase: Client,
  companyId: string,
  records: HistorialRecord[],
): Promise<SaveOutcome> {
  if (records.length === 0) return { saved: 0, updated: 0 };

  const { data, error } = await supabase.rpc('save_retenciones', {
    p_company: companyId,
    p_rows: records as unknown as Json,
  });

  if (error) throw new Error(saveErrorMessage(error));

  const rows = data ?? [];
  return {
    saved: rows.length,
    updated: rows.filter((r) => r.export_count > 1).length,
  };
}

/** One certificate of a batch about to become an XML. */
export interface XmlBatchItem {
  input: RetencionXmlInput;
  /** PDF or XLSX it came from, for traceability. */
  sourceFilename: string | null;
  /**
   * `false` when the data is not reliable (see `isUnreliable`): the row goes
   * into the XML at the user's request but is not written to the histórico.
   */
  saveable: boolean;
}

/** Thrown by `exportXmlBatch` when a required field is missing: nothing was written. */
export class XmlBloqueadoError extends Error {
  constructor(public readonly bloqueados: RegistroBloqueado[]) {
    super(
      bloqueados.length === 1
        ? `No se puede generar el XML: ${bloqueados[0].errores[0]}`
        : `No se puede generar el XML: ${bloqueados.length} registros con campos faltantes o inválidos`,
    );
    this.name = 'XmlBloqueadoError';
  }
}

export interface ExportOutcome extends SaveOutcome {
  /** Rows that went into the XML but were not saved (unreliable data). */
  skipped: number;
  /** Set when the XML was downloaded but the histórico write failed. */
  saveError: string | null;
}

/**
 * THE way an XML leaves the app. "A valid XML is generated → it is recorded in
 * `retenciones`", for both flows, in one place:
 *
 *  1. every record is validated against `CAMPOS_REQUERIDOS_XML` and the BIT
 *     rules (CUIT mod-11, comprobante 3310, date, amount). One failure blocks
 *     the whole export: nothing is downloaded and nothing is saved;
 *  2. the XML is built and downloaded;
 *  3. the saveable rows are upserted. The file is already on disk by then and
 *     the database call cannot undo it, so a failed write is REPORTED in the
 *     outcome instead of thrown: the user still has their XML.
 *
 * `download` is injectable for tests.
 */
export async function exportXmlBatch(
  supabase: Client,
  companyId: string,
  items: readonly XmlBatchItem[],
  resolveName: NameResolver,
  download: (blob: Blob, filename: string) => void = downloadBlob,
): Promise<ExportOutcome> {
  const inputs = items.map((i) => i.input);

  const bloqueados = registrosBloqueados(inputs);
  if (bloqueados.length > 0) throw new XmlBloqueadoError(bloqueados);

  const xml = buildXml(inputs);
  download(new Blob([xml], { type: XML_MIME }), retencionesXmlFileName());

  const records: HistorialRecord[] = [];
  for (const item of items) {
    if (!item.saveable) continue;
    try {
      records.push(toHistorialRecordFromXmlInput(item.input, item.sourceFilename, resolveName));
    } catch {
      // A row we cannot map is left out rather than saved half-right.
    }
  }
  const skipped = items.length - records.length;

  if (records.length === 0) return { saved: 0, updated: 0, skipped, saveError: null };

  try {
    const { saved, updated } = await saveRetenciones(supabase, companyId, records);
    return { saved, updated, skipped, saveError: null };
  } catch (err) {
    return {
      saved: 0,
      updated: 0,
      skipped,
      saveError: err instanceof Error ? err.message : String(err),
    };
  }
}

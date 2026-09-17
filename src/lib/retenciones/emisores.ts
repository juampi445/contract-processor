/**
 * Identidad de los emisores (molinos): quién es el CUIT que retiene.
 *
 * La identidad vive en la base (`molinos` + `emisor_cuits`, leídos por la
 * vista `emisor_por_cuit`) y se resuelve en este orden:
 *
 *  1. la base: el usuario bautizó ese CUIT desde Configuración;
 *  2. `issuers.ts`: el molino tiene reglas propias en código y por lo tanto
 *     un nombre, aunque nadie lo haya cargado todavía;
 *  3. nada: el CUIT queda "sin identificar". El certificado se procesa y se
 *     guarda igual, con su `cuit_agente`; solo le falta la etiqueta.
 *
 * Las reglas de lectura del Nº de certificado (patterns, normalización) NO se
 * mueven acá: son reglas de BIT, no data, y siguen en `issuers.ts`.
 */

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { dbErrorMessage } from '@/lib/auth/errors';
import type { Database } from '@/lib/supabase/database.types';
import { ISSUER_NAMES } from './issuers';

type Client = SupabaseClient<Database>;

/** Solo dígitos, sin guiones ni espacios: la forma en que se guarda un CUIT. */
export function normalizeCuit(raw: string): string {
  return String(raw).replace(/\D/g, '');
}

/** `30500120882` → `30-50012088-2`, para mostrar. */
export function formatCuit(cuit: string): string {
  const d = normalizeCuit(cuit);
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : cuit;
}

/** Lo que la base sabe de un CUIT: a qué molino pertenece. */
export interface EmisorIdentity {
  molinoId: string;
  nombre: string;
}

/** `cuit → identidad`, tal como lo devuelve la vista. Puede estar vacío. */
export type EmisorMap = Readonly<Record<string, EmisorIdentity>>;

/** Una función `cuit → nombre | null`, para inyectar en quien arma registros. */
export type NameResolver = (cuit: string) => string | null;

/**
 * Nombre del molino para un CUIT, siguiendo el orden base → código → null.
 * Pura: recibe el mapa ya leído para que la resolución no dependa de I/O.
 */
export function resolveEmisorNombre(cuit: string, emisores: EmisorMap = {}): string | null {
  const key = normalizeCuit(cuit);
  return emisores[key]?.nombre ?? ISSUER_NAMES[key] ?? null;
}

/** Un `NameResolver` cerrado sobre el mapa de la base. */
export function nameResolverFrom(emisores: EmisorMap): NameResolver {
  return (cuit) => resolveEmisorNombre(cuit, emisores);
}

function toError(error: PostgrestError): Error {
  console.error('[retenciones/emisores]', error.code, error.message, error.details);
  const friendly = dbErrorMessage(error);
  return new Error(
    friendly === dbErrorMessage(null)
      ? `${error.message}${error.code ? ` (${error.code})` : ''}`
      : friendly,
  );
}

/**
 * Lee la vista para estos CUITs (o para todos, si no se pasan). La vista es
 * global y chica, así que traerla entera para el dashboard es lo normal; el
 * uploader pide solo los CUITs del lote.
 */
export async function loadEmisorMap(
  supabase: Client,
  cuits?: readonly string[],
): Promise<EmisorMap> {
  let query = supabase.from('emisor_por_cuit').select('cuit, molino_id, nombre');
  if (cuits) {
    const unique = [...new Set(cuits.map(normalizeCuit).filter((c) => c.length === 11))];
    if (unique.length === 0) return {};
    query = query.in('cuit', unique);
  }

  const { data, error } = await query;
  if (error) throw toError(error);

  const map: Record<string, EmisorIdentity> = {};
  for (const row of data) {
    map[row.cuit] = { molinoId: row.molino_id, nombre: row.nombre };
  }
  return map;
}

/** Un molino del catálogo con todos los CUITs que retienen a su nombre. */
export interface MolinoConCuits {
  id: string;
  nombre: string;
  cuits: string[];
}

/** El catálogo completo, ordenado por nombre. */
export async function loadMolinos(supabase: Client): Promise<MolinoConCuits[]> {
  const [{ data: molinos, error: e1 }, { data: cuits, error: e2 }] = await Promise.all([
    supabase.from('molinos').select('id, nombre').order('nombre'),
    supabase.from('emisor_cuits').select('cuit, molino_id').order('cuit'),
  ]);
  if (e1) throw toError(e1);
  if (e2) throw toError(e2);

  const byMolino = new Map<string, string[]>();
  for (const c of cuits) {
    const list = byMolino.get(c.molino_id) ?? [];
    list.push(c.cuit);
    byMolino.set(c.molino_id, list);
  }
  return molinos
    .map((m) => ({ id: m.id, nombre: m.nombre, cuits: byMolino.get(m.id) ?? [] }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * Un CUIT que apareció en el histórico de la empresa y que la base todavía no
 * sabe de quién es. `sugerido` es el nombre de `issuers.ts` cuando el molino
 * tiene reglas en código: se ofrece prellenado para confirmarlo con un click.
 */
export interface CuitSinIdentificar {
  cuit: string;
  /** Cuántos certificados de la empresa lo tienen como agente. */
  certificados: number;
  /** Última fecha de certificado vista, `yyyy-mm-dd`. */
  ultimaFecha: string | null;
  sugerido: string | null;
}

/**
 * Los CUITs vistos al procesar (están en `retenciones` de esta empresa) que no
 * están en `emisor_cuits`. Se lee el histórico de la empresa (RLS lo acota) y
 * se resta lo que la base ya conoce.
 */
export async function loadCuitsSinIdentificar(
  supabase: Client,
  companyId: string,
): Promise<CuitSinIdentificar[]> {
  const { data, error } = await supabase
    .from('retenciones')
    .select('cuit_agente, fecha_origen')
    .eq('company_id', companyId);
  if (error) throw toError(error);

  const seen = new Map<string, { certificados: number; ultimaFecha: string | null }>();
  for (const row of data) {
    const key = normalizeCuit(row.cuit_agente);
    const current = seen.get(key) ?? { certificados: 0, ultimaFecha: null };
    current.certificados += 1;
    if (!current.ultimaFecha || row.fecha_origen > current.ultimaFecha) {
      current.ultimaFecha = row.fecha_origen;
    }
    seen.set(key, current);
  }
  if (seen.size === 0) return [];

  const known = await loadEmisorMap(supabase, [...seen.keys()]);

  return [...seen.entries()]
    .filter(([cuit]) => !known[cuit])
    .map(([cuit, stats]) => ({
      cuit,
      ...stats,
      sugerido: ISSUER_NAMES[cuit] ?? null,
    }))
    .sort((a, b) => b.certificados - a.certificados || a.cuit.localeCompare(b.cuit));
}

/** Asocia un CUIT a un molino que ya existe (N CUITs → 1 molino). */
export async function asociarCuitAMolino(
  supabase: Client,
  cuit: string,
  molinoId: string,
): Promise<void> {
  const key = normalizeCuit(cuit);
  if (key.length !== 11) throw new Error('El CUIT tiene que tener 11 dígitos.');
  const { error } = await supabase
    .from('emisor_cuits')
    .upsert({ cuit: key, molino_id: molinoId }, { onConflict: 'cuit' });
  if (error) throw toError(error);
}

/**
 * Crea un molino nuevo y le asocia el CUIT. Si ya existe uno con ese nombre
 * (la columna es única), lo reutiliza en vez de fallar: el usuario quiso decir
 * "ese molino", no "otro con el mismo nombre".
 */
export async function crearMolinoConCuit(
  supabase: Client,
  nombre: string,
  cuit: string,
): Promise<MolinoConCuits> {
  const trimmed = nombre.trim();
  if (trimmed.length < 2) throw new Error('El nombre tiene que tener al menos 2 letras.');

  const { data: existing, error: lookupError } = await supabase
    .from('molinos')
    .select('id, nombre')
    .ilike('nombre', trimmed)
    .maybeSingle();
  if (lookupError) throw toError(lookupError);

  let molino = existing;
  if (!molino) {
    const { data, error } = await supabase
      .from('molinos')
      .insert({ nombre: trimmed })
      .select('id, nombre')
      .single();
    if (error) throw toError(error);
    molino = data;
  }

  await asociarCuitAMolino(supabase, cuit, molino.id);
  return { id: molino.id, nombre: molino.nombre, cuits: [normalizeCuit(cuit)] };
}

/** Cambia el nombre de un molino. */
export async function renombrarMolino(
  supabase: Client,
  molinoId: string,
  nombre: string,
): Promise<void> {
  const trimmed = nombre.trim();
  if (trimmed.length < 2) throw new Error('El nombre tiene que tener al menos 2 letras.');
  const { error } = await supabase
    .from('molinos')
    .update({ nombre: trimmed })
    .eq('id', molinoId);
  if (error) throw toError(error);
}

/** Desvincula un CUIT: vuelve a quedar "sin identificar". */
export async function quitarCuit(supabase: Client, cuit: string): Promise<void> {
  const { error } = await supabase.from('emisor_cuits').delete().eq('cuit', normalizeCuit(cuit));
  if (error) throw toError(error);
}

/**
 * Borra un molino y, en cascada, sus CUITs. El histórico no se toca: las
 * filas guardan `cuit_agente`, así que vuelven a mostrarse "sin identificar".
 */
export async function eliminarMolino(supabase: Client, molinoId: string): Promise<void> {
  const { error } = await supabase.from('molinos').delete().eq('id', molinoId);
  if (error) throw toError(error);
}

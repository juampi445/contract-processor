/**
 * Molinos: the master-data catalog of who a CUIT is.
 *
 * The catalog is the database, and ONLY the database: `molinos` +
 * `emisor_cuits`, read through the view `emisor_por_cuit`. A CUIT that is not
 * there is "sin identificar", full stop — there is no name anywhere in the
 * code, no fallback and no suggestion. Any cooperative starts with an empty
 * catalog and names its mills by hand, from the PDF preview, the dashboard or
 * the Molinos section.
 *
 * This module is standalone on purpose: it knows nothing about retenciones
 * (no imports from `retenciones/*`, no query on its tables), so a future
 * section — descargas, for instance — can consume the same catalog, the same
 * resolver and the same identify dialog without touching it. Which CUITs were
 * "seen" is the CONSUMER's business: it passes them in (see
 * `cuitsSinIdentificar`).
 */

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { dbErrorMessage } from '@/lib/auth/errors';
import { isValidCuit, normalizeCuit } from '@/lib/cuit';
import type { Database } from '@/lib/supabase/database.types';

export { formatCuit, normalizeCuit } from '@/lib/cuit';

type Client = SupabaseClient<Database>;

/** What the catalog knows about a CUIT: which mill it belongs to. */
export interface MolinoIdentity {
  molinoId: string;
  nombre: string;
}

/** `cuit → identity`, as the view returns it. May be empty. */
export type MolinoMap = Readonly<Record<string, MolinoIdentity>>;

/** A `cuit → nombre | null` function, to inject wherever records are built. */
export type NameResolver = (cuit: string) => string | null;

/**
 * The mill's name for a CUIT, from the catalog and nothing else. Pure: it takes
 * the already-read map so resolution never depends on I/O. Without the CUIT
 * (or without a map) it is `null`: "sin identificar".
 */
export function resolveMolinoNombre(cuit: string, molinos: MolinoMap = {}): string | null {
  return molinos[normalizeCuit(cuit)]?.nombre ?? null;
}

/** A `NameResolver` closed over the catalog map. */
export function nameResolverFrom(molinos: MolinoMap): NameResolver {
  return (cuit) => resolveMolinoNombre(cuit, molinos);
}

function toError(error: PostgrestError): Error {
  console.error('[molinos]', error.code, error.message, error.details);
  const friendly = dbErrorMessage(error);
  return new Error(
    friendly === dbErrorMessage(null)
      ? `${error.message}${error.code ? ` (${error.code})` : ''}`
      : friendly,
  );
}

/**
 * Read the view for these CUITs (or all of them when none are given). The
 * view is global and small, so reading it whole for a dashboard is normal; a
 * batch flow asks only for its own CUITs.
 */
export async function loadMolinoMap(
  supabase: Client,
  cuits?: readonly string[],
): Promise<MolinoMap> {
  let query = supabase.from('emisor_por_cuit').select('cuit, molino_id, nombre');
  if (cuits) {
    const unique = [...new Set(cuits.map(normalizeCuit).filter((c) => c.length === 11))];
    if (unique.length === 0) return {};
    query = query.in('cuit', unique);
  }

  const { data, error } = await query;
  if (error) throw toError(error);

  const map: Record<string, MolinoIdentity> = {};
  for (const row of data) {
    map[row.cuit] = { molinoId: row.molino_id, nombre: row.nombre };
  }
  return map;
}

/** A mill of the catalog with every CUIT that withholds under its name. */
export interface MolinoConCuits {
  id: string;
  nombre: string;
  cuits: string[];
}

/** The whole catalog, sorted by name. */
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
 * A CUIT some consumer has seen (on a processed certificate, a truck
 * download, …). The consumer knows where it saw it; the catalog only needs
 * the CUIT and, for display, how often and when.
 */
export interface CuitVisto {
  cuit: string;
  /** How many documents carried it. */
  vistos: number;
  /** Most recent document date, `yyyy-mm-dd`, when the consumer has one. */
  ultimaFecha: string | null;
}

/**
 * The seen CUITs the catalog does not know yet, most frequent first. Pure:
 * the consumer loads its own "seen" list and the catalog map, this function
 * only subtracts one from the other.
 */
export function cuitsSinIdentificar(
  vistos: readonly CuitVisto[],
  conocidos: MolinoMap,
): CuitVisto[] {
  return vistos
    .map((v) => ({ ...v, cuit: normalizeCuit(v.cuit) }))
    .filter((v) => v.cuit.length === 11 && !conocidos[v.cuit])
    .sort((a, b) => b.vistos - a.vistos || a.cuit.localeCompare(b.cuit));
}

function validCuitOrThrow(cuit: string): string {
  const key = normalizeCuit(cuit);
  if (!isValidCuit(key)) {
    throw new Error('El CUIT tiene que tener 11 dígitos y un dígito verificador válido.');
  }
  return key;
}

function validNombreOrThrow(nombre: string): string {
  const trimmed = nombre.trim();
  if (trimmed.length < 2) throw new Error('El nombre tiene que tener al menos 2 letras.');
  return trimmed;
}

/** Link a CUIT to an existing mill (N CUITs → 1 molino). Re-linking moves it. */
export async function asociarCuitAMolino(
  supabase: Client,
  cuit: string,
  molinoId: string,
): Promise<void> {
  const key = validCuitOrThrow(cuit);
  const { error } = await supabase
    .from('emisor_cuits')
    .upsert({ cuit: key, molino_id: molinoId }, { onConflict: 'cuit' });
  if (error) throw toError(error);
}

/**
 * Create a mill by name. If one with that name already exists (the column is
 * unique), it is reused instead of failing: the user meant "that mill", not
 * "another one with the same name".
 */
export async function crearMolino(supabase: Client, nombre: string): Promise<MolinoConCuits> {
  const trimmed = validNombreOrThrow(nombre);

  const { data: existing, error: lookupError } = await supabase
    .from('molinos')
    .select('id, nombre')
    .ilike('nombre', trimmed)
    .maybeSingle();
  if (lookupError) throw toError(lookupError);
  if (existing) return { id: existing.id, nombre: existing.nombre, cuits: [] };

  const { data, error } = await supabase
    .from('molinos')
    .insert({ nombre: trimmed })
    .select('id, nombre')
    .single();
  if (error) throw toError(error);
  return { id: data.id, nombre: data.nombre, cuits: [] };
}

/** Create a mill and link the CUIT to it in one go (the "molino nuevo" answer). */
export async function crearMolinoConCuit(
  supabase: Client,
  nombre: string,
  cuit: string,
): Promise<MolinoConCuits> {
  const key = validCuitOrThrow(cuit);
  const molino = await crearMolino(supabase, nombre);
  await asociarCuitAMolino(supabase, key, molino.id);
  return { ...molino, cuits: [key] };
}

/** Rename a mill. */
export async function renombrarMolino(
  supabase: Client,
  molinoId: string,
  nombre: string,
): Promise<void> {
  const trimmed = validNombreOrThrow(nombre);
  const { error } = await supabase
    .from('molinos')
    .update({ nombre: trimmed })
    .eq('id', molinoId);
  if (error) throw toError(error);
}

/** Unlink a CUIT: it goes back to "sin identificar". */
export async function quitarCuit(supabase: Client, cuit: string): Promise<void> {
  const { error } = await supabase.from('emisor_cuits').delete().eq('cuit', normalizeCuit(cuit));
  if (error) throw toError(error);
}

/**
 * Delete a mill and, by cascade, its CUITs. Consumers' data is untouched:
 * they keep the CUIT and simply show it as "sin identificar" again.
 */
export async function eliminarMolino(supabase: Client, molinoId: string): Promise<void> {
  const { error } = await supabase.from('molinos').delete().eq('id', molinoId);
  if (error) throw toError(error);
}

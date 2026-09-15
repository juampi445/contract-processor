import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import {
  BASE_COLUMNS,
  DEFAULT_COLUMN_NAMES,
  DEFAULT_REQUIRED_FLAGS,
  MAPPABLE_COLUMNS,
  type BaseColumn,
  type MappableColumn,
} from './sourceFields';

/**
 * Everything a user fills in on the Descargas screen, saved together: the
 * column mapping (used *before* reading the file) and the batch values
 * (shown *after*). Applying a preset sets both at once, so the batch values
 * are already waiting when their inputs appear.
 */
export interface DescargasPresetValues {
  columnNames: Record<MappableColumn, string>;
  requiredFlags: Record<MappableColumn, boolean>;
  manualValues: Partial<Record<BaseColumn, string>>;
}

export interface DescargasPreset extends DescargasPresetValues {
  id: string;
  name: string;
  updatedAt: number;
}

type Client = SupabaseClient<Database>;

const LAST_ID_KEY = 'descargas.presets.lastId';
const PRESET_COLUMNS = 'id, name, config, updated_at';

/** The preset in use last time in this company, re-applied when the page opens. */
export function loadLastPresetId(companyId: string): string | null {
  try {
    return localStorage.getItem(`${LAST_ID_KEY}.${companyId}`);
  } catch {
    return null;
  }
}

export function saveLastPresetId(companyId: string, id: string | null): void {
  try {
    const key = `${LAST_ID_KEY}.${companyId}`;
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch {
    // Remembering the last preset is a convenience; ignore storage failures.
  }
}

/** Drops empty batch values so "unset" and "blank" compare equal. */
function cleanManualValues(
  values: Partial<Record<BaseColumn, string>>,
): Partial<Record<BaseColumn, string>> {
  const out: Partial<Record<BaseColumn, string>> = {};
  for (const column of BASE_COLUMNS) {
    const value = values[column];
    if (typeof value === 'string' && value.trim() !== '') out[column] = value;
  }
  return out;
}

/**
 * Fills gaps with the defaults and discards unknown keys, so presets saved
 * before a field was added (or removed) still load cleanly.
 */
export function normalizePresetValues(
  raw: Partial<DescargasPresetValues> | undefined,
): DescargasPresetValues {
  const columnNames = { ...DEFAULT_COLUMN_NAMES };
  const requiredFlags = { ...DEFAULT_REQUIRED_FLAGS };
  for (const field of MAPPABLE_COLUMNS) {
    const name = raw?.columnNames?.[field];
    if (typeof name === 'string') columnNames[field] = name;
    const flag = raw?.requiredFlags?.[field];
    if (typeof flag === 'boolean') requiredFlags[field] = flag;
  }
  return {
    columnNames,
    requiredFlags,
    manualValues: cleanManualValues(raw?.manualValues ?? {}),
  };
}

export function presetValuesEqual(
  a: DescargasPresetValues,
  b: DescargasPresetValues,
): boolean {
  const na = normalizePresetValues(a);
  const nb = normalizePresetValues(b);
  return (
    MAPPABLE_COLUMNS.every(
      (f) =>
        na.columnNames[f] === nb.columnNames[f] &&
        na.requiredFlags[f] === nb.requiredFlags[f],
    ) && BASE_COLUMNS.every((c) => na.manualValues[c] === nb.manualValues[c])
  );
}

export function sortPresets(presets: DescargasPreset[]): DescargasPreset[] {
  return [...presets].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function fromRow(row: { id: string; name: string; config: Json; updated_at: string }): DescargasPreset {
  const config =
    row.config && typeof row.config === 'object' && !Array.isArray(row.config)
      ? (row.config as Partial<DescargasPresetValues>)
      : undefined;
  return {
    id: row.id,
    name: row.name,
    updatedAt: Date.parse(row.updated_at) || 0,
    ...normalizePresetValues(config),
  };
}

/** Presets shared by everyone in the company. Throws when the request fails. */
export async function fetchPresets(supabase: Client, companyId: string): Promise<DescargasPreset[]> {
  const { data, error } = await supabase
    .from('descargas_presets')
    .select(PRESET_COLUMNS)
    .eq('company_id', companyId);
  if (error) throw new Error(error.message);
  return sortPresets(data.map(fromRow));
}

/** Creates the preset, or overwrites it when `id` is given. Returns null on failure. */
export async function savePreset(
  supabase: Client,
  companyId: string,
  preset: { id?: string; name: string; values: DescargasPresetValues },
): Promise<DescargasPreset | null> {
  const name = preset.name.trim();
  const config = normalizePresetValues(preset.values) as unknown as Json;

  const { data, error } = preset.id
    ? await supabase
        .from('descargas_presets')
        .update({ name, config })
        .eq('id', preset.id)
        .eq('company_id', companyId)
        .select(PRESET_COLUMNS)
        .single()
    : await supabase
        .from('descargas_presets')
        .insert({ company_id: companyId, name, config })
        .select(PRESET_COLUMNS)
        .single();

  return error || !data ? null : fromRow(data);
}

export async function deletePreset(supabase: Client, companyId: string, id: string): Promise<boolean> {
  const { error, count } = await supabase
    .from('descargas_presets')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('company_id', companyId);
  return !error && count === 1;
}

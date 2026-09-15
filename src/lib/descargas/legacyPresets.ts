import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import {
  loadLastPresetId,
  normalizePresetValues,
  saveLastPresetId,
  type DescargasPresetValues,
} from './presets';

/** Where presets lived before they moved to the database (one list per browser). */
const LEGACY_PRESETS_KEY = 'descargas.presets.v1';
const LEGACY_LAST_ID_KEY = 'descargas.presets.lastId';
const MAX_NAME_LENGTH = 80;

type LegacyPreset = Partial<DescargasPresetValues> & { id: string; name: string };

/** null when there's nothing to migrate (or storage is unavailable). */
function readLegacyPresets(): LegacyPreset[] | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(LEGACY_PRESETS_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is LegacyPreset =>
        !!p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim() !== '',
    );
  } catch {
    // Unreadable data can't be recovered; dropping it avoids retrying forever.
    return [];
  }
}

function clearLegacyStorage() {
  try {
    localStorage.removeItem(LEGACY_PRESETS_KEY);
    localStorage.removeItem(LEGACY_LAST_ID_KEY);
  } catch {
    // Nothing else to do; the next attempt finds the names already imported.
  }
}

async function runMigration(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<number> {
  const legacy = readLegacyPresets();
  if (legacy === null) return 0;

  let legacyLastId: string | null = null;
  try {
    legacyLastId = localStorage.getItem(LEGACY_LAST_ID_KEY);
  } catch {
    // Optional.
  }

  const seenNames = new Set<string>();
  let imported = 0;
  let migratedLastId: string | null = null;

  for (const preset of legacy) {
    const name = preset.name.trim().slice(0, MAX_NAME_LENGTH);
    const key = name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);

    const { data, error } = await supabase
      .from('descargas_presets')
      .insert({
        company_id: companyId,
        name,
        config: normalizePresetValues(preset) as unknown as Json,
      })
      .select('id')
      .single();

    if (error) {
      // A preset with that name already exists in the company: keep theirs.
      if (error.code === '23505') continue;
      // Anything else: stop and keep localStorage so the next visit retries.
      throw new Error(error.message);
    }

    imported += 1;
    if (preset.id === legacyLastId) migratedLastId = data.id;
  }

  if (migratedLastId && !loadLastPresetId(companyId)) {
    saveLastPresetId(companyId, migratedLastId);
  }
  clearLegacyStorage();
  return imported;
}

let migration: Promise<number> | null = null;

/**
 * Moves presets saved in this browser (before multitenancy) into the current
 * company, then deletes them from localStorage. Safe to call from several
 * components at once: they share one run. Resolves to the number imported.
 */
export function migrateLegacyPresets(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<number> {
  migration ??= runMigration(supabase, companyId).catch((error: unknown) => {
    migration = null;
    throw error;
  });
  return migration;
}

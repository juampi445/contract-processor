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

const STORAGE_KEY = 'descargas.presets.v1';
const LAST_ID_KEY = 'descargas.presets.lastId';

/** The preset in use last time, re-applied when the page opens. */
export function loadLastPresetId(): string | null {
  try {
    return localStorage.getItem(LAST_ID_KEY);
  } catch {
    return null;
  }
}

export function saveLastPresetId(id: string | null): void {
  try {
    if (id) localStorage.setItem(LAST_ID_KEY, id);
    else localStorage.removeItem(LAST_ID_KEY);
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

export function loadPresets(): DescargasPreset[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is DescargasPreset =>
          !!p && typeof p.id === 'string' && typeof p.name === 'string',
      )
      .map((p) => ({
        id: p.id,
        name: p.name,
        updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : 0,
        ...normalizePresetValues(p),
      }));
  } catch {
    return [];
  }
}

/** Returns false when the browser refuses to store (private mode, quota). */
export function savePresets(presets: DescargasPreset[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    return true;
  } catch {
    return false;
  }
}

export function createPreset(
  name: string,
  values: DescargasPresetValues,
): DescargasPreset {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    updatedAt: Date.now(),
    ...normalizePresetValues(values),
  };
}

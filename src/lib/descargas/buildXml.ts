import { FIELDS, SUBTASK_NAME } from './fields';
import type { DescargaField, DescargaRow } from './types';

/** `<TAG>value</TAG>` — never self-closed, even when empty. */
const el = (tag: string, value: string): string => `<${tag}>${value}</${tag}>`;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * A field's output value: its Excel column (or `source`, for the date
 * fields) when present, otherwise the type's default — unless a
 * `fixedDefault` overrides it.
 */
function fieldValue(field: DescargaField, row: DescargaRow): string {
  if (field.type === 'blank') return ' ';

  const raw = row[field.source ?? field.tag];
  if (raw === undefined || raw.trim() === '') {
    if (field.fixedDefault !== undefined) return field.fixedDefault;
    return field.type === 'num' ? '0' : ' ';
  }
  return raw.trim();
}

function buildSubTask(row: DescargaRow): string {
  const body = FIELDS.map((f) => el(f.tag, escapeXml(fieldValue(f, row)))).join(
    '',
  );
  return `<${SUBTASK_NAME}>${body}</${SUBTASK_NAME}>`;
}

/** Build the ERP import payload: one SubTask block per row. */
export function buildDescargasXml(rows: DescargaRow[]): string {
  const body = rows.map(buildSubTask).join('');
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    `<CONTENT cryp="0" size="0" dataTableNames="${SUBTASK_NAME}">` +
    `<TaskDS>${body}</TaskDS></CONTENT>`
  );
}

/** Build a timestamped filename: `DSEND_ENVIO_DESCARGA_yyyy-MM-dd_HHmm.xml`. */
export function descargasFileName(date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `DSEND_ENVIO_DESCARGA_${stamp}.xml`;
}

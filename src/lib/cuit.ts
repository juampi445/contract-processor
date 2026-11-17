/**
 * CUIT check digit (módulo 11). Shared by every module that takes a CUIT from
 * the user or a document; the PDF-specific recognition helpers live in
 * `retenciones/cuit.ts` and build on this.
 */

const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** `true` when `digits` is 11 digits and its mod-11 check digit is correct. */
export function isValidCuit(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false;

  const sum = WEIGHTS.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  const rest = 11 - (sum % 11);
  const expected = rest === 11 ? 0 : rest === 10 ? 9 : rest;

  return expected === Number(digits[10]);
}

/** Solo dígitos, sin guiones ni espacios: la forma en que se guarda un CUIT. */
export function normalizeCuit(raw: string): string {
  return String(raw).replace(/\D/g, '');
}

/** `30500120882` → `30-50012088-2`, para mostrar. */
export function formatCuit(cuit: string): string {
  const d = normalizeCuit(cuit);
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : cuit;
}

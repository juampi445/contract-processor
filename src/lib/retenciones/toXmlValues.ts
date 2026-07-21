/**
 * Value normalization for the XML output boundary.
 *
 * The in-memory rows and the XLSX cells hold values in spreadsheet format
 * ("451263,08", "01/06/2026"). The downstream XML expects different formats
 * (cents "45126308"). Conversion happens here and only here.
 *
 * All money math is string arithmetic: never Number / parseFloat / toFixed —
 * with amounts in the millions, a float loses cents.
 */

/**
 * Amount → integer cents string, robust to any variant Excel may produce:
 * "451263,08" | "451.263,08" | "451,263.08" | "451263" → "45126308".
 * The LAST separator is treated as the decimal one.
 */
export const toCents = (raw: string): string => {
  const s = String(raw).trim().replace(/\s/g, '');
  const m = s.match(/^(.*?)([.,](\d{1,2}))?$/); // último separador = decimal
  const intPart = (m?.[1] ?? s).replace(/[^\d]/g, '');
  const decPart = (m?.[3] ?? '').padEnd(2, '0');
  if (!intPart) throw new Error(`Importe inválido: ${raw}`);
  return intPart + decPart;
};

/**
 * Validate / format a date to dd/mm/yyyy.
 * - A string must already be dd/mm/yyyy.
 * - A Date (possible when a cell was rewritten by hand in Excel) is formatted
 *   using LOCAL getters — never toISOString(), which can shift a day by TZ.
 */
export const normalizeFecha = (raw: string | Date): string => {
  if (raw instanceof Date) {
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${pad(raw.getDate())}/${pad(raw.getMonth() + 1)}/${raw.getFullYear()}`;
  }
  const s = String(raw).trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    throw new Error(`Fecha inválida: ${raw}`);
  }
  return s;
};

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/**
 * Escape a value for XML text content. All real values are digits, hyphens and
 * slashes so this should never fire — it's a safety net.
 */
export const escapeXml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);

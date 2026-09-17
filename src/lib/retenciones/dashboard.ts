/**
 * Aggregation for the histórico dashboard.
 *
 * Everything here is pure and works on plain strings and integers, so it can
 * run in the Server Component that loads the rows and be unit-tested without a
 * database.
 *
 * Two deliberate choices:
 *
 *  1. **Money is summed in cents, as integers.** `importe` arrives as a JSON
 *     number; adding hundreds of them as floats drifts. Rounding to cents once,
 *     at the boundary, and summing integers keeps every total exact.
 *  2. **Dates are handled as `yyyy-mm-dd` strings, never as `Date`.** ISO dates
 *     compare and sort lexicographically, and `new Date('2026-06-01')` is UTC
 *     midnight, which in Argentina is the previous day — that is exactly how a
 *     certificate lands in the wrong month.
 */

const MONTH_LABELS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
] as const;

/** A row of the histórico, as the dashboard consumes it. */
export interface HistorialEntry {
  id: string;
  liquidacion: string;
  liqCorrelDgi: string | null;
  emisor: string | null;
  cuitAgente: string;
  /** `yyyy-mm-dd`. */
  fechaOrigen: string;
  /** Integer cents — the only representation used for arithmetic. */
  importeCents: number;
  contrato: string | null;
  sourceFilename: string | null;
  createdAt: string;
  lastExportedAt: string;
  exportCount: number;
  /** Display name of whoever exported it first, when readable. */
  processedBy: string | null;
}

/** An inclusive `yyyy-mm-dd` range. */
export interface DateRange {
  from: string;
  to: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `yyyy-mm-dd` of a local date, without going through UTC. */
export function toIsoDay(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The range the dashboard opens on: the last 12 months, counted from the first
 * day of the month 11 months back. That is what makes the monthly chart show
 * 12 full bars instead of a truncated first one.
 */
export function defaultRange(today = new Date()): DateRange {
  const start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  return { from: toIsoDay(start), to: toIsoDay(today) };
}

/** First and last day of the month `today` falls in. */
export function currentMonthRange(today = new Date()): DateRange {
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { from: toIsoDay(from), to: toIsoDay(to) };
}

/** First and last day of the year `today` falls in. */
export function currentYearRange(today = new Date()): DateRange {
  return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
}

/**
 * Read the range off the URL, falling back to the default for anything that is
 * not a well-formed date. A reversed range is swapped rather than rejected, so
 * a hand-edited URL still renders something sensible.
 */
export function parseRange(
  from: string | undefined,
  to: string | undefined,
  today = new Date(),
): DateRange {
  const fallback = defaultRange(today);
  const validFrom = from && ISO_DATE.test(from) ? from : fallback.from;
  const validTo = to && ISO_DATE.test(to) ? to : fallback.to;
  return validFrom <= validTo
    ? { from: validFrom, to: validTo }
    : { from: validTo, to: validFrom };
}

export function inRange(entry: HistorialEntry, range: DateRange): boolean {
  return entry.fechaOrigen >= range.from && entry.fechaOrigen <= range.to;
}

export function filterByRange(
  entries: HistorialEntry[],
  range: DateRange,
): HistorialEntry[] {
  return entries.filter((e) => inRange(e, range));
}

export function sumCents(entries: HistorialEntry[]): number {
  return entries.reduce((total, e) => total + e.importeCents, 0);
}

/** `numeric(18,2)` as PostgREST sends it → integer cents. */
export function toCentsFromNumeric(value: number | string): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

/** `'2026-08-14'` → `'2026-08'`. */
export function monthKey(isoDay: string): string {
  return isoDay.slice(0, 7);
}

/** `'2026-08'` → `'ago 26'`. */
export function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  const label = MONTH_LABELS[Number(month) - 1];
  return label ? `${label} ${year.slice(2)}` : key;
}

/** Every `yyyy-mm` from `from` to `to`, inclusive, with no gaps. */
export function monthsBetween(range: DateRange): string[] {
  const [fromYear, fromMonth] = range.from.split('-').map(Number);
  const [toYear, toMonth] = range.to.split('-').map(Number);

  const months: string[] = [];
  let year = fromYear;
  let month = fromMonth;
  // Guarded so a pathological range can't spin forever.
  while ((year < toYear || (year === toYear && month <= toMonth)) && months.length < 240) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export interface MonthlyTotal {
  month: string;
  label: string;
  cents: number;
  count: number;
}

/**
 * Retenido per month across the whole range, **including months with nothing**.
 * A gap in the series is information (that month had no retenciones), so the
 * chart must show it as an empty slot, not close it up.
 */
export function monthlyTotals(
  entries: HistorialEntry[],
  range: DateRange,
): MonthlyTotal[] {
  const totals = new Map<string, { cents: number; count: number }>();
  for (const entry of entries) {
    const key = monthKey(entry.fechaOrigen);
    const current = totals.get(key) ?? { cents: 0, count: 0 };
    current.cents += entry.importeCents;
    current.count += 1;
    totals.set(key, current);
  }

  return monthsBetween(range).map((month) => ({
    month,
    label: monthLabel(month),
    cents: totals.get(month)?.cents ?? 0,
    count: totals.get(month)?.count ?? 0,
  }));
}

export interface EmisorTotal {
  /** Display label: the mill's name, or its CUIT when nobody has named it. */
  emisor: string;
  /**
   * Set when the group is an unnamed CUIT: the bar is drawn muted and links to
   * the screen where the mill can be named.
   */
  cuit: string | null;
  sinIdentificar: boolean;
  cents: number;
  count: number;
}

/** `30500120882` → `30-50012088-2`, the way a CUIT is read out loud. */
function formatCuit(cuit: string): string {
  return cuit.length === 11 ? `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}` : cuit;
}

/** The key two entries share when they are "the same emisor". */
export function emisorKey(entry: Pick<HistorialEntry, 'emisor' | 'cuitAgente'>): string {
  return entry.emisor ?? `cuit:${entry.cuitAgente}`;
}

/**
 * Retenido per mill. Entries are grouped by the RESOLVED name, which is what
 * makes several CUITs of one mill add up to one bar. A CUIT nobody has named
 * yet is its own group, labelled with the CUIT and flagged `sinIdentificar` —
 * never dropped from the total.
 */
export function totalsByEmisor(entries: HistorialEntry[]): EmisorTotal[] {
  const totals = new Map<string, EmisorTotal>();
  for (const entry of entries) {
    const key = emisorKey(entry);
    const current = totals.get(key) ?? {
      emisor: entry.emisor ?? formatCuit(entry.cuitAgente),
      cuit: entry.emisor ? null : entry.cuitAgente,
      sinIdentificar: entry.emisor === null,
      cents: 0,
      count: 0,
    };
    current.cents += entry.importeCents;
    current.count += 1;
    totals.set(key, current);
  }

  return [...totals.values()].sort(
    (a, b) => b.cents - a.cents || a.emisor.localeCompare(b.emisor, 'es'),
  );
}

export interface DashboardKpis {
  rangeCents: number;
  rangeCount: number;
  emisores: number;
  currentMonthCents: number;
  currentMonthCount: number;
}

/**
 * The KPI row. Three numbers follow the selected range; the fourth is pinned to
 * the current calendar month and says so on the card, because "lo que va del
 * mes" is the number the user actually asks for and it must not move when the
 * range changes.
 */
export function computeKpis(
  entriesInRange: HistorialEntry[],
  allEntries: HistorialEntry[],
  today = new Date(),
): DashboardKpis {
  const month = currentMonthRange(today);
  const monthEntries = filterByRange(allEntries, month);

  return {
    rangeCents: sumCents(entriesInRange),
    rangeCount: entriesInRange.length,
    emisores: new Set(entriesInRange.map(emisorKey)).size,
    currentMonthCents: sumCents(monthEntries),
    currentMonthCount: monthEntries.length,
  };
}

/**
 * Integer cents → es-AR money. Formatted by hand instead of with `Intl`:
 * the Server Component and the browser must produce the same string or React
 * reports a hydration mismatch, and Node's and the browser's ICU disagree on
 * the space after the `$`.
 */
export function formatMoney(cents: number): string {
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const units = String(Math.floor(absolute / 100));
  const decimals = String(absolute % 100).padStart(2, '0');
  const grouped = units.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}$ ${grouped},${decimals}`;
}

/** Short money for a chart axis, where the full number does not fit. */
export function formatMoneyCompact(cents: number): string {
  const units = Math.abs(cents) / 100;
  const sign = cents < 0 ? '-' : '';
  if (units >= 1_000_000) return `${sign}$${(units / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (units >= 1_000) return `${sign}$${Math.round(units / 1_000)}k`;
  return `${sign}$${Math.round(units)}`;
}

/** `'2026-08-14'` → `'14/08/2026'`, for display in the table. */
export function formatIsoDay(isoDay: string): string {
  const m = isoDay.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : isoDay;
}

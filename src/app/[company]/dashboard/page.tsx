import type { Metadata } from 'next';
import Link from 'next/link';
import { History, ReceiptText, Tag } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmisorLabel } from '@/components/RetencionesUploader/HistorialFeedback';
import { getSupabase, requireCompany } from '@/lib/auth/dal';
import { loadEmisorMap, resolveEmisorNombre } from '@/lib/retenciones/emisores';
import {
  computeKpis,
  filterByRange,
  formatIsoDay,
  formatMoney,
  monthlyTotals,
  parseRange,
  toCentsFromNumeric,
  totalsByEmisor,
  type DateRange,
  type HistorialEntry,
} from '@/lib/retenciones/dashboard';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { EmisorChart, MonthlyChart } from './charts';
import { HistorialSearch } from './historial-search';
import { RangeFilter } from './range-filter';

export const metadata: Metadata = { title: 'Dashboard' };

/** Rows shown in the recent-activity table. */
const TABLE_LIMIT = 50;

// One string literal on purpose: supabase-js parses the select at the type
// level, and a concatenated string widens to `string`, which loses the row type.
const SELECT =
  'id, liquidacion, liq_correl_dgi, emisor, cuit_agente, fecha_origen, importe, contrato, source_filename, created_at, last_exported_at, export_count, profiles(full_name, email)';

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="gap-0 p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 p-4">
      <CardTitle className="text-sm">{title}</CardTitle>
      <p className="mt-0.5 mb-3 text-xs text-muted-foreground">{description}</p>
      {children}
    </Card>
  );
}

/**
 * Shown when the company has no history at all — not merely none in the
 * selected range. The distinction matters: the table starts empty and is never
 * back-filled, so the first thing a new user sees must explain that rather than
 * look like a broken query.
 */
function EmptyHistory({ companySlug }: { companySlug: string }) {
  return (
    <Card className="items-center gap-0 p-10 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
        <History className="size-6" />
      </span>
      <CardTitle className="text-base">Todavía no hay histórico</CardTitle>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
        El histórico se llena a medida que procesás retenciones: cada vez que
        descargás el XML para importar a BIT, ese lote queda registrado acá. No
        hay carga retroactiva de lo procesado antes de esta pantalla.
      </p>
      <Button
        className="mt-5"
        render={<Link href={`/${companySlug}/retenciones`} />}
        nativeButton={false}
      >
        <ReceiptText />
        Ir a Retenciones
      </Button>
    </Card>
  );
}

function rangeLabel(range: DateRange): string {
  return `${formatIsoDay(range.from)} — ${formatIsoDay(range.to)}`;
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: SearchParams;
}) {
  const { company: slug } = await params;
  const [company, supabase, query] = await Promise.all([
    requireCompany(slug),
    getSupabase(),
    searchParams,
  ]);

  const today = new Date();
  const range = parseRange(firstParam(query.from), firstParam(query.to), today);
  const search = (firstParam(query.q) ?? '').trim();

  // One query covers both the selected range and the current month, which the
  // pinned KPI always needs. `fecha_origen` is indexed with `company_id`.
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const lowerBound = range.from < monthStart ? range.from : monthStart;
  const upperBound = range.to > monthStart ? range.to : `${monthStart.slice(0, 7)}-31`;

  const [{ data, error }, { data: oldest }, { count: totalCount }, emisores] = await Promise.all([
    supabase
      .from('retenciones')
      .select(SELECT)
      .eq('company_id', company.id)
      .gte('fecha_origen', lowerBound)
      .lte('fecha_origen', upperBound)
      .order('fecha_origen', { ascending: false }),
    // Oldest fecha on file: what the "Todo" preset has to reach back to.
    supabase
      .from('retenciones')
      .select('fecha_origen')
      .eq('company_id', company.id)
      .order('fecha_origen', { ascending: true })
      .limit(1)
      .maybeSingle(),
    // Whether there is ANY history, independent of the range.
    supabase
      .from('retenciones')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', company.id),
    // The mill catalog (global, small). Names are resolved LIVE from it, so
    // naming a mill in Configuración fixes every old row at once.
    loadEmisorMap(supabase).catch(() => ({})),
  ]);

  if (error) {
    throw new Error(`No se pudo cargar el histórico: ${error.message}`);
  }

  const entries: HistorialEntry[] = data.map((row) => ({
    id: row.id,
    liquidacion: row.liquidacion,
    liqCorrelDgi: row.liq_correl_dgi,
    // The catalog is the only source of names. The `emisor` snapshot saved
    // at export time is NOT a fallback: a CUIT the catalog does not know is
    // "sin identificar" here, exactly as it is in Configuración.
    emisor: resolveEmisorNombre(row.cuit_agente, emisores),
    cuitAgente: row.cuit_agente,
    fechaOrigen: row.fecha_origen,
    importeCents: toCentsFromNumeric(row.importe),
    contrato: row.contrato,
    sourceFilename: row.source_filename,
    createdAt: row.created_at,
    lastExportedAt: row.last_exported_at,
    exportCount: row.export_count,
    processedBy: row.profiles?.full_name || row.profiles?.email || null,
  }));

  const inRange = filterByRange(entries, range);
  const kpis = computeKpis(inRange, entries, today);
  const monthly = monthlyTotals(inRange, range);
  const byEmisor = totalsByEmisor(inRange);
  const sinIdentificar = byEmisor.filter((e) => e.sinIdentificar);
  const settingsHref = `/${company.slug}/settings#settings-molinos`;

  const needle = search.toLowerCase();
  const tableRows = (
    needle
      ? inRange.filter((e) =>
          (e.emisor ?? e.cuitAgente).toLowerCase().includes(needle),
        )
      : inRange
  ).slice(0, TABLE_LIMIT);

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="Dashboard"
        description={`Panorama general · ${company.name}`}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:py-8">
        {totalCount === 0 ? (
          <EmptyHistory companySlug={company.slug} />
        ) : (
          <>
            <RangeFilter range={range} earliest={oldest?.fecha_origen ?? null} />

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Retenido en el período"
                value={formatMoney(kpis.rangeCents)}
                hint={rangeLabel(range)}
              />
              <KpiCard
                label="Certificados"
                value={String(kpis.rangeCount)}
                hint="en el período elegido"
              />
              <KpiCard
                label="Molinos distintos"
                value={String(kpis.emisores)}
                hint="en el período elegido"
              />
              <KpiCard
                label="Retenido este mes"
                value={formatMoney(kpis.currentMonthCents)}
                hint={`${kpis.currentMonthCount} certificado${kpis.currentMonthCount === 1 ? '' : 's'} · mes actual`}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Retenido por mes"
                description={rangeLabel(range)}
              >
                <MonthlyChart data={monthly} />
              </ChartCard>
              <ChartCard
                title="Retenido por molino"
                description={
                  byEmisor.length > 8
                    ? `Top 8 de ${byEmisor.length} · ${rangeLabel(range)}`
                    : rangeLabel(range)
                }
              >
                {byEmisor.length > 0 ? (
                  <EmisorChart data={byEmisor} />
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Sin retenciones en este período.
                  </p>
                )}
                {sinIdentificar.length > 0 && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Tag className="mt-0.5 size-3.5 shrink-0 text-warning" />
                    <span>
                      {sinIdentificar.length === 1
                        ? 'Hay un molino sin identificar (barra gris). '
                        : `Hay ${sinIdentificar.length} molinos sin identificar (barras grises). `}
                      <Link
                        href={settingsHref}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        Ponerles nombre
                      </Link>
                    </span>
                  </p>
                )}
              </ChartCard>
            </section>

            <Card className="gap-0 p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <CardTitle className="text-sm">Últimas retenciones</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {tableRows.length === 0
                      ? 'Sin resultados para este filtro.'
                      : `${tableRows.length}${inRange.length > tableRows.length ? ` de ${inRange.length}` : ''} en el período`}
                  </p>
                </div>
                <HistorialSearch value={search} />
              </div>

              {tableRows.length > 0 && (
                <Table containerClassName="max-h-[520px] overflow-y-auto">
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className="hover:bg-transparent">
                      {['Fecha', 'Molino', 'Certificado', 'Liquidación'].map((h) => (
                        <TableHead
                          key={h}
                          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                        >
                          {h}
                        </TableHead>
                      ))}
                      <TableHead className="text-right text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Importe
                      </TableHead>
                      <TableHead className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Procesó
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="tabular-nums">
                          {formatIsoDay(entry.fechaOrigen)}
                        </TableCell>
                        <TableCell>
                          <EmisorLabel
                            nombre={entry.emisor}
                            cuit={entry.cuitAgente}
                            settingsHref={settingsHref}
                          />
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {entry.liqCorrelDgi ?? '—'}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {entry.liquidacion}
                          {entry.exportCount > 1 && (
                            <span
                              className="ml-1.5 text-xs text-muted-foreground"
                              title={`Exportada ${entry.exportCount} veces`}
                            >
                              ×{entry.exportCount}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(entry.importeCents)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.processedBy ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>

            <p className="text-xs text-muted-foreground">
              El histórico guarda los datos del certificado, no el documento: los
              PDF no se suben ni salen de tu navegador.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

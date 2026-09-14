'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import { Droplets } from 'lucide-react';
import { parseQuantity } from '@/lib/descargas/numbers';
import type { DescargaRow } from '@/lib/descargas/types';
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';

const kgFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const compactFormat = new Intl.NumberFormat('es-AR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const pctFormat = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const kgConfig = {
  kg: { label: 'Kg netos', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const humidityConfig = {
  humedad: { label: 'Humedad', color: 'var(--chart-2)' },
} satisfies ChartConfig;

interface DayDatum {
  key: string;
  day: string;
  fullDate: string;
  kg: number;
  trucks: number;
}

interface TruckDatum {
  index: number;
  ctg: string;
  humedad: number | null;
}

/** "ddmmyyyy" → sortable "yyyymmdd", or null when it isn't a date. */
function sortableFecha(value: string | undefined): string | null {
  const m = value?.match(/^(\d{2})(\d{2})(\d{4})$/);
  return m ? `${m[3]}${m[2]}${m[1]}` : null;
}

function TooltipBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-36 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium text-foreground">{title}</div>
      {children}
    </div>
  );
}

function TooltipRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      {color ? (
        <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      ) : (
        <span className="w-3 shrink-0" />
      )}
      <span className="font-medium text-foreground tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function ChartPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function ReviewCharts({
  rows,
  skippedRows,
  humidityFromFile,
  humidityColumnName,
}: {
  rows: DescargaRow[];
  skippedRows: number;
  /** PORHUME comes per row from the Excel (not a single batch value). */
  humidityFromFile: boolean;
  humidityColumnName: string;
}) {
  const stats = useMemo(() => {
    let totalKg = 0;
    let kgRows = 0;
    let humiditySum = 0;
    let humidityRows = 0;
    let undated = 0;
    const byDay = new Map<string, DayDatum>();
    const trucks: TruckDatum[] = [];

    rows.forEach((row, i) => {
      const kg = parseQuantity(row.TOTNETO);
      const humedad = humidityFromFile ? parseQuantity(row.PORHUME) : null;
      if (kg !== null) {
        totalKg += kg;
        kgRows += 1;
      }
      if (humedad !== null) {
        humiditySum += humedad;
        humidityRows += 1;
      }
      trucks.push({ index: i + 1, ctg: row.CTG ?? '', humedad });

      const key = sortableFecha(row.FECHA);
      if (!key) {
        undated += 1;
        return;
      }
      const day = byDay.get(key) ?? {
        key,
        day: `${key.slice(6, 8)}/${key.slice(4, 6)}`,
        fullDate: `${key.slice(6, 8)}/${key.slice(4, 6)}/${key.slice(0, 4)}`,
        kg: 0,
        trucks: 0,
      };
      day.kg += kg ?? 0;
      day.trucks += 1;
      byDay.set(key, day);
    });

    return {
      totalKg,
      trucks: rows.length,
      avgKg: kgRows > 0 ? totalKg / kgRows : null,
      avgHumidity: humidityRows > 0 ? humiditySum / humidityRows : null,
      humidityRows,
      undated,
      days: [...byDay.values()].sort((a, b) => a.key.localeCompare(b.key)),
      truckData: trucks,
    };
  }, [rows, humidityFromFile]);

  const summary: Array<[string, string]> = [
    [`${kgFormat.format(stats.totalKg)} kg`, 'netos'],
    [kgFormat.format(stats.trucks), stats.trucks === 1 ? 'camión' : 'camiones'],
    [stats.avgKg !== null ? `${kgFormat.format(stats.avgKg)} kg` : 's/d', 'por camión'],
    [
      stats.avgHumidity !== null ? `${pctFormat.format(stats.avgHumidity)} %` : 's/d',
      'humedad promedio',
    ],
    [kgFormat.format(skippedRows), skippedRows === 1 ? 'fila descartada' : 'filas descartadas'],
  ];

  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {summary.map(([value, label]) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <dt className="sr-only">{label}</dt>
            <dd className="font-semibold text-foreground">{value}</dd>
            <span className="text-muted-foreground" aria-hidden>
              {label}
            </span>
          </div>
        ))}
      </dl>

      <ChartPanel
        title="Kg netos por día"
        description={
          stats.undated > 0
            ? `Suma de TOTNETO por FECHA. ${stats.undated} fila${stats.undated === 1 ? '' : 's'} sin fecha válida no aparece${stats.undated === 1 ? '' : 'n'}.`
            : 'Suma de TOTNETO por FECHA.'
        }
      >
        {stats.days.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Ninguna fila tiene una FECHA válida para agrupar.
          </p>
        ) : (
          <ChartContainer config={kgConfig} className="aspect-auto h-56 w-full">
            <BarChart
              accessibilityLayer
              data={stats.days}
              margin={{ top: 4, left: 0, right: 4 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v: number) => compactFormat.format(v)}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  const d = payload?.[0]?.payload as DayDatum | undefined;
                  if (!active || !d) return null;
                  return (
                    <TooltipBox title={d.fullDate}>
                      <TooltipRow
                        value={`${kgFormat.format(d.kg)} kg`}
                        label="netos"
                        color="var(--color-kg)"
                      />
                      <TooltipRow
                        value={kgFormat.format(d.trucks)}
                        label={d.trucks === 1 ? 'camión' : 'camiones'}
                      />
                    </TooltipBox>
                  );
                }}
              />
              <Bar dataKey="kg" fill="var(--color-kg)" maxBarSize={24} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </ChartPanel>

      <ChartPanel
        title="Humedad por camión"
        description={
          stats.avgHumidity !== null
            ? `PORHUME de cada fila, en el orden del Excel. La línea marca el promedio (${pctFormat.format(stats.avgHumidity)} %).`
            : 'PORHUME de cada fila, en el orden del Excel.'
        }
      >
        {stats.humidityRows === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
              <Droplets className="size-4.5" />
            </span>
            <p className="text-sm font-medium text-foreground">No hay humedad por camión</p>
            <p className="max-w-[52ch] text-xs text-muted-foreground">
              {humidityFromFile && humidityColumnName.trim()
                ? `La columna «${humidityColumnName.trim()}» no tiene valores en este archivo.`
                : 'Para verla, en el paso 1 escribí cómo se llama la columna de humedad (PORHUME) en el Excel.'}
            </p>
          </div>
        ) : (
          <ChartContainer config={humidityConfig} className="aspect-auto h-56 w-full">
            <LineChart
              accessibilityLayer
              data={stats.truckData}
              margin={{ top: 16, left: 0, right: 4 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="index"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={16}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                domain={[
                  (min: number) => Math.max(0, Math.floor(min - 1)),
                  (max: number) => Math.ceil(max + 1),
                ]}
                allowDecimals={false}
                tickFormatter={(v: number) => `${v} %`}
              />
              {stats.avgHumidity !== null && (
                <ReferenceLine
                  y={stats.avgHumidity}
                  stroke="var(--muted-foreground)"
                  strokeWidth={1}
                  ifOverflow="extendDomain"
                  label={{
                    value: `Prom. ${pctFormat.format(stats.avgHumidity)} %`,
                    position: 'insideTopRight',
                    fill: 'var(--muted-foreground)',
                    fontSize: 11,
                  }}
                />
              )}
              <ChartTooltip
                cursor={{ stroke: 'var(--border)' }}
                content={({ active, payload }) => {
                  const d = payload?.[0]?.payload as TruckDatum | undefined;
                  if (!active || !d) return null;
                  return (
                    <TooltipBox title={d.ctg ? `CTG ${d.ctg}` : `Camión ${d.index}`}>
                      <TooltipRow
                        value={d.humedad !== null ? `${pctFormat.format(d.humedad)} %` : 's/d'}
                        label="humedad"
                        color="var(--color-humedad)"
                      />
                    </TooltipBox>
                  );
                }}
              />
              <Line
                dataKey="humedad"
                stroke="none"
                isAnimationActive={false}
                dot={{ r: 4, fill: 'var(--color-humedad)', stroke: 'var(--card)', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: 'var(--color-humedad)', stroke: 'var(--card)', strokeWidth: 2 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </ChartPanel>
    </div>
  );
}

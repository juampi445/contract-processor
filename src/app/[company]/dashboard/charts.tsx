'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  formatMoney,
  formatMoneyCompact,
  type EmisorTotal,
  type MonthlyTotal,
} from '@/lib/retenciones/dashboard';

/**
 * Both charts plot **cents as integers** and format on the way out. Recharts
 * only ever sees whole numbers, so no total shown here can drift from the one
 * on the KPI card above it.
 */

const monthlyConfig = {
  cents: { label: 'Retenido', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const emisorConfig = {
  cents: { label: 'Retenido', color: 'var(--chart-2)' },
} satisfies ChartConfig;

/** Tooltip body shared by both charts: the money, then the certificate count. */
function tooltipFormatter(value: unknown, _name: unknown, item: unknown): string {
  const count = (item as { payload?: { count?: number } })?.payload?.count ?? 0;
  const money = formatMoney(Number(value));
  return `${money} · ${count} certificado${count === 1 ? '' : 's'}`;
}

export function MonthlyChart({ data }: { data: MonthlyTotal[] }) {
  return (
    <ChartContainer config={monthlyConfig} className="h-[260px] w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={11}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          fontSize={11}
          tickFormatter={(value: number) => formatMoneyCompact(value)}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={tooltipFormatter} />}
        />
        <Bar dataKey="cents" fill="var(--color-cents)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

/**
 * Horizontal bars rather than a pie: mills are compared by amount, and a bar
 * length is readable at a glance where a slice angle is not — especially with
 * the long tail of small issuers this list tends to have.
 */
export function EmisorChart({ data }: { data: EmisorTotal[] }) {
  const top = data.slice(0, 8);
  return (
    <ChartContainer
      config={emisorConfig}
      className="w-full"
      style={{ height: `${Math.max(160, top.length * 38 + 40)}px` }}
    >
      <BarChart
        data={top}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          tickFormatter={(value: number) => formatMoneyCompact(value)}
        />
        <YAxis
          type="category"
          dataKey="emisor"
          tickLine={false}
          axisLine={false}
          width={110}
          fontSize={11}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={tooltipFormatter} />}
        />
        <Bar dataKey="cents" radius={[0, 4, 4, 0]}>
          {top.map((entry, index) => (
            <Cell
              key={entry.emisor}
              // An unnamed CUIT is drawn muted: it is real money, but the
              // grey says "this one still needs a name".
              fill={
                entry.sinIdentificar
                  ? 'var(--muted-foreground)'
                  : `var(--chart-${(index % 5) + 1})`
              }
              fillOpacity={entry.sinIdentificar ? 0.45 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

'use client';

import { useCallback, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  currentMonthRange,
  currentYearRange,
  defaultRange,
  type DateRange,
} from '@/lib/retenciones/dashboard';
import { cn } from '@/lib/utils';

/**
 * The range lives in the URL, not in component state: the dashboard is a
 * Server Component, so changing the range is a navigation and the new numbers
 * come back rendered. It also makes a filtered view shareable and survives a
 * refresh.
 */
export function RangeFilter({
  range,
  earliest,
}: {
  range: DateRange;
  /** Oldest fecha on file, so "Todo" covers the real history. */
  earliest: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = useCallback(
    (next: DateRange) => {
      const params = new URLSearchParams(searchParams);
      params.set('from', next.from);
      params.set('to', next.to);
      startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
    },
    [pathname, router, searchParams],
  );

  const today = new Date();
  const presets: Array<{ label: string; value: DateRange }> = [
    { label: 'Mes actual', value: currentMonthRange(today) },
    { label: 'Últimos 12 meses', value: defaultRange(today) },
    { label: 'Este año', value: currentYearRange(today) },
    {
      label: 'Todo',
      value: { from: earliest ?? '2000-01-01', to: currentYearRange(today).to },
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const active =
            preset.value.from === range.from && preset.value.to === range.to;
          return (
            <Button
              key={preset.label}
              type="button"
              size="sm"
              variant={active ? 'secondary' : 'ghost'}
              className={cn(active && 'font-medium')}
              onClick={() => apply(preset.value)}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          aria-label="Desde"
          value={range.from}
          max={range.to}
          onChange={(e) => e.target.value && apply({ ...range, from: e.target.value })}
          className="h-8 w-[9.5rem]"
        />
        <span className="text-xs text-muted-foreground">a</span>
        <Input
          type="date"
          aria-label="Hasta"
          value={range.to}
          min={range.from}
          onChange={(e) => e.target.value && apply({ ...range, to: e.target.value })}
          className="h-8 w-[9.5rem]"
        />
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}

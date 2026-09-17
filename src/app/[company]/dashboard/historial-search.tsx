'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

/** How long to wait after the last keystroke before navigating. */
const DEBOUNCE_MS = 300;

/**
 * Search by mill. Like the range, it lives in the URL so the filtered table is
 * just another render of the Server Component. The input keeps its own value
 * while typing so it never lags a round trip behind the user.
 */
export function HistorialSearch({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [text, setText] = useState(value);
  const [, startTransition] = useTransition();

  // The URL is also changed by the range presets; follow it back.
  useEffect(() => setText(value), [value]);

  const push = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams);
      if (next.trim()) params.set('q', next.trim());
      else params.delete('q');
      startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => push(text), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, value, push]);

  return (
    <div className="relative w-full sm:w-56">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Buscar molino…"
        aria-label="Buscar por molino"
        className="h-8 pl-8"
      />
    </div>
  );
}

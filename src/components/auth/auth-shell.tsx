import type { ReactNode } from 'react';
import { FileLock2 } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';

/** Two-column frame for signed-out and pre-company screens. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hidden flex-col justify-between border-r border-sidebar-border bg-sidebar p-10 lg:flex">
        <BrandMark />
        <div className="flex max-w-sm flex-col gap-6">
          <p className="text-2xl leading-snug font-semibold tracking-tight text-balance text-sidebar-foreground">
            Constancias de retención y descargas, listas para importar en el ERP.
          </p>
          <div className="flex gap-3 text-sm text-sidebar-foreground/60">
            <FileLock2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p>
              Los PDF y Excel se procesan en tu navegador. Solo guardamos la configuración de tu
              empresa.
            </p>
          </div>
        </div>
      </aside>

      <main className="flex flex-col px-4 py-6 sm:px-8">
        <BrandMark className="lg:hidden" />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          {children}
        </div>
      </main>
    </div>
  );
}

export function AuthHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

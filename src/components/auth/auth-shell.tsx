import type { ReactNode } from 'react';
import { MeshBackdrop } from '@/components/auth/mesh-backdrop';
import { BrandMark, PRODUCT_NAME } from '@/components/brand-mark';
import { cn } from '@/lib/utils';

/** Two-column frame for signed-out and pre-company screens. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <MeshBackdrop>
      {/* Square corners on purpose: the card reads as a panel cut out of the
          field, not as a floating pill. */}
      <div className="auth-rise grid min-h-dvh w-full max-w-5xl overflow-hidden sm:min-h-0 lg:h-[38rem] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <aside className="auth-glass relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
          <span
            aria-hidden
            className="auth-grain pointer-events-none absolute inset-0 opacity-[0.05]"
          />

          <BrandMark size="lg" className="relative [&>span:last-child]:text-white" />

          {/* Three children on justify-between and no auto margins: the heading
              lands in the optical middle instead of leaving a void. */}
          <h2 className="relative text-[2.75rem] leading-[1.05] font-semibold tracking-tight text-balance text-white">
            Sistema de gestión agrícola.
          </h2>

          <p className="relative text-xs text-white/45">
            © {new Date().getFullYear()} {PRODUCT_NAME}
          </p>
        </aside>

        <main className="flex min-w-0 flex-col bg-background">
          <header className="flex h-16 shrink-0 items-center border-b border-border px-6 lg:hidden">
            <BrandMark />
          </header>

          <div className="flex flex-1 flex-col justify-center overflow-y-auto overscroll-contain p-6 sm:px-12 sm:py-10">
            <div className="w-full max-w-[23rem]">{children}</div>
          </div>
        </main>
      </div>
    </MeshBackdrop>
  );
}

export function AuthHeading({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-6 flex flex-col gap-2.5">
      {Icon && (
        <span className="mb-2 grid size-11 place-items-center rounded-xl border border-border bg-card text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground">{title}</h1>
      {description && (
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

/** Quiet row under a form: the one link out of this screen. */
export function AuthFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('mt-6 border-t border-border pt-5 text-sm text-muted-foreground', className)}>
      {children}
    </div>
  );
}

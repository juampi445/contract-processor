import type { ReactNode } from 'react';

/**
 * A titled block of a settings-style page: heading and description in a left
 * column, the content on the right. Shared by Configuración and Molinos so
 * every management screen reads the same way.
 */
export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-5 border-t border-border pt-8 first:border-t-0 first:pt-0 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10"
    >
      <div>
        <h2 id={id} className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

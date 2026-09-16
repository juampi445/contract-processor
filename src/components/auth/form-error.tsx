import { TriangleAlert } from 'lucide-react';

/**
 * Form-level failure (bad credentials, server rejected the request). Field-level
 * problems stay in FieldError next to the input they belong to.
 */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="text-pretty">{children}</span>
    </p>
  );
}

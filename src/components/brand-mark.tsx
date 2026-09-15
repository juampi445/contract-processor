import { Wheat } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PRODUCT_NAME = 'Gestión de granos';

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Wheat className="size-4.5" aria-hidden />
      </span>
      <span className="text-sm font-semibold tracking-tight text-foreground">{PRODUCT_NAME}</span>
    </div>
  );
}

import { Wheat } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PRODUCT_NAME = 'Gestión de granos';

/** `lg` is for the auth panel, where the lockup carries the top of the column. */
export function BrandMark({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'lg' }) {
  const large = size === 'lg';

  return (
    <div className={cn('flex items-center', large ? 'gap-3' : 'gap-2.5', className)}>
      <span
        className={cn(
          'grid shrink-0 place-items-center bg-primary text-primary-foreground',
          large ? 'size-10 rounded-xl' : 'size-8 rounded-lg',
        )}
      >
        <Wheat className={large ? 'size-5.5' : 'size-4.5'} aria-hidden />
      </span>
      <span
        className={cn(
          'font-semibold tracking-tight text-foreground',
          large ? 'text-base' : 'text-sm',
        )}
      >
        {PRODUCT_NAME}
      </span>
    </div>
  );
}

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Primary action for the auth forms. Taller than the inputs so the CTA is the
 * clear end of the column, and it keeps its label while pending so the button
 * never changes width mid-submit.
 */
export function AuthSubmit({
  pending,
  children,
  className,
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & { pending: boolean }) {
  return (
    <Button
      type="submit"
      aria-busy={pending}
      disabled={pending || disabled}
      className={cn('mt-1 h-11 w-full text-sm', className)}
      {...props}
    >
      {pending && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
      {children}
    </Button>
  );
}

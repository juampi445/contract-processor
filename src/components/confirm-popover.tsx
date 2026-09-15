'use client';

import { useState, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';

/** Inline confirmation for destructive actions, same pattern as deleting a preset. */
export function ConfirmPopover({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  trigger: ReactElement;
  title: string;
  description?: string;
  confirmLabel: string;
  /** Resolve to true to close the popover. */
  onConfirm: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Popover open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="end" className="w-72">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          {description && (
            <PopoverDescription className="text-xs">{description}</PopoverDescription>
          )}
        </PopoverHeader>
        <div className="flex justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const done = await onConfirm();
              setPending(false);
              if (done) setOpen(false);
            }}
          >
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

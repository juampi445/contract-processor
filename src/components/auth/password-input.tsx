'use client';

import { useState, type ComponentProps, type KeyboardEvent } from 'react';
import { ArrowBigUp, Eye, EyeOff } from 'lucide-react';
import { authInputClass } from '@/components/auth/styles';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function PasswordInput({ className, onKeyUp, onBlur, ...props }: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  function handleKeyUp(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState?.('CapsLock') ?? false);
    onKeyUp?.(event);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Input
          {...props}
          type={visible ? 'text' : 'password'}
          onKeyUp={handleKeyUp}
          onBlur={(event) => {
            setCapsLock(false);
            onBlur?.(event);
          }}
          className={cn(authInputClass, 'pr-11', className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          tabIndex={-1}
          className="absolute inset-y-0 right-0 grid w-11 cursor-pointer place-items-center rounded-r-lg text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      {/* Wrong-case passwords are the most common "invalid credentials" that
          isn't actually a wrong password. */}
      {capsLock && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          <ArrowBigUp className="size-3.5 shrink-0" aria-hidden />
          Bloq Mayús está activado.
        </p>
      )}
    </div>
  );
}

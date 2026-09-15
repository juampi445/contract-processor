'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { authErrorMessage } from '@/lib/auth/errors';
import { createClient } from '@/lib/supabase/client';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get('email') ?? '').trim(),
      password: String(form.get('password') ?? ''),
    });

    if (error) {
      setError(authErrorMessage(error));
      setPending(false);
      return;
    }
    // Stay pending until the next page renders.
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            className="h-9"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </Field>

        {error && <FieldError>{error}</FieldError>}

        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Ingresar
        </Button>
      </FieldGroup>
    </form>
  );
}

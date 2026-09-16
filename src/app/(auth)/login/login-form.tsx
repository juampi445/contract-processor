'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AuthSubmit } from '@/components/auth/auth-submit';
import { FormError } from '@/components/auth/form-error';
import { PasswordInput } from '@/components/auth/password-input';
import { authInputClass } from '@/components/auth/styles';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { authErrorMessage } from '@/lib/auth/errors';
import { createClient } from '@/lib/supabase/client';

export function LoginForm({ next, defaultEmail = '' }: { next: string; defaultEmail?: string }) {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
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
      // Send the user back to the top of the form so the retry starts there.
      emailRef.current?.focus();
      return;
    }
    // Stay pending until the next page renders.
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="vos@empresa.com.ar"
            defaultValue={defaultEmail}
            required
            autoFocus
            className={authInputClass}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </Field>

        {error && <FormError>{error}</FormError>}

        <AuthSubmit pending={pending}>Ingresar</AuthSubmit>
      </FieldGroup>
    </form>
  );
}

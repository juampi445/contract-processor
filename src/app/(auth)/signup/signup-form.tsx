'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Loader2, MailCheck } from 'lucide-react';
import { AuthHeading } from '@/components/auth/auth-shell';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { authErrorMessage } from '@/lib/auth/errors';
import { createClient } from '@/lib/supabase/client';

const MIN_PASSWORD = 8;

function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Usá al menos ${MIN_PASSWORD} caracteres.`;
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) {
    return 'Combiná letras y números.';
  }
  return null;
}

export function SignupForm({ invitedEmail }: { invitedEmail: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    // An invitation only works with the invited address, so it can't be swapped.
    const email = invitedEmail || String(form.get('email') ?? '').trim().toLowerCase();
    const password = String(form.get('password') ?? '');
    const fullName = String(form.get('fullName') ?? '').trim();

    const problem = passwordProblem(password);
    setPasswordError(problem);
    if (problem) return;

    setPending(true);
    setError(null);

    const { error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // The confirmation email template appends &token_hash=...&type=email.
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=%2F`,
      },
    });

    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    // Supabase answers the same way for new and existing emails (no account enumeration).
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-6">
        <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
          <MailCheck className="size-5" aria-hidden />
        </span>
        <AuthHeading
          title="Revisá tu email"
          description={
            <>
              Te enviamos un link de confirmación a{' '}
              <span className="font-medium text-foreground">{sentTo}</span>. Abrilo desde este
              dispositivo para activar la cuenta.
            </>
          }
        />
        <Button type="button" variant="outline" size="lg" onClick={() => setSentTo(null)}>
          Usar otro email
        </Button>
      </div>
    );
  }

  return (
    <>
      <AuthHeading
        title={invitedEmail ? 'Aceptá tu invitación' : 'Creá tu cuenta'}
        description={
          invitedEmail
            ? 'Registrate con el email invitado y vas a entrar directo a la empresa.'
            : 'Después vas a poder crear tu empresa e invitar a tu equipo.'
        }
      />

      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="fullName">Nombre y apellido</FieldLabel>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              required
              maxLength={100}
              autoFocus
              className="h-9"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={invitedEmail}
              readOnly={Boolean(invitedEmail)}
              aria-describedby={invitedEmail ? 'email-help' : undefined}
              className="h-9 read-only:cursor-default read-only:text-muted-foreground read-only:focus-visible:ring-0"
            />
            {invitedEmail && (
              <FieldDescription id="email-help">
                La invitación es para este email.{' '}
                <Link
                  href="/signup"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Registrarme con otro
                </Link>
              </FieldDescription>
            )}
          </Field>
          <Field data-invalid={passwordError ? true : undefined}>
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby="password-help"
            />
            {passwordError ? (
              <FieldError id="password-help">{passwordError}</FieldError>
            ) : (
              <FieldDescription id="password-help">
                Mínimo {MIN_PASSWORD} caracteres, con letras y números.
              </FieldDescription>
            )}
          </Field>

          {error && <FieldError>{error}</FieldError>}

          <Button type="submit" size="lg" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Crear cuenta
          </Button>
        </FieldGroup>
      </form>
    </>
  );
}

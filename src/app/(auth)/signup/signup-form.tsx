'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Lock, MailCheck } from 'lucide-react';
import { AuthHeading } from '@/components/auth/auth-shell';
import { AuthSubmit } from '@/components/auth/auth-submit';
import { FormError } from '@/components/auth/form-error';
import { PasswordInput } from '@/components/auth/password-input';
import { authInputClass, authLinkClass } from '@/components/auth/styles';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { authErrorMessage } from '@/lib/auth/errors';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const MIN_PASSWORD = 8;

function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Usá al menos ${MIN_PASSWORD} caracteres.`;
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) {
    return 'Combiná letras y números.';
  }
  return null;
}

/** 0 = below the minimum, 1 = acceptable, 2 = good, 3 = strong. */
function passwordScore(password: string): number {
  if (passwordProblem(password)) return 0;
  let score = 1;
  if (password.length >= 12) score += 1;
  if (/[^a-z0-9]/i.test(password) && /[A-Z]/.test(password)) score += 1;
  return score;
}

const SCORE_LABELS = ['', 'Aceptable', 'Buena', 'Fuerte'];

/**
 * The meter and the rule it enforces share one row. As two rows they cost 53px
 * of a 528px budget, and the rule is only useful until the meter lights up.
 */
function PasswordStrength({ password }: { password: string }) {
  const score = useMemo(() => passwordScore(password), [password]);

  return (
    <div className="flex h-5 items-center gap-2.5">
      <div
        className={cn(
          'flex flex-1 gap-1 transition-opacity duration-200',
          password ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden
      >
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-200',
              score >= step ? 'bg-primary' : 'bg-border',
            )}
          />
        ))}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {password ? SCORE_LABELS[score] : `Mínimo ${MIN_PASSWORD} caracteres, con letras y números.`}
      </span>
    </div>
  );
}

export function SignupForm({ invitedEmail }: { invitedEmail: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    // An invitation only works with the invited address, so it can't be swapped.
    const email = invitedEmail || String(form.get('email') ?? '').trim().toLowerCase();
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
        <AuthHeading
          icon={MailCheck}
          title="Revisá tu email"
          description={
            <>
              Te enviamos un link de confirmación a{' '}
              <span className="font-medium text-foreground">{sentTo}</span>. Abrilo desde este
              dispositivo para activar la cuenta.
            </>
          }
        />
        <p className="-mt-2 text-sm leading-relaxed text-muted-foreground">
          Si no llega en un par de minutos, revisá el correo no deseado.
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={() => setSentTo(null)}
        >
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
            ? 'Elegí una contraseña y entrás directo a la empresa que te invitó.'
            : 'Después vas a poder crear tu empresa e invitar a tu equipo.'
        }
      />

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="fullName">Nombre y apellido</FieldLabel>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              required
              maxLength={100}
              autoFocus
              className={authInputClass}
            />
          </Field>

          <Field>
            {/* The escape hatch rides the label row instead of adding a
                description line under the field. */}
            <div className="flex items-baseline justify-between gap-3">
              <FieldLabel htmlFor="email">Email</FieldLabel>
              {invitedEmail && (
                <Link href="/signup" className={cn(authLinkClass, 'text-xs font-normal')}>
                  Usar otro
                </Link>
              )}
            </div>
            {invitedEmail ? (
              <>
                {/* Read-only rather than hidden: the invited address is the one
                    fact the user most needs to check before committing. */}
                <div className="relative">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={invitedEmail}
                    readOnly
                    className={cn(
                      authInputClass,
                      'cursor-default pr-11 text-muted-foreground focus-visible:border-input focus-visible:ring-0',
                    )}
                  />
                  <Lock
                    className="pointer-events-none absolute inset-y-0 right-3.5 my-auto size-4 text-muted-foreground"
                    aria-hidden
                  />
                </div>
              </>
            ) : (
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="vos@empresa.com.ar"
                required
                className={authInputClass}
              />
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
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                // Clear a standing error as soon as the value becomes valid, but
                // never raise a new one mid-keystroke.
                if (passwordError && !passwordProblem(event.target.value)) setPasswordError(null);
              }}
              onBlur={() => password && setPasswordError(passwordProblem(password))}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby="password-help"
            />
            {passwordError ? (
              <FieldError id="password-help">{passwordError}</FieldError>
            ) : (
              <div id="password-help">
                <PasswordStrength password={password} />
              </div>
            )}
          </Field>

          {error && <FormError>{error}</FormError>}

          <AuthSubmit pending={pending}>
            {invitedEmail ? 'Aceptar invitación' : 'Crear cuenta'}
          </AuthSubmit>
        </FieldGroup>
      </form>
    </>
  );
}

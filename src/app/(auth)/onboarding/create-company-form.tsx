'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { AuthSubmit } from '@/components/auth/auth-submit';
import { FormError } from '@/components/auth/form-error';
import { authInputClass } from '@/components/auth/styles';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { dbErrorMessage } from '@/lib/auth/errors';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const SLUG_PATTERN = '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$';

/** "Cooperativa Agrícola Ñandú" -> "cooperativa-agricola-nandu" */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export function CreateCompanyForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugValid = new RegExp(SLUG_PATTERN).test(slug);
  const slugInvalid = Boolean(slug) && !slugValid;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slugValid) return;
    setPending(true);
    setError(null);

    const { data, error } = await createClient().rpc('create_company', {
      p_name: name.trim(),
      p_slug: slug,
    });

    if (error || !data) {
      setError(dbErrorMessage(error));
      setPending(false);
      return;
    }
    router.replace(`/${data.slug}/retenciones`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="company-name">Nombre de la empresa</FieldLabel>
          <Input
            id="company-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            required
            minLength={2}
            maxLength={100}
            autoComplete="organization"
            placeholder="Cooperativa Agrícola del Sur"
            autoFocus
            className={authInputClass}
          />
        </Field>

        <Field data-invalid={slugInvalid ? true : undefined}>
          <FieldLabel htmlFor="company-slug">Dirección</FieldLabel>
          {/* Composed input: the leading slash is part of the control, not a
              separate adornment, so the whole thing focuses as one field. */}
          <div
            className={cn(
              'flex items-center rounded-lg border border-input bg-transparent transition-colors',
              'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
              'dark:bg-input/30',
              authInputClass,
              slugInvalid &&
                'border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40',
            )}
          >
            <span className="pl-3 text-sm text-muted-foreground select-none">/</span>
            <input
              id="company-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
              }}
              required
              pattern={SLUG_PATTERN}
              maxLength={40}
              spellCheck={false}
              autoCapitalize="none"
              aria-invalid={slugInvalid ? true : undefined}
              aria-describedby="company-slug-help"
              className="h-full min-w-0 flex-1 bg-transparent pl-0.5 text-base outline-none md:text-sm"
            />
            <span className="grid w-9 shrink-0 place-items-center">
              <Check
                className={cn(
                  'size-4 text-primary transition-opacity duration-200',
                  slugValid ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden
              />
            </span>
          </div>
          {/* Fixed at two lines: both messages wrap to two at this width, so
              the button below never shifts while you are typing. */}
          <FieldDescription
            id="company-slug-help"
            className={cn('min-h-[2.625rem]', slugInvalid && 'text-destructive')}
          >
            {slugInvalid
              ? 'De 3 a 40 caracteres: minúsculas, números y guiones.'
              : 'Aparece en la URL de la empresa. Podés dejar la sugerida.'}
          </FieldDescription>
        </Field>

        {error && <FormError>{error}</FormError>}

        <AuthSubmit pending={pending} disabled={!slugValid || name.trim().length < 2}>
          Crear empresa
        </AuthSubmit>
      </FieldGroup>
    </form>
  );
}

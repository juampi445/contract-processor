'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { dbErrorMessage } from '@/lib/auth/errors';
import { createClient } from '@/lib/supabase/client';

const SLUG_PATTERN = '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$';

/** "Cooperativa Agrícola Ñandú" -> "cooperativa-agricola-nandu" */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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
    <form onSubmit={onSubmit}>
      <FieldGroup>
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
            autoFocus
            className="h-9"
          />
        </Field>

        <Field data-invalid={slug && !slugValid ? true : undefined}>
          <FieldLabel htmlFor="company-slug">Dirección</FieldLabel>
          <div className="flex h-9 items-center rounded-lg border border-input bg-input/30 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <span className="pl-2.5 text-sm text-muted-foreground select-none">/</span>
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
              aria-invalid={slug && !slugValid ? true : undefined}
              aria-describedby="company-slug-help"
              className="h-full min-w-0 flex-1 bg-transparent pr-2.5 text-base outline-none md:text-sm"
            />
          </div>
          <FieldDescription id="company-slug-help">
            Aparece en la URL. De 3 a 40 caracteres: minúsculas, números y guiones.
          </FieldDescription>
        </Field>

        {error && <FieldError>{error}</FieldError>}

        <Button type="submit" size="lg" disabled={pending || !slugValid || name.trim().length < 2}>
          {pending && <Loader2 className="animate-spin" />}
          Crear empresa
        </Button>
      </FieldGroup>
    </form>
  );
}

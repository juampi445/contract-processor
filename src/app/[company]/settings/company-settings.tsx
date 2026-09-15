'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { dbErrorMessage } from '@/lib/auth/errors';
import type { CompanyMembership } from '@/lib/auth/types';
import { createClient } from '@/lib/supabase/client';

export function CompanySettings({
  company,
  canEdit,
}: {
  company: CompanyMembership;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(company.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const dirty = trimmed !== company.name;
  const valid = trimmed.length >= 2 && trimmed.length <= 100;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || !valid) return;
    setPending(true);
    setError(null);

    const { error } = await createClient()
      .from('companies')
      .update({ name: trimmed })
      .eq('id', company.id)
      .select('id')
      .single();

    setPending(false);
    if (error) {
      setError(dbErrorMessage(error));
      return;
    }
    toast.success('Nombre actualizado.');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="settings-company-name">Nombre</FieldLabel>
          <div className="flex max-w-md gap-2">
            <Input
              id="settings-company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              required
              minLength={2}
              maxLength={100}
              className="h-9"
            />
            {canEdit && (
              <Button
                type="submit"
                variant={dirty ? 'default' : 'outline'}
                disabled={!dirty || !valid || pending}
                className="h-9"
              >
                {pending && <Loader2 className="animate-spin" />}
                Guardar
              </Button>
            )}
          </div>
          {error ? (
            <FieldError>{error}</FieldError>
          ) : (
            !canEdit && <FieldDescription>Solo un dueño puede cambiar el nombre.</FieldDescription>
          )}
        </Field>

        <Field>
          <FieldTitle>Dirección</FieldTitle>
          <p className="text-sm text-foreground">/{company.slug}</p>
          <FieldDescription>Forma parte de la URL y no se puede cambiar.</FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}

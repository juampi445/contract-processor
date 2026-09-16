'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { CompanyAvatar } from '@/components/company-avatar';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldTitle } from '@/components/ui/field';
import { dbErrorMessage } from '@/lib/auth/errors';
import type { CompanyMembership } from '@/lib/auth/types';
import { LOGO_ACCEPT, LOGO_BUCKET, logoObjectPath, logoProblem } from '@/lib/company-logo';
import { createClient } from '@/lib/supabase/client';

export function CompanyLogoField({
  company,
  canEdit,
}: {
  company: CompanyMembership;
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<'upload' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared right away so picking the same file twice still fires onChange.
    event.target.value = '';
    if (!file) return;

    const problem = logoProblem(file);
    if (problem) {
      setError(problem);
      return;
    }

    setPending('upload');
    setError(null);
    const supabase = createClient();
    const path = logoObjectPath(company.id, file);

    const { error: uploadError } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    if (uploadError) {
      setError('No se pudo subir la imagen. Probá de nuevo.');
      setPending(null);
      return;
    }

    const { error: dbError } = await supabase
      .from('companies')
      .update({ logo_path: path })
      .eq('id', company.id)
      .select('id')
      .single();
    if (dbError) {
      // The row still points at the old logo, so this upload is an orphan.
      await supabase.storage.from(LOGO_BUCKET).remove([path]);
      setError(dbErrorMessage(dbError));
      setPending(null);
      return;
    }

    // Only once the row points elsewhere is the previous file safe to drop.
    if (company.logoPath) await supabase.storage.from(LOGO_BUCKET).remove([company.logoPath]);

    setPending(null);
    toast.success('Logo actualizado.');
    router.refresh();
  }

  async function onRemove() {
    if (!company.logoPath) return;
    setPending('remove');
    setError(null);
    const supabase = createClient();

    const { error: dbError } = await supabase
      .from('companies')
      .update({ logo_path: null })
      .eq('id', company.id)
      .select('id')
      .single();
    if (dbError) {
      setError(dbErrorMessage(dbError));
      setPending(null);
      return;
    }

    await supabase.storage.from(LOGO_BUCKET).remove([company.logoPath]);
    setPending(null);
    toast.success('Logo eliminado.');
    router.refresh();
  }

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldTitle>Logo</FieldTitle>

      <div className="flex items-center gap-4">
        <CompanyAvatar name={company.name} logoPath={company.logoPath} size="xl" />

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={LOGO_ACCEPT}
              onChange={onPick}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
            />
            <Button
              type="button"
              variant="outline"
              className="h-9"
              disabled={pending !== null}
              onClick={() => inputRef.current?.click()}
            >
              {pending === 'upload' ? <Loader2 className="animate-spin" /> : <Upload />}
              {company.logoPath ? 'Cambiar' : 'Subir logo'}
            </Button>

            {company.logoPath && (
              <Button
                type="button"
                variant="ghost"
                className="h-9 text-muted-foreground"
                disabled={pending !== null}
                onClick={onRemove}
              >
                {pending === 'remove' ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Quitar
              </Button>
            )}
          </div>
        )}
      </div>

      {error ? (
        <FieldError>{error}</FieldError>
      ) : (
        <FieldDescription>
          {canEdit
            ? 'PNG, JPG, WebP o SVG, hasta 2 MB. Se muestra cuadrado, así que conviene una imagen centrada.'
            : 'Solo un dueño puede cambiar el logo.'}
        </FieldDescription>
      )}
    </Field>
  );
}

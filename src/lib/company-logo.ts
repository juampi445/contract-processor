import { SUPABASE_URL } from '@/lib/supabase/env';

export const LOGO_BUCKET = 'company-logos';
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
export const LOGO_ACCEPT = LOGO_MIME_TYPES.join(',');

/** The bucket is public, so the object path is all we need to render it. */
export function companyLogoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${path}`;
}

/** Mirrors what the bucket enforces, so the user hears about it before uploading. */
export function logoProblem(file: File): string | null {
  if (!LOGO_MIME_TYPES.includes(file.type)) return 'Tiene que ser PNG, JPG, WebP o SVG.';
  if (file.size > LOGO_MAX_BYTES) return 'La imagen no puede pesar más de 2 MB.';
  return null;
}

/**
 * A fresh name on every upload. Replacing a logo therefore changes its URL,
 * so a cached copy is never served in place of the new one and the file can be
 * stored with a long cache lifetime.
 */
export function logoObjectPath(companyId: string, file: File): string {
  const extension =
    file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4) || 'png';
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${companyId}/${unique}.${extension}`;
}

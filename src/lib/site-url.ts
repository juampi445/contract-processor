/**
 * Public base URL of the app, from configuration. Links in emails use this
 * instead of the request's Host header, which a client can forge.
 */
export function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) throw new Error('Falta la variable de entorno NEXT_PUBLIC_SITE_URL.');
  return url.replace(/\/+$/, '');
}

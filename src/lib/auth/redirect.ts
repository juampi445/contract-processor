/**
 * Only same-origin paths are allowed as post-login destinations, so a crafted
 * `?next=https://evil.com` (or `//evil.com`) can't turn login into an open redirect.
 */
export function safeNextPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}

/**
 * Shared class strings for the auth screens. Kept in a leaf module so client
 * forms can import them without pulling the server-rendered shell into their
 * bundle.
 */

/** Input sizing for the auth forms: 40px, comfortable on touch. */
export const authInputClass = 'h-10';

/** Inline text link with the underline behaviour used across the auth screens. */
export const authLinkClass =
  'rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50';

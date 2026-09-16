import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { SUPABASE_URL } from './env';

/**
 * Privileged client: it bypasses RLS completely.
 *
 * Three rules keep this safe, and none of them rely on remembering:
 *  1. `server-only` above. Importing this from a client component fails the
 *     build instead of shipping the key to the browser.
 *  2. It is used for exactly one operation, creating the auth user of an
 *     invited member. It never reads or writes companies, memberships or
 *     invitations, so tenant authorization stays entirely in RLS.
 *  3. The caller must have already proven, via an invitation token, which
 *     email it is allowed to act on. The email never comes from user input.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      'Falta la variable de entorno SUPABASE_SECRET_KEY. Cargala en .env.local y en Vercel.',
    );
  }

  return createClient<Database>(SUPABASE_URL, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

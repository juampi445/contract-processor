import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env';

/**
 * Browser client. Uses the signed-in user's session, so every query is
 * filtered by the RLS policies in the database.
 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}

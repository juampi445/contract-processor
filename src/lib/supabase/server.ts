import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env';

/** Server client for Server Components and Route Handlers, bound to the request cookies. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components can't write cookies; the proxy refreshes the session.
        }
      },
    },
  });
}

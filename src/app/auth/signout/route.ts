import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Clears a session the Auth server no longer accepts. A valid session is left
 * alone, so a link to this URL can't sign anyone out.
 */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) redirect('/');

  // Local scope: just drop the cookies, the server already rejects the token.
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/login');
}

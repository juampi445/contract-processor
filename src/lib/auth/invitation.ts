import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { MemberRole } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PendingInvitation {
  token: string;
  email: string;
  role: MemberRole;
  companyName: string;
  companySlug: string;
}

/**
 * Resolves an invitation link. Uses the anon client on purpose: the
 * `invitation_by_token` function is SECURITY DEFINER and exposes only these
 * four fields, so this path needs no privileged key.
 *
 * Returns null for anything that is not a live invitation, which is what the
 * pages render as "the invitation is no longer available".
 */
export async function getInvitationByToken(
  token: string | null | undefined,
): Promise<PendingInvitation | null> {
  if (!token || !UUID.test(token)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('invitation_by_token', { p_token: token });
  const row = data?.[0];
  if (error || !row) return null;

  return {
    token,
    email: row.email,
    role: row.role === 'owner' ? 'owner' : 'member',
    companyName: row.company_name,
    companySlug: row.company_slug,
  };
}

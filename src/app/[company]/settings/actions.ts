'use server';

import { getCurrentUser, getProfile, getSupabase } from '@/lib/auth/dal';
import { dbErrorMessage } from '@/lib/auth/errors';
import type { MemberRole } from '@/lib/auth/types';
import { invitationEmail } from '@/lib/email/invitation-email';
import { sendEmail } from '@/lib/email/resend';
import { siteUrl } from '@/lib/site-url';

export type InvitationActionResult =
  | { ok: true; email: string; emailSent: boolean }
  | { ok: false; error: string };

const SESSION_EXPIRED = 'Tu sesión venció. Ingresá de nuevo.';

async function deliverInvitation(invitation: {
  id: string;
  company_id: string;
  email: string;
  role: MemberRole;
}): Promise<boolean> {
  const supabase = await getSupabase();
  const [profile, { data: company }] = await Promise.all([
    getProfile(),
    supabase.from('companies').select('name').eq('id', invitation.company_id).single(),
  ]);

  const base = siteUrl();
  const message = invitationEmail({
    companyName: company?.name ?? 'una empresa',
    inviterName: profile.fullName || profile.email,
    role: invitation.role,
    // The token is the whole link: it names the company on the page, pins the
    // address, and lets the account skip email confirmation.
    acceptUrl: `${base}/signup?invite=${encodeURIComponent(invitation.id)}`,
    loginUrl: `${base}/login?invite=${encodeURIComponent(invitation.id)}`,
  });

  const result = await sendEmail({ to: invitation.email, ...message });
  return result.ok;
}

/**
 * Creates (or refreshes) an invitation and emails it. Permission is enforced
 * by the invite_member database function, which runs as the signed-in user.
 */
export async function inviteMemberAction(
  companyId: string,
  email: string,
  role: MemberRole,
): Promise<InvitationActionResult> {
  if (typeof companyId !== 'string' || typeof email !== 'string') {
    return { ok: false, error: dbErrorMessage(null) };
  }
  if (role !== 'owner' && role !== 'member') {
    return { ok: false, error: dbErrorMessage({ message: 'invalid_role', code: '' }) };
  }
  if (!(await getCurrentUser())) return { ok: false, error: SESSION_EXPIRED };

  const supabase = await getSupabase();
  const { data: invitation, error } = await supabase.rpc('invite_member', {
    p_company: companyId,
    p_email: email,
    p_role: role,
  });
  if (error || !invitation) return { ok: false, error: dbErrorMessage(error) };

  const emailSent = await deliverInvitation(invitation);
  return { ok: true, email: invitation.email, emailSent };
}

/** Sends the email again. RLS only returns the invitation to owners of its company. */
export async function resendInvitationAction(invitationId: string): Promise<InvitationActionResult> {
  if (typeof invitationId !== 'string') return { ok: false, error: dbErrorMessage(null) };
  if (!(await getCurrentUser())) return { ok: false, error: SESSION_EXPIRED };

  const supabase = await getSupabase();
  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, company_id, email, role')
    .eq('id', invitationId)
    .maybeSingle();
  if (!invitation) {
    return { ok: false, error: dbErrorMessage({ message: 'not_allowed', code: '42501' }) };
  }

  const emailSent = await deliverInvitation(invitation);
  if (!emailSent) {
    return { ok: false, error: 'No pudimos enviar el email. Probá de nuevo en unos minutos.' };
  }
  return { ok: true, email: invitation.email, emailSent };
}

'use server';

import { getInvitationByToken } from '@/lib/auth/invitation';
import { createAdminClient } from '@/lib/supabase/admin';

export type AcceptInvitationResult =
  | { ok: true; email: string }
  | { ok: false; error: string; alreadyRegistered?: boolean };

const MIN_PASSWORD = 8;

/**
 * Creates the account of an invited member and skips email confirmation.
 *
 * Skipping it is sound because the invitation was emailed to that address and
 * the token only reaches whoever opened it, so the address is already proven.
 * That is what removes the second email from the flow.
 *
 * This is a public endpoint: anyone can POST to it with no session. It is safe
 * because the address is read from the invitation the token resolves to and
 * never from the request. A caller holding a token can only create the account
 * for the address that token was sent to, which is exactly what the normal
 * flow already allowed.
 */
export async function acceptInvitationAction(
  token: string,
  fullName: string,
  password: string,
): Promise<AcceptInvitationResult> {
  if (typeof token !== 'string' || typeof password !== 'string' || typeof fullName !== 'string') {
    return { ok: false, error: 'No pudimos completar el registro. Probá de nuevo.' };
  }
  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.` };
  }

  const invitation = await getInvitationByToken(token);
  if (!invitation) {
    return {
      ok: false,
      error: 'Esta invitación ya no está disponible. Pedile al dueño que te invite de nuevo.',
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    // Deliberately the invitation's address, never anything the caller sent.
    email: invitation.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName.trim().slice(0, 100) },
  });

  if (error) {
    // Already has an account: signing in is enough, the membership is granted
    // by accept_pending_invitations once they land.
    if (error.code === 'email_exists' || error.status === 422) {
      return {
        ok: false,
        alreadyRegistered: true,
        error: 'Ya existe una cuenta con este email. Ingresá y vas a ver la empresa.',
      };
    }
    console.error('[signup/accept-invitation]', error.code ?? error.message);
    return { ok: false, error: 'No pudimos crear la cuenta. Probá de nuevo en un momento.' };
  }

  return { ok: true, email: invitation.email };
}

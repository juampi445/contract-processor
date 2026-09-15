import type { EmailOtpType } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { safeNextPath } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/server';

const EMAIL_OTP_TYPES: EmailOtpType[] = ['email', 'signup', 'invite', 'magiclink', 'recovery', 'email_change'];

/**
 * Target of the links in Supabase auth emails. Accepts both shapes:
 * - `?token_hash=...&type=email` when the email template builds the link itself.
 * - `?code=...` (PKCE) when the template uses the default {{ .ConfirmationURL }}.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  const supabase = await createClient();
  let failure: string | null = 'missing_token';

  if (tokenHash && type && EMAIL_OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    failure = error ? (error.code ?? error.message) : null;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failure = error ? (error.code ?? error.message) : null;
  }

  if (!failure) redirect(next);

  console.error(`[auth/confirm] link rejected: ${failure}`);
  redirect('/login?error=link');
}

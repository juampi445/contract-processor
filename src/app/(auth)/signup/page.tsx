import type { Metadata } from 'next';
import Link from 'next/link';
import { MailWarning } from 'lucide-react';
import { AuthFooter, AuthHeading } from '@/components/auth/auth-shell';
import { authLinkClass } from '@/components/auth/styles';
import { Button } from '@/components/ui/button';
import { getInvitationByToken } from '@/lib/auth/invitation';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { SignupForm } from './signup-form';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  // `invite` is the current link. `email` is what invitations sent before this
  // change carry, and it keeps working: those still open a locked-email form,
  // just without the company name and without skipping the confirmation email.
  const inviteToken = firstParam(params.invite);
  const invitation = await getInvitationByToken(inviteToken);
  const legacyEmail = firstParam(params.email)?.trim().toLowerCase() ?? '';

  // Arriving with a token that resolves to nothing means the invitation was
  // already used or withdrawn. Saying so beats dropping the person into the
  // generic form, whose copy talks about creating a company of their own.
  if (inviteToken && !invitation) {
    return (
      <>
        <AuthHeading
          icon={MailWarning}
          title="Esta invitación ya no está disponible"
          description="Puede que ya la hayas usado o que la hayan dado de baja. Si ya tenés cuenta, ingresá: si la invitación sigue en pie, vas a ver la empresa al entrar."
        />
        <Button render={<Link href="/login" />} size="lg" className="h-11 w-full">
          Ir a ingresar
        </Button>
      </>
    );
  }

  return (
    <>
      <SignupForm invitation={invitation} legacyEmail={legacyEmail} />

      <AuthFooter>
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className={authLinkClass}>
          Ingresá
        </Link>
      </AuthFooter>
    </>
  );
}

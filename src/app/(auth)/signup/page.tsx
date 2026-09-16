import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthFooter } from '@/components/auth/auth-shell';
import { authLinkClass } from '@/components/auth/styles';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { SignupForm } from './signup-form';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const invitedEmail = firstParam(params.email)?.trim().toLowerCase() ?? '';

  return (
    <>
      <SignupForm invitedEmail={invitedEmail} />

      <AuthFooter>
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className={authLinkClass}>
          Ingresá
        </Link>
      </AuthFooter>
    </>
  );
}

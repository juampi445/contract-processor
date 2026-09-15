import type { Metadata } from 'next';
import Link from 'next/link';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { SignupForm } from './signup-form';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const invitedEmail = firstParam(params.email)?.trim().toLowerCase() ?? '';

  return (
    <>
      <SignupForm invitedEmail={invitedEmail} />

      <p className="mt-8 text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{' '}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Ingresá
        </Link>
      </p>
    </>
  );
}

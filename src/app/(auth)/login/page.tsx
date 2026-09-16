import type { Metadata } from 'next';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { AuthFooter, AuthHeading } from '@/components/auth/auth-shell';
import { authLinkClass } from '@/components/auth/styles';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { safeNextPath } from '@/lib/auth/redirect';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Ingresar' };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(firstParam(params.next));
  const linkError = firstParam(params.error) === 'link';

  return (
    <>
      <AuthHeading
        title="Ingresá a tu cuenta"
        description="Usá el email con el que te registraste o con el que te invitaron."
      />

      {linkError && (
        <Alert variant="destructive" className="mb-6">
          <TriangleAlert />
          <AlertTitle>El link no es válido</AlertTitle>
          <AlertDescription>
            Venció o ya se usó. Si ya confirmaste tu email, ingresá con tu contraseña.
          </AlertDescription>
        </Alert>
      )}

      <LoginForm next={next} />

      <AuthFooter>
        ¿No tenés cuenta?{' '}
        <Link href="/signup" className={authLinkClass}>
          Creá una
        </Link>
      </AuthFooter>
    </>
  );
}

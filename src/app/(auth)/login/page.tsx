import type { Metadata } from 'next';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { AuthHeading } from '@/components/auth/auth-shell';
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
      <AuthHeading title="Ingresá a tu cuenta" />

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

      <p className="mt-8 text-sm text-muted-foreground">
        ¿No tenés cuenta?{' '}
        <Link
          href="/signup"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Creá una
        </Link>
      </p>
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthHeading } from '@/components/auth/auth-shell';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { getMyCompanies, getProfile } from '@/lib/auth/dal';
import { CreateCompanyForm } from './create-company-form';

export const metadata: Metadata = { title: 'Crear empresa' };

export default async function OnboardingPage() {
  const [profile, companies] = await Promise.all([getProfile(), getMyCompanies()]);
  const firstCompany = companies.length === 0;

  return (
    <>
      <AuthHeading
        title={firstCompany ? 'Creá tu empresa' : 'Creá otra empresa'}
        description="Vas a quedar como dueño y vas a poder invitar a tu equipo."
      />

      <CreateCompanyForm />

      <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
        {firstCompany ? (
          <p>
            ¿Te invitaron a una empresa? Pedile al dueño que invite a{' '}
            <span className="font-medium text-foreground">{profile.email}</span> y{' '}
            <Link href="/" className="font-medium text-foreground underline-offset-4 hover:underline">
              volvé a revisar
            </Link>
            .
          </p>
        ) : (
          <Link
            href="/select-company"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Volver a mis empresas
          </Link>
        )}
        <SignOutButton size="sm" className="-ml-2 self-start text-muted-foreground" />
      </div>
    </>
  );
}

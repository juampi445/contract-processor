import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AuthFooter, AuthHeading } from '@/components/auth/auth-shell';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { authLinkClass } from '@/components/auth/styles';
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
        description={
          firstCompany
            ? 'Vas a quedar como dueño y vas a poder invitar a tu equipo cuando quieras.'
            : 'Vas a quedar como dueño. Tus otras empresas siguen donde estaban.'
        }
      />

      <CreateCompanyForm />

      <AuthFooter className="flex flex-col gap-4">
        {firstCompany ? (
          <p className="leading-relaxed text-pretty">
            ¿Te invitaron? Pedile al dueño que invite a{' '}
            <span className="font-medium wrap-anywhere text-foreground">{profile.email}</span> y{' '}
            <Link href="/" className={authLinkClass}>
              volvé a revisar
            </Link>
            .
          </p>
        ) : (
          <Link href="/select-company" className={`${authLinkClass} inline-flex items-center gap-1.5`}>
            <ArrowLeft className="size-4" aria-hidden />
            Volver a mis empresas
          </Link>
        )}
        <SignOutButton size="sm" className="-ml-2.5 self-start text-muted-foreground" />
      </AuthFooter>
    </>
  );
}

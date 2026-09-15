import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight, Plus } from 'lucide-react';
import { AuthHeading } from '@/components/auth/auth-shell';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { getMyCompanies } from '@/lib/auth/dal';
import { ROLE_LABELS } from '@/lib/auth/types';
import { initials } from '@/lib/initials';

export const metadata: Metadata = { title: 'Elegir empresa' };

export default async function SelectCompanyPage() {
  const companies = await getMyCompanies();
  if (companies.length === 0) redirect('/onboarding');

  return (
    <>
      <AuthHeading title="Elegí una empresa" />

      <ul className="flex flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10">
        {companies.map((company) => (
          <li key={company.id} className="border-b border-border last:border-b-0">
            <Link
              href={`/${company.slug}/retenciones`}
              className="group flex items-center gap-3 bg-card px-3 py-3 transition-colors outline-none hover:bg-muted focus-visible:bg-muted"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground">
                {initials(company.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {company.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {ROLE_LABELS[company.role]}
                </span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between">
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          <Plus className="size-4" />
          Crear otra empresa
        </Link>
        <SignOutButton size="sm" className="text-muted-foreground" />
      </div>
    </>
  );
}

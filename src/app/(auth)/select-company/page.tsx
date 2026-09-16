import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight, Plus } from 'lucide-react';
import { AuthFooter, AuthHeading } from '@/components/auth/auth-shell';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { CompanyAvatar } from '@/components/company-avatar';
import { authLinkClass } from '@/components/auth/styles';
import { getMyCompanies } from '@/lib/auth/dal';
import { ROLE_LABELS } from '@/lib/auth/types';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Elegir empresa' };

/** Past this many the list scrolls instead of stretching the card. */
const VISIBLE_COMPANIES = 4;

export default async function SelectCompanyPage() {
  const companies = await getMyCompanies();
  if (companies.length === 0) redirect('/onboarding');

  const scrolls = companies.length > VISIBLE_COMPANIES;

  return (
    <>
      <AuthHeading
        title="Elegí una empresa"
        description="Podés cambiar de empresa en cualquier momento desde el menú lateral."
      />

      <ul
        className={cn(
          'flex flex-col gap-2',
          // Negative margins with matching padding: the box grows past the
          // column so the focus ring is not clipped and the scrollbar lands in
          // the slack to the right, leaving the cards at full width.
          scrolls &&
            'max-h-[21rem] overflow-y-auto overscroll-contain scroll-py-1 -my-1 py-1 -ml-1 pl-1 -mr-3 pr-3',
        )}
      >
        {companies.map((company) => (
          <li key={company.id}>
            <Link
              href={`/${company.slug}/retenciones`}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors outline-none hover:border-primary/40 hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <CompanyAvatar name={company.name} logoPath={company.logoPath} size="lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {company.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {ROLE_LABELS[company.role]} · /{company.slug}
                </span>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>

      <AuthFooter className="flex items-center justify-between gap-4">
        <Link href="/onboarding" className={`${authLinkClass} inline-flex items-center gap-1.5`}>
          <Plus className="size-4" aria-hidden />
          Crear otra empresa
        </Link>
        <SignOutButton size="sm" className="-mr-2.5 text-muted-foreground" />
      </AuthFooter>
    </>
  );
}

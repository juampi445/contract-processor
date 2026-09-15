import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LAST_COMPANY_COOKIE } from '@/components/company-provider';
import { getMyCompanies, getSupabase, requireUser } from '@/lib/auth/dal';

/** Decides where a signed-in user lands. */
export default async function Home() {
  await requireUser();

  // Turn pending invitations for this (confirmed) email into memberships first.
  const supabase = await getSupabase();
  await supabase.rpc('accept_pending_invitations');

  const companies = await getMyCompanies();
  if (companies.length === 0) redirect('/onboarding');
  if (companies.length === 1) redirect(`/${companies[0].slug}/retenciones`);

  const last = (await cookies()).get(LAST_COMPANY_COOKIE)?.value;
  const remembered = companies.find((c) => c.slug === last);
  if (remembered) redirect(`/${remembered.slug}/retenciones`);

  redirect('/select-company');
}

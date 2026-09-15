import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { CompanyMembership, CurrentProfile } from './types';

/**
 * Data access layer for Server Components. Every helper is memoized per
 * request, so a layout and its page can both call them without extra queries.
 * Authorization is still enforced by RLS; these checks decide what to render.
 */
export const getSupabase = cache(createClient);

/**
 * Session user confirmed by the Supabase Auth server, or null. Asking the
 * server (instead of only checking the JWT) rejects deleted or banned users
 * right away, not when their token expires.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? '' };
});

export const requireUser = cache(async () => {
  const user = await getCurrentUser();
  if (user) return user;

  // A cookie the Auth server no longer accepts (e.g. the user was deleted):
  // clear it, otherwise the proxy keeps treating the browser as signed in.
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getClaims();
  redirect(data?.claims ? '/auth/signout' : '/login');
});

export const getProfile = cache(async (): Promise<CurrentProfile> => {
  const user = await requireUser();
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', user.id)
    .maybeSingle();
  return {
    id: user.id,
    email: data?.email ?? user.email,
    fullName: data?.full_name ?? null,
  };
});

export const getMyCompanies = cache(async (): Promise<CompanyMembership[]> => {
  const user = await requireUser();
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('memberships')
    .select('role, companies!inner(id, slug, name)')
    .eq('user_id', user.id);
  if (error) throw new Error(`No se pudieron cargar las empresas: ${error.message}`);
  return data
    .map((m) => ({ ...m.companies, role: m.role }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
});

/** The company in the URL, only if the user belongs to it; otherwise 404. */
export const requireCompany = cache(async (slug: string): Promise<CompanyMembership> => {
  const companies = await getMyCompanies();
  const company = companies.find((c) => c.slug === slug);
  if (!company) notFound();
  return company;
});

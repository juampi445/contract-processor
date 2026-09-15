import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/page-header';
import { getSupabase, requireCompany, requireUser } from '@/lib/auth/dal';
import { CompanySettings } from './company-settings';
import { MembersSettings, type Invitation, type Member } from './members-settings';

export const metadata: Metadata = { title: 'Configuración' };

function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-5 border-t border-border pt-8 first:border-t-0 first:pt-0 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10"
    >
      <div>
        <h2 id={id} className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default async function SettingsPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const [company, user, supabase] = await Promise.all([
    requireCompany(slug),
    requireUser(),
    getSupabase(),
  ]);
  const isOwner = company.role === 'owner';

  const { data: memberRows, error: membersError } = await supabase
    .from('memberships')
    .select('user_id, role, created_at, profiles(email, full_name)')
    .eq('company_id', company.id)
    .order('created_at');
  if (membersError) throw new Error(`No se pudieron cargar los miembros: ${membersError.message}`);

  const members: Member[] = memberRows.map((m) => ({
    userId: m.user_id,
    role: m.role,
    email: m.profiles?.email ?? null,
    fullName: m.profiles?.full_name ?? null,
  }));

  let invitations: Invitation[] = [];
  if (isOwner) {
    const { data, error } = await supabase
      .from('invitations')
      .select('id, email, role, created_at')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`No se pudieron cargar las invitaciones: ${error.message}`);
    invitations = data.map((i) => ({ id: i.id, email: i.email, role: i.role, createdAt: i.created_at }));
  }

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader title="Configuración" description={company.name} />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-4 sm:p-6 lg:py-10">
        <SettingsSection
          id="settings-company"
          title="Empresa"
          description="Datos que ven todos los miembros."
        >
          <CompanySettings company={company} canEdit={isOwner} />
        </SettingsSection>

        <SettingsSection
          id="settings-members"
          title="Miembros"
          description={
            isOwner
              ? 'Invitá a tu equipo y definí quién administra la empresa.'
              : 'Personas con acceso a esta empresa.'
          }
        >
          <MembersSettings
            companyId={company.id}
            currentUserId={user.id}
            isOwner={isOwner}
            members={members}
            invitations={invitations}
          />
        </SettingsSection>
      </main>
    </div>
  );
}

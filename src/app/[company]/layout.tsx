import { AppSidebar } from '@/components/app-sidebar';
import { CompanyProvider } from '@/components/company-provider';
import { LegacyPresetsMigration } from '@/components/legacy-presets-migration';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { getMyCompanies, getProfile, requireCompany } from '@/lib/auth/dal';

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ company: string }>;
}) {
  const { company: slug } = await params;
  const company = await requireCompany(slug);
  const [companies, profile] = await Promise.all([getMyCompanies(), getProfile()]);

  return (
    <CompanyProvider company={company}>
      <LegacyPresetsMigration />
      <SidebarProvider>
        <AppSidebar company={company} companies={companies} profile={profile} />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </CompanyProvider>
  );
}

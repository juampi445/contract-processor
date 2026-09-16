'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Check,
  ChevronsUpDown,
  Download,
  LogOut,
  Plus,
  ReceiptText,
  Settings,
} from 'lucide-react';
import { useSignOut } from '@/components/auth/sign-out-button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { CompanyAvatar } from '@/components/company-avatar';
import { ROLE_LABELS, type CompanyMembership, type CurrentProfile } from '@/lib/auth/types';
import { initials } from '@/lib/initials';

interface NavItem {
  title: string;
  href: string;
  icon: typeof ReceiptText;
}

function NavGroup({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="mb-1">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={pathname.startsWith(item.href)}
                tooltip={item.title}
                render={<Link href={item.href} />}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({
  company,
  companies,
  profile,
}: {
  company: CompanyMembership;
  companies: CompanyMembership[];
  profile: CurrentProfile;
}) {
  const pathname = usePathname();
  const { signOut, pending: signingOut } = useSignOut();
  const base = `/${company.slug}`;
  const displayName = profile.fullName || profile.email;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pt-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
                  />
                }
              >
                <CompanyAvatar name={company.name} logoPath={company.logoPath} tone="primary" />
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">{company.name}</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">
                    {ROLE_LABELS[company.role]}
                  </span>
                </span>
                <ChevronsUpDown className="ml-auto text-sidebar-foreground/60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-60" sideOffset={6}>
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Empresas</DropdownMenuLabel>
                  {companies.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      render={<Link href={`/${c.slug}/retenciones`} />}
                      className="gap-2 py-1.5"
                    >
                      <CompanyAvatar name={c.name} logoPath={c.logoPath} size="sm" />
                      <span className="flex-1 truncate">{c.name}</span>
                      {c.id === company.id && <Check className="text-primary" aria-label="Actual" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/onboarding" />} className="gap-2 py-1.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md border border-dashed border-border">
                    <Plus className="size-3.5" />
                  </span>
                  Crear empresa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="pt-2">
        <NavGroup
          label="Herramientas"
          pathname={pathname}
          items={[
            { title: 'Retenciones', href: `${base}/retenciones`, icon: ReceiptText },
            { title: 'Descargas', href: `${base}/descargas`, icon: Download },
          ]}
        />
        <NavGroup
          label="Empresa"
          pathname={pathname}
          items={[{ title: 'Configuración', href: `${base}/settings`, icon: Settings }]}
        />
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
                  />
                }
              >
                <Avatar className="rounded-lg after:rounded-lg">
                  <AvatarFallback className="rounded-lg text-xs">{initials(displayName)}</AvatarFallback>
                </Avatar>
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">{profile.email}</span>
                </span>
                <ChevronsUpDown className="ml-auto text-sidebar-foreground/60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="min-w-56" sideOffset={6}>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate">{profile.email}</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} disabled={signingOut} className="gap-2 py-1.5">
                  <LogOut />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

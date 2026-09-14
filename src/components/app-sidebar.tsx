'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Download, ReceiptText, ShieldCheck } from 'lucide-react';
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

const NAV_ITEMS = [
  {
    title: 'Retenciones',
    href: '/retenciones',
    icon: ReceiptText,
  },
  {
    title: 'Descargas',
    href: '/descargas',
    icon: Download,
  },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pt-3">
        <div className="flex items-center gap-2.5 px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/95 p-1">
            <Image
              src="/logo-main.png"
              alt="Coopagro"
              width={447}
              height={447}
              className="size-full object-contain"
            />
          </span>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">
              Braulio Ponce
            </p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              Coopagro
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-1">Herramientas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="pb-3">
        <div className="flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-sidebar-foreground/60 group-data-[collapsible=icon]:justify-center">
          <ShieldCheck className="size-4 shrink-0 text-success" />
          <span className="group-data-[collapsible=icon]:hidden">
            100% local, sin servidores
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

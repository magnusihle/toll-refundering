import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Ship, AlertTriangle } from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarSeparator, useSidebar,
} from '@/components/ui/sidebar';
import { useData } from '@/lib/data';
import { NAV, GROUPS } from '@/lib/nav';
import { n } from '@/lib/format';
import { agg } from '@/lib/recovery';
import { groupGoods, groupSummary } from '@/lib/group';
import { groupSuppliers } from '@/lib/suppliers';

/** Live counts on the nav items, so the menu says where the work is. */
function useNavCounts() {
  const data = useData();
  return React.useMemo(() => {
    const ins = data.insights;
    const rec = agg(ins.actions.rows);
    const goods = groupSummary(groupGoods(data.goods));
    return {
      '/gjenvinning': { text: n(ins.actions.count), urgent: rec.urgentCount },
      '/varer': { text: n(goods.groups), urgent: 0 },
      '/deklarasjoner': { text: n(data.declarations.length), urgent: 0 },
      '/leverandorer': { text: n(groupSuppliers(data.declarations).length), urgent: 0 },
    } as Record<string, { text: string; urgent?: number }>;
  }, [data]);
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();
  const counts = useNavCounts();
  const data = useData();
  const win = data.meta.claimWindow;

  const close = () => { if (isMobile) setOpenMobile(false); };
  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Ship className="size-4" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-semibold leading-tight">EMMA EDOC</div>
            <div className="truncate text-[11px] leading-tight text-sidebar-foreground/60">Arnika AS · fortolling</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {GROUPS.map((group) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.filter((item) => item.group === group).map((item) => {
                  const c = counts[item.to];
                  const active = isActive(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <NavLink to={item.to} onClick={close}>
                          <item.icon />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                      {c?.urgent ? (
                        <SidebarMenuBadge className="text-destructive">
                          <AlertTriangle className="mr-0.5 size-3" />{c.urgent}
                        </SidebarMenuBadge>
                      ) : c?.text ? (
                        <SidebarMenuBadge>{c.text}</SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2 text-[11px] leading-relaxed text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
          <div className="font-medium text-sidebar-foreground/90">3-årsvindu</div>
          <div className="tabnum">{win?.from} – {win?.to}</div>
          <div>Frist regnes fra i dag ({win?.tz})</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

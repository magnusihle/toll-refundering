import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useData } from "@/lib/data";
import { NAV, GROUPS } from "@/lib/nav";
import { n } from "@/lib/format";
import { agg } from "@/lib/recovery";
import { groupGoods, groupSummary } from "@/lib/group";
import { groupSuppliers } from "@/lib/suppliers";

/** Live counts on the nav items, so the menu says where the work is. */
function useNavCounts() {
  const data = useData();
  return React.useMemo(() => {
    const ins = data.insights;
    const rec = agg(ins.actions.rows);
    const goods = groupSummary(groupGoods(data.goods));
    return {
      "/refusjon": { text: n(ins.actions.count), urgent: rec.urgentCount },
      "/varer": { text: n(goods.groups), urgent: 0 },
      "/deklarasjoner": { text: n(data.declarations.length), urgent: 0 },
      "/leverandorer": {
        text: n(groupSuppliers(data.declarations).length),
        urgent: 0,
      },
    } as Record<string, { text: string; urgent?: number }>;
  }, [data]);
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();
  const counts = useNavCounts();
  const data = useData();
  const win = data.meta.claimWindow;

  const close = () => {
    if (isMobile) setOpenMobile(false);
  };
  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-1.5 py-2.5">
          {/* Ordmerket, ikke et oppfunnet symbol (DESIGN.md). Sammentrukket
              sidebar faller tilbake til forbokstaven. Ingen ramme rundt: navi-
              gasjonen har ingen streker, kortet er det eneste som har kant. */}
          <div className="grid size-8 shrink-0 place-items-center rounded-md text-base font-medium text-sidebar-foreground">
            D
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-lg font-medium leading-tight tracking-[-0.02em]">
              Declaro.
            </div>
            <div className="truncate text-2xs leading-tight text-sidebar-foreground/55">
              Arnika AS · fortolling
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {GROUPS.map((group) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel className="t-eyebrow h-auto px-2 pb-1.5 pt-4 text-sidebar-foreground/45">
              {group}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.filter((item) => item.group === group).map((item) => {
                  const c = counts[item.to];
                  const active = isActive(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className={
                          "h-9 rounded-md text-base font-normal " +
                          "data-[active=true]:font-medium " +
                          "data-[active=true]:[&>svg]:text-sidebar-accent-foreground"
                        }
                      >
                        <NavLink to={item.to} onClick={close}>
                          <item.icon />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                      {c?.urgent ? (
                        <SidebarMenuBadge className="gap-1 text-destructive">
                          <AlertTriangle className="size-3" />
                          {c.urgent}
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
        <div className="px-2 pb-1 pt-3 text-2xs leading-relaxed text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          <div className="t-eyebrow mb-1.5 text-sidebar-foreground/45">
            3-årsvindu
          </div>
          <div className="tabnum">
            {win?.from} – {win?.to}
          </div>
          <div>Frist regnes fra i dag ({win?.tz})</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

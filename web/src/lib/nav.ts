import {
  LayoutDashboard,
  HandCoins,
  Package,
  FileText,
  Building2,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  group: string;
};

export const NAV: NavItem[] = [
  { to: "/", label: "Dashbord", icon: LayoutDashboard, group: "Oversikt" },
  { to: "/refusjon", label: "Refusjon", icon: HandCoins, group: "Analyse" },
  { to: "/varer", label: "Varer", icon: Package, group: "Grunnlag" },
  {
    to: "/deklarasjoner",
    label: "Deklarasjoner",
    icon: FileText,
    group: "Grunnlag",
  },
  {
    to: "/leverandorer",
    label: "Leverandører",
    icon: Building2,
    group: "Grunnlag",
  },
];

export const GROUPS = [...new Set(NAV.map((n) => n.group))];
export const navItemFor = (pathname: string) =>
  NAV.find((n) => n.to !== "/" && pathname.startsWith(n.to)) ?? NAV[0];

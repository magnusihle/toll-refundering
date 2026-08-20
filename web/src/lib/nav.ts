import { LayoutDashboard, HandCoins, Package, FileText, Building2 } from 'lucide-react';

export type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Shown in the page header under the title, and as the route's one-line purpose. */
  blurb: string;
  group: string;
};

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashbord', icon: LayoutDashboard, group: 'Oversikt',
    blurb: 'Hva som er å hente, hvor det haster, og hva grunnlaget er.' },
  { to: '/gjenvinning', label: 'Gjenvinning', icon: HandCoins, group: 'Analyse',
    blurb: 'Krav mot DSV/3PL — vektet beløp, frist og neste steg per post.' },
  { to: '/varer', label: 'Varer', icon: Package, group: 'Grunnlag',
    blurb: 'Én rad per vare på tvers av sendingene, med avvik i behandlingen — ulikt varenummer, ulik sats — løftet fram.' },
  { to: '/deklarasjoner', label: 'Deklarasjoner', icon: FileText, group: 'Grunnlag',
    blurb: 'Alle fortollinger i 3-årsvinduet, med varelinjer og lenke til SAD.' },
  { to: '/leverandorer', label: 'Leverandører', icon: Building2, group: 'Grunnlag',
    blurb: 'Én rad per leverandør, med hele fortollingshistorikken og lenke til kilde-SAD.' },
];

export const GROUPS = [...new Set(NAV.map((n) => n.group))];
export const navItemFor = (pathname: string) =>
  NAV.find((n) => n.to !== '/' && pathname.startsWith(n.to)) ?? NAV[0];

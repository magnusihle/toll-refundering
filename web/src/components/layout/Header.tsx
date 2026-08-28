import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { Monitor, Moon, Sun, LogOut, User2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCurrency } from '@/lib/currency';
import { useTheme } from '@/lib/theme';
import { authClient, HOSTED } from '@/lib/auth';
import { useData, useDataCtx } from '@/lib/data';
import { navItemFor } from '@/lib/nav';
import { RefreshButton } from '@/components/RefreshButton';

function CurrencySelect() {
  const { cur, setCur, currencies, fx } = useCurrency();
  return (
    <div className="flex items-center gap-1.5">
      {/* Omregning gjelder på ALLE sider, så forbeholdet hører hjemme i toppraden. */}
      {cur !== 'NOK' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="hidden cursor-default rounded-xs border border-warning/30 bg-warning/[0.09] px-1.5 py-0.5 text-2xs font-medium text-warning sm:inline">
              omregnet
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Beløp er regnet om fra NOK med kurs {fx?.date} ({fx?.source}{fx?.stale ? ' — mellomlagret' : ''})
          </TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Select value={cur} onValueChange={setCur}>
            <SelectTrigger className="h-8 gap-0.5 rounded-md border-transparent bg-transparent px-2 text-xs text-muted-foreground hover:bg-surface-sunken">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </TooltipTrigger>
        <TooltipContent side="bottom">Visningsvaluta — lagrede verdier er alltid NOK</TooltipContent>
      </Tooltip>
    </div>
  );
}

function ThemeMenu() {
  const { theme, setTheme, resolved } = useTheme();
  const options = [
    { value: 'light' as const, label: 'Lyst', icon: Sun },
    { value: 'dark' as const, label: 'Mørkt', icon: Moon },
    { value: 'system' as const, label: 'Følg systemet', icon: Monitor },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          {resolved === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
          <span className="sr-only">Bytt tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => setTheme(o.value)}>
            <o.icon />{o.label}
            {theme === o.value ? <Check className="ml-auto size-4 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { data: session } = authClient.useSession();
  const email = (session as any)?.user?.email;
  if (!email) return null;
  const initials = email.slice(0, 2).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2">
          <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-2xs font-semibold text-primary">{initials}</span>
          <span className="hidden max-w-[160px] truncate text-xs text-muted-foreground sm:inline">{email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2 font-normal">
          <User2 className="size-4 text-muted-foreground" />
          <span className="truncate text-xs">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => authClient.signOut()}><LogOut />Logg ut</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const { pathname } = useLocation();
  const item = navItemFor(pathname);
  const data = useData();
  const { reload } = useDataCtx();
  const stamp = data.meta.snapshotAt || data.meta.generatedAt;
  const stampLabel = new Date(stamp).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <header data-app-header className="z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-4 md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      {/* Sidens ENE overskrift. Sto tidligere også som <h1 class="t-page"> i
          sidekroppen — samme ord to ganger, 60 px fra hverandre. Den blir
          stående når du ruller en tabell på 933 rader: rullingen ligger i
          kortets egen flate under topplinjen, ikke i vinduet. */}
      <div className="flex min-w-0 items-center gap-2">
        <item.icon className="size-4 shrink-0 text-muted-foreground" />
        <h1 className="t-small truncate font-medium">{item.label}</h1>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* Hosted kjører ingen selvbetjent henting, så der er stempelet bare tekst. */}
        {HOSTED ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="hidden px-2 text-xs text-muted-foreground lg:inline">Oppdatert {stampLabel}</span>
            </TooltipTrigger>
            <TooltipContent side="bottom">Tidspunktet datagrunnlaget sist ble hentet</TooltipContent>
          </Tooltip>
        ) : (
          <RefreshButton stamp={`Oppdatert ${stampLabel}`} onDone={reload} />
        )}
        <CurrencySelect />
        <ThemeMenu />
        {HOSTED && <UserMenu />}
      </div>
    </header>
  );
}

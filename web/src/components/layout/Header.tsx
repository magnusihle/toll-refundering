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
            <span className="hidden cursor-default rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 sm:inline">
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
            <SelectTrigger className="h-8 w-[86px]"><SelectValue /></SelectTrigger>
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
        <Button variant="ghost" size="icon" className="size-8">
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
        <Button variant="ghost" className="h-8 gap-2 px-2">
          <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{initials}</span>
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

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      <div className="flex min-w-0 items-center gap-2">
        <item.icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium">{item.label}</span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="hidden text-[11px] text-muted-foreground lg:inline">
              Oppdatert {new Date(stamp).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Tidspunktet datagrunnlaget sist ble hentet</TooltipContent>
        </Tooltip>
        <CurrencySelect />
        {!HOSTED && <RefreshButton onDone={reload} />}
        <ThemeMenu />
        {HOSTED && <UserMenu />}
      </div>
    </header>
  );
}

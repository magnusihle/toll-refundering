import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { CurrencyProvider, useCurrency } from '@/lib/currency';
import { getData, getStatus } from '@/lib/api';
import { authClient, HOSTED } from '@/lib/auth';
import { SignIn } from '@/components/SignIn';
import { Money } from '@/components/Money';
import { RefreshButton } from '@/components/RefreshButton';
import { agg, rowsFor } from '@/lib/recovery';
import { Overview } from '@/tabs/Overview';
import { Recovery } from '@/tabs/Recovery';
import { Declarations } from '@/tabs/Declarations';
import { Goods } from '@/tabs/Goods';

function Kpi({ label, children }: { label: string; children: React.ReactNode }) {
  return <Card><CardContent className="p-4"><div className="text-xl font-semibold tabnum">{children}</div><div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div></CardContent></Card>;
}
function CurrencySelect() {
  const { cur, setCur, currencies } = useCurrency();
  return <Select value={cur} onValueChange={setCur}><SelectTrigger className="h-9 w-[92px]"><SelectValue /></SelectTrigger>
    <SelectContent>{currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>;
}
function UserMenu() {
  const { data: session } = authClient.useSession();
  const email = (session as any)?.user?.email;
  if (!email) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
      <Button variant="outline" size="sm" onClick={() => authClient.signOut()}>Logg ut</Button>
    </div>
  );
}

function Shell({ data, onDone }: { data: any; onDone: () => void }) {
  const { cur, fx } = useCurrency();
  const m = data.meta, ins = data.insights;
  const [recKind, setRecKind] = React.useState('alle');
  const recAgg = agg(rowsFor(ins.actions.rows, recKind));
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-lg font-semibold">EMMA EDOC — Fortollingsanalyse <span className="text-sm font-normal text-muted-foreground">Arnika AS · {m.claimWindow?.from} – {m.claimWindow?.to}</span></h1>
          <p className="text-xs text-muted-foreground">Sist oppdatert {new Date(m.snapshotAt || m.generatedAt).toLocaleString('nb-NO')} · 3-årsfristen for tilbakebetaling regnes fra i dag i norsk tid ({m.claimWindow?.tz})</p></div>
        <div className="flex items-center gap-2"><CurrencySelect />{!HOSTED && <RefreshButton onDone={onDone} />}{HOSTED && <UserMenu />}</div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Deklarasjoner">{m.declarations}</Kpi>
        <Kpi label="Varelinjer">{m.goodsLines}</Kpi>
        <Kpi label="Verdi (NOK-basis)"><Money nok={m.valueNok} /></Kpi>
        <Kpi label="MVA-grunnlag 25%"><Money nok={m.mva25} /></Kpi>
      </div>

      {/* Gjenvinning: «sannsynlig» er hovedtallet vi kommuniserer. Taket vises bevisst
          nedtonet og eksplisitt merket, så det aldri leses som en lovet utbetaling. */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={'Sannsynlig gjenvinning' + (recKind !== 'alle' ? ' · ' + recKind : '')}>
          <span className="text-success"><Money nok={recAgg.likely} /></span>
        </Kpi>
        <Kpi label={'Solid grunnlag' + (recKind !== 'alle' ? ' · ' + recKind : '')}>
          <Money nok={recAgg.solid} />
        </Kpi>
        <Kpi label={'Øvre tak — ikke et krav' + (recKind !== 'alle' ? ' · ' + recKind : '')}>
          <span className="text-muted-foreground"><Money nok={recAgg.ceiling} /></span>
        </Kpi>
        <Kpi label={'Haster ≤90 d' + (recKind !== 'alle' ? ' · ' + recKind : '')}>
          <span className={recAgg.urgentCount ? 'text-destructive' : ''}>{recAgg.urgentCount}</span>
        </Kpi>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        <b>Sannsynlig gjenvinning</b> = hvert krav vektet med vurdert sannsynlighet — dette er tallet å planlegge etter.
        <b> Øvre tak</b> er summen av all toll som er berørt av kravene, og forutsetter at absolutt alt går igjennom; det skjer ikke.
        {ins.actions.assessed > 0 && <> Av {ins.actions.count} krav er <b>{ins.actions.assessed}</b> vurdert av agent mot faktiske satser i tolltariffen.</>}
      </p>

      {(ins.coverage?.byYear?.length ?? 0) > 0 && (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Datagrunnlag innenfor fristen: <b>{ins.coverage.inWindow}</b> deklarasjoner ({ins.coverage.first} – {ins.coverage.last})
          {' · '}per år: {ins.coverage.byYear.map((y: any) => `${y.year}: ${y.n}`).join(' · ')}
          {ins.coverage.beforeWindow ? ` · ${ins.coverage.beforeWindow} eldre enn fristen (foreldet, holdes utenfor kravene)` : ''}
        </p>)}

      {cur !== 'NOK' && <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">Viser beløp i {cur} med dagens kurs ({fx?.date}, {fx?.source}{fx?.stale ? ' — mellomlagret' : ''}). Lagrede verdier er i NOK.</p>}

      <Tabs defaultValue="over" className="mt-4">
        <TabsList><TabsTrigger value="over">Oversikt</TabsTrigger><TabsTrigger value="gjen">Gjenvinning</TabsTrigger><TabsTrigger value="decl">Deklarasjoner</TabsTrigger><TabsTrigger value="goods">Varer</TabsTrigger></TabsList>
        <TabsContent value="over"><Overview data={data} /></TabsContent>
        <TabsContent value="gjen"><Recovery data={data} kind={recKind} setKind={setRecKind} /></TabsContent>
        <TabsContent value="decl"><Declarations data={data} /></TabsContent>
        <TabsContent value="goods"><Goods data={data} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Dashboard() {
  const [data, setData] = React.useState<any>(null);
  const load = React.useCallback(async () => { setData(await getData()); }, []);
  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    // Reload when the data changes: hosted → on a new `publish` (updatedAt),
    // local → when the collection grows (declarations). `last` inits on first tick.
    let last = '';
    const tick = async () => {
      try {
        const s = await getStatus();
        const stamp = String(s?.updatedAt ?? s?.db?.declarations ?? '');
        if (last && stamp && stamp !== last) load();
        last = stamp;
      } catch {}
    };
    const id = setInterval(tick, HOSTED ? 15000 : 6000);
    return () => clearInterval(id);
  }, [load]);
  if (!data) return <div className="mx-auto max-w-[1400px] space-y-3 p-5"><Skeleton className="h-10 w-80" /><Skeleton className="h-24 w-full" /><Skeleton className="h-96 w-full" /></div>;
  return <CurrencyProvider fx={data.meta.fx}><Shell data={data} onDone={load} /><Toaster richColors position="bottom-right" /></CurrencyProvider>;
}

export default function App() {
  if (!HOSTED) return <Dashboard />;
  return <AuthGate />;
}

function AuthGate() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <div className="grid min-h-screen place-items-center"><Skeleton className="h-24 w-72" /></div>;
  if (!session) return <SignIn />;
  return <Dashboard />;
}

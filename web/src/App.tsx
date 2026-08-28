import * as React from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';
import { CurrencyProvider } from '@/lib/currency';
import { DataProvider } from '@/lib/data';
import { getData, getStatus } from '@/lib/api';
import { authClient, HOSTED } from '@/lib/auth';
import { SignIn } from '@/components/SignIn';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Recovery } from '@/pages/Recovery';
import { Goods } from '@/pages/Goods';
import { Declarations } from '@/pages/Declarations';
import { Suppliers } from '@/pages/Suppliers';

function LoadingScreen() {
  // Skjelettet må tegne DEN layouten som lastes inn — ellers blinker appen én
  // struktur og bytter til en annen. Mål her speiler Layout/Header/AppSidebar.
  return (
    <div className="flex min-h-svh">
      <div className="hidden w-[15.5rem] shrink-0 bg-sidebar p-2 md:block">
        <Skeleton className="h-12 w-full bg-white/[0.07]" />
        <div className="mt-5 space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full bg-white/[0.07]" />)}
        </div>
      </div>
      <div className="flex-1">
        <div className="h-16 border-b border-border" />
        <div className="mx-auto max-w-[1280px] space-y-12 px-6 pb-20 pt-9 md:space-y-16 md:px-10 lg:px-16">
          <div>
            <Skeleton className="h-9 w-56" />
            <Skeleton className="mt-4 h-5 w-[32rem] max-w-full" />
          </div>
          <div className="grid gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="pl-6">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-8 w-32" />
                <Skeleton className="mt-3 h-4 w-40" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="grid min-h-svh place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-[26rem] rounded-2xl border border-border bg-card p-8 text-center md:p-10">
        <AlertTriangle className="mx-auto size-6 text-destructive" aria-hidden />
        <h1 className="mt-4 text-xl font-medium tracking-[-0.015em]">Fikk ikke hentet datagrunnlaget</h1>
        <p className="mt-2 text-base text-muted-foreground">{error}</p>
        <Button size="lg" className="mt-7" onClick={onRetry}><RotateCw />Prøv igjen</Button>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="max-w-[46ch] py-16">
      <h1 className="t-page">Denne siden finnes ikke</h1>
      <p className="t-lead mt-3 text-muted-foreground">
        Lenken kan være utdatert. Dashbordet viser hva som er å hente akkurat nå.
      </p>
      <Button asChild size="lg" className="mt-7"><Link to="/">Til dashbordet</Link></Button>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/gjenvinning" element={<Recovery />} />
        <Route path="/varer" element={<Goods />} />
        <Route path="/deklarasjoner" element={<Declarations />} />
        <Route path="/leverandorer" element={<Suppliers />} />
        {/* Gamle lenker skal fortsatt lande riktig. Avgiftsfordelingen er lagt ned:
            det handlingsbare i den — samme vare med ulik sats — finner Varer allerede. */}
        <Route path="/oversikt" element={<Navigate to="/" replace />} />
        <Route path="/avgifter" element={<Navigate to="/varer" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function Shell() {
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = React.useState(0);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      setData(await getData());
      setLastLoaded(Date.now());
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }, []);

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

  if (error) return <ErrorScreen error={error} onRetry={load} />;
  if (!data) return <LoadingScreen />;

  return (
    <CurrencyProvider fx={data.meta.fx}>
      <DataProvider data={data} reload={load} lastLoaded={lastLoaded}>
        <AppRoutes />
        <Toaster richColors position="bottom-right" />
      </DataProvider>
    </CurrencyProvider>
  );
}

function AuthGate() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <LoadingScreen />;
  if (!session) return <SignIn />;
  return <Shell />;
}

export default function App() {
  return HOSTED ? <AuthGate /> : <Shell />;
}

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
  return (
    <div className="flex min-h-svh">
      <div className="hidden w-[15.5rem] shrink-0 bg-sidebar p-3 md:block">
        <Skeleton className="h-9 w-full bg-white/10" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full bg-white/10" />)}
        </div>
      </div>
      <div className="flex-1">
        <div className="h-14 border-b" />
        <div className="mx-auto max-w-[1500px] space-y-5 p-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-72 lg:col-span-2" />
            <Skeleton className="h-72" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="grid min-h-svh place-items-center p-6">
      <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto size-6 text-destructive" />
        <h1 className="mt-3 font-semibold">Fikk ikke hentet datagrunnlaget</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-5" onClick={onRetry}><RotateCw />Prøv igjen</Button>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-sm uppercase tracking-wider text-muted-foreground">404</p>
      <h1 className="mt-2 text-xl font-semibold">Denne siden finnes ikke</h1>
      <Button asChild className="mt-5"><Link to="/">Til dashbordet</Link></Button>
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

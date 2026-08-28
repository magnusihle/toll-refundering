import { AlertTriangle } from 'lucide-react';
import { authClient } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Innlogging. Første flate en bruker ser, så den bærer merkevaren tydeligst:
 * ordmerket «Declaro.» (DESIGN.md — aldri et oppfunnet symbol), papir mot canvas
 * med én hårfin linje og ingen skygge, typografi fra samme skala som resten.
 */
export function SignIn() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  return (
    <div className="grid min-h-svh place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-[26rem]">
        <div className="rounded-2xl border border-border bg-card p-8 md:p-10">
          <div className="text-2xl font-medium tracking-[-0.02em]">Declaro.</div>
          <h1 className="mt-7 text-xl font-medium tracking-[-0.015em]">Fortollingsanalyse</h1>
          <p className="mt-2 text-base text-muted-foreground">Arnika AS · intern tilgang</p>

          {error && (
            <Alert variant="destructive" className="mt-6 text-left">
              <AlertTriangle />
              <AlertDescription>
                Innlogging feilet: <span className="font-mono text-xs">{error}</span>
              </AlertDescription>
            </Alert>
          )}

          <Button
            size="lg"
            className="mt-8 w-full"
            onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: '/', errorCallbackURL: '/' })}
          >
            Logg inn med Google
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">Kun @declaro.no-kontoer har tilgang.</p>
        </div>
      </div>
    </div>
  );
}

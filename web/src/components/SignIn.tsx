import { Ship, AlertTriangle } from 'lucide-react';
import { authClient } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function SignIn() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  return (
    <div className="grid min-h-svh place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Ship className="size-5" />
          </div>
          <h1 className="mt-5 text-lg font-semibold tracking-tight">EMMA EDOC — Fortollingsanalyse</h1>
          <p className="mt-1 text-sm text-muted-foreground">Arnika AS · intern tilgang</p>

          {error && (
            <Alert variant="destructive" className="mt-5 text-left">
              <AlertTriangle />
              <AlertDescription>
                Innlogging feilet: <span className="font-mono text-xs">{error}</span>
              </AlertDescription>
            </Alert>
          )}

          <Button
            className="mt-6 w-full"
            onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: '/', errorCallbackURL: '/' })}
          >
            Logg inn med Google
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">Kun @declaro.no-kontoer har tilgang.</p>
        </div>
      </div>
    </div>
  );
}

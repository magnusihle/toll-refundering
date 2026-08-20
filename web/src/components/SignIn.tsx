import { authClient } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export function SignIn() {
  const error = new URLSearchParams(window.location.search).get('error');
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold">EMMA EDOC — Fortollingsanalyse</h1>
        <p className="mt-1 text-sm text-muted-foreground">Arnika AS · intern tilgang</p>
        {error && (
          <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Innlogging avvist. Kun @declaro.no-kontoer har tilgang.
          </p>
        )}
        <Button
          className="mt-6 w-full"
          onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: '/', errorCallbackURL: '/?error=access_denied' })}
        >
          Logg inn med Google
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">Kun @declaro.no-kontoer har tilgang.</p>
      </div>
    </div>
  );
}

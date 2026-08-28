import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { postRefresh, getRefreshStatus } from '@/lib/api';

/**
 * Tidsstempelet ER knappen.
 *
 * Før sto «Oppdatert 28. aug., 09:50» som tekst med en fylt forest-knapp ved
 * siden — den loudeste flaten i hele appen, brukt på en vedlikeholdshandling.
 * DESIGN.md: krom er aldri fylt eller innrammet. Nå svarer én rolig kontroll på
 * både «når ble dette hentet» og «hent det på nytt», og fyllet er ledig til
 * handlingen som faktisk sender noe ut av appen.
 */
export function RefreshButton({ stamp, onDone }: { stamp: string; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const run = async () => {
    setBusy(true);
    const t = toast.loading('Sjekker EMMA for nye deklarasjoner…');
    await postRefresh();
    const poll = setInterval(async () => {
      const s = await getRefreshStatus();
      toast.loading(s.message || s.state, { id: t });
      if (s.state === 'done' || s.state === 'error') {
        clearInterval(poll); setBusy(false);
        if (s.state === 'done') { toast.success(s.message, { id: t }); onDone(); }
        else toast.error(s.message, { id: t });
      }
    }, 1500);
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={run}
          disabled={busy}
          className="gap-1.5 px-2 text-xs font-normal text-muted-foreground [&_svg]:size-3.5"
        >
          <RefreshCw className={busy ? 'animate-spin' : undefined} />
          <span className="hidden lg:inline">{busy ? 'Oppdaterer…' : stamp}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Tidspunktet datagrunnlaget sist ble hentet — klikk for å hente på nytt</TooltipContent>
    </Tooltip>
  );
}

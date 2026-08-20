import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { postRefresh, getRefreshStatus } from '@/lib/api';
export function RefreshButton({ onDone }: { onDone: () => void }) {
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
  return <Button onClick={run} disabled={busy}><RefreshCw className={busy ? 'animate-spin' : ''} />Oppdater</Button>;
}

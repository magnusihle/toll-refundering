import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useData } from '@/lib/data';
import { snapshotGap } from '@/lib/contract';

/**
 * Says out loud that the data on screen is older than the code rendering it.
 *
 * The alternative is what we had: a dashboard confidently reporting two root
 * causes because the third one's input field did not exist in the payload yet.
 * Wrong numbers that look right are worse than no numbers, so this sits above
 * every page rather than on the one chart that happened to break first
 * (DESIGN.md — skjul aldri tall i stillhet).
 */
export function SnapshotNotice() {
  const data = useData();
  const gap = snapshotGap(data?.meta);
  if (!gap) return null;

  const stamp = data.meta.snapshotAt || data.meta.generatedAt;
  const stampLabel = stamp
    ? new Date(stamp).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })
    : null;

  return (
    <Alert variant="warning">
      <AlertTriangle />
      <AlertTitle>Tallene kan være gruppert feil</AlertTitle>
      <AlertDescription>
        <p>
          Datagrunnlaget {stampLabel ? `ble publisert ${stampLabel} og ` : ''}er eldre enn
          denne versjonen av appen. Det mangler {gap.missing}, så krav havner på feil årsak
          og enkeltkrav lar seg ikke velge hver for seg. Summene stemmer — fordelingen gjør
          det ikke.
        </p>
        <p className="mt-1.5">
          Kjør <span className="font-medium text-foreground">npm run publish</span> lokalt
          for å oppdatere prod. Ingen ny utrulling er nødvendig.
        </p>
      </AlertDescription>
    </Alert>
  );
}

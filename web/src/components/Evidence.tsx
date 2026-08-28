import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { n } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * En liste som er BELEGG, ikke arbeid.
 *
 * «Ikke grunnlag» og «RÅK-kontroll» lå tidligere som faner sidestilt med
 * kravene. De er ikke noe man handler på — de finnes for å gjøre kravtallet
 * etterprøvbart — og null lenker i appen pekte inn i dem. Her er de foldet
 * sammen: antallet og hva de betyr står alltid synlig, listen er ett klikk unna.
 *
 * Foldet, ikke skjult: DESIGN.md krever at et tall som er filtrert bort alltid
 * vises med antall og en vei til å se det likevel.
 */
export function Evidence({ label, count, note, children }: {
  label: string;
  count: number;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  return (
    <div className="rule-t pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="group flex w-full items-baseline gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ChevronRight
          aria-hidden
          className={cn('size-3.5 shrink-0 self-center text-muted-foreground transition-transform duration-200 ease-out-strong', open && 'rotate-90')}
        />
        <span className="t-small font-medium text-foreground">{label}</span>
        <span className="tabnum t-small text-muted-foreground">{n(count)}</span>
      </button>
      {note ? <p className="ml-5.5 mt-1 text-sm text-muted-foreground">{note}</p> : null}
      {open ? <div id={id} className="mt-4">{children}</div> : null}
    </div>
  );
}

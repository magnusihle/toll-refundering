import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Aktivt filter, som liten markør med avvisning.
 *
 * DESIGN.md: markører, ikke fargede piller — 4px radius, hårfin kant, dempet
 * flate. Brikken er et SAMMENDRAG av tilstand som er satt et annet sted; den er
 * ikke selve kontrollen. Derfor blir nedtrekket i panelet stående med sin egen
 * verdi samtidig (97 % av målte nettsteder gjør det slik — Baymard).
 *
 * Brikker vises KUN for filtre. Visningsvalg gir aldri brikke: da ville raden
 * bety to ting samtidig — «dette er tatt bort» og «dette ser annerledes ut».
 */
export function Chip({ label, onClear, className }: {
  label: React.ReactNode;
  onClear: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-xs border border-border bg-surface-sunken py-0.5 pl-2 pr-1 text-2xs text-foreground',
        className
      )}
    >
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Fjern filter`}
        className="rounded-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

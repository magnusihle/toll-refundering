import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Filtre som linjerte faner, ikke piller i et trau.
 *
 * Kun den AKTIVE fanen får en forest-strek under seg. Ingen gjennomgående
 * grunnlinje: gruppen brukes både som sidebredt hovedfilter og som liten bryter
 * i en seksjonstittel, og en strek som stopper i vilkårlig lengde midt på siden
 * ser ut som en feil. Ingen bakgrunnsplate, ingen skygge, ingen beholder.
 *
 * `label` er PÅKREVD: en side kan ha flere av disse ved siden av hverandre —
 * datasett, kravtype, visning — og uten navn er de ikke til å skille fra
 * hverandre for skjermleser.
 */
export function Segmented<T extends string>({
  value, onChange, options, label, className,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; label: string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex items-stretch gap-5', className)}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative border-b-2 pb-2.5 pt-1 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              active
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

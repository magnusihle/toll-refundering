import * as React from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Forklaringen bor på begrepet den forklarer.
 *
 * DESIGN.md «Tetthetsbudsjett»: en forklaring som er lik hver gang hører ikke
 * hjemme som et avsnitt over tabellen — den leses én gang og er ballast for
 * alle senere besøk. Her ligger den på kontrollen, ett klikk unna, og forklares
 * nøyaktig ett sted.
 *
 * Popover og ikke tooltip: dette skal også kunne åpnes uten mus og på touch.
 */
export function Explain({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className="rounded-sm text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent>{children}</PopoverContent>
    </Popover>
  );
}

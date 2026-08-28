import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Ett løftet ord i brødtekst.
 *
 * DESIGN.md forbyr `<b>` i et løpende avsnitt: systemstacken har ingen vekt
 * mellom 500 og 700, så `<b>` rendres som full Bold og leser som AI-formatering.
 * Løftet er vekt 500 og full tekstfarge mot den dempede brødteksten rundt —
 * kontrasten kommer av fargetrinnet, ikke av vekten.
 *
 * Trenger et avsnitt mer enn ett eller to løft, er det for langt.
 */
export function Lift({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('font-medium text-foreground', className)}>{children}</span>;
}

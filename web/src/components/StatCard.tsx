import * as React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Figure, type FigureTone } from '@/components/ui/metric';

/**
 * Nøkkeltallet som redaksjonell kolonne.
 *
 * DESIGN.md beskriver en «control margin»: tynne vertikale streker, små markører
 * og én uthevet detalj. Det er separasjonen her — ingen ramme, ingen skygge,
 * ingen fyllfarge. Tallet står på papiret og skalaen lager hierarkiet.
 *
 * Navnet er beholdt fordi sidene kaller det — dette er ikke et kort, og skal
 * ikke bli det. Landingssidens kort er egne roller (sitatblokk, svevende
 * skjema), ikke en beholder for nøkkeltall.
 */
export function StatCard({
  label, value, hint, icon: Icon, tone = 'default', to, onClick, active, className, children,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: FigureTone;
  to?: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const interactive = Boolean(to || onClick);

  const body = (
    <>
      {/* Aktiv-markøren er en strek i margen, ikke en ring rundt en boks. */}
      <Figure
        className={active ? '[&_.t-eyebrow]:text-primary' : undefined}
        label={
          Icon ? (
            <span className="inline-flex items-center gap-1.5">
              <Icon className="size-3 text-muted-foreground/70" />
              {label}
            </span>
          ) : label
        }
        value={value}
        hint={hint}
        size="lg"
        tone={tone}
      />
      {children}
      {/* Én uthevet detalj. Valgt tilstand viser streken permanent i stedet for
          en farget kant i margen — en kantstrek over 1px leser som dekorasjon. */}
      {interactive && (
        <span
          aria-hidden
          className={cn(
            'mt-3.5 block h-px bg-primary transition-[width] duration-200 ease-out-strong',
            active ? 'w-10' : 'w-0 group-hover:w-10 group-focus-visible:w-10'
          )}
        />
      )}
    </>
  );

  // Den horisontale luften eies av StatRow, ikke av kortet: margen er 24px FORDI
  // det står en strek der. Første kolonne i en rad har ingen strek, og skal
  // derfor heller ikke ha luften — ellers henger tallene 24px innenfor
  // overskriften og tabellen på samme side.
  const base = cn(
    'group relative flex min-w-0 flex-col py-0.5 text-left',
    interactive && 'focus-visible:outline-none',
    className
  );

  if (to) return <Link to={to} className={base}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} aria-pressed={active} className={base}>{body}</button>;
  return <div className={base}>{body}</div>;
}

/**
 * Tallene står side ved side, skilt av hårfine streker — control margin.
 * Første kolonne i hver rad mister sin strek, så margen aldri henger løst.
 */
export function StatRow({ children, cols = 4, className }: { children: React.ReactNode; cols?: 3 | 4; className?: string }) {
  return (
    <div
      className={cn(
        'grid gap-y-8 sm:grid-cols-2',
        cols === 3 ? 'lg:grid-cols-3' : 'xl:grid-cols-4',
        '[&>*]:border-l [&>*]:border-border-strong [&>*]:pl-6 [&>*]:pr-5',
        'sm:[&>*:nth-child(2n+1)]:border-l-0 sm:[&>*:nth-child(2n+1)]:pl-0',
        cols === 3
          ? 'lg:[&>*:nth-child(2n+1)]:border-l lg:[&>*:nth-child(2n+1)]:pl-6 '
            + 'lg:[&>*:nth-child(3n+1)]:border-l-0 lg:[&>*:nth-child(3n+1)]:pl-0'
          : 'xl:[&>*:nth-child(2n+1)]:border-l xl:[&>*:nth-child(2n+1)]:pl-6 '
            + 'xl:[&>*:nth-child(4n+1)]:border-l-0 xl:[&>*:nth-child(4n+1)]:pl-0',
        className
      )}
    >
      {children}
    </div>
  );
}

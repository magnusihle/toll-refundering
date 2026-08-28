import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * En seksjon er ÅPEN, ikke et kort.
 *
 * Landingssiden bruker «open sections and ruled rows over grids of generic
 * cards» (DESIGN.md), og Magnus fjernet dessuten hairline-topplinjene mellom
 * stegene med begrunnelsen at overskrift og luft skal skape strukturen, ikke
 * streker i en prosess-tabell. Seksjoner separeres derfor av AVSTAND alene.
 *
 * Ledger-strekene er ikke borte — de hører hjemme der data faktisk står i
 * kolonner: i tabellen, i control-margin mellom nøkkeltall, og over en fotnote.
 *
 * Avstanden MELLOM seksjoner eies av Layout (`space-y`), ikke av seksjonen selv,
 * slik at et bart element på en side får nøyaktig samme rytme som en seksjon.
 */
export function Section({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  footer,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  footer?: React.ReactNode;
}) {
  return (
    <section className={className}>
      {(title || action) && (
        <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between md:gap-8">
          <div className="min-w-0 md:max-w-[78ch]">
            {title ? <h2 className="t-section">{title}</h2> : null}
            {description ? (
              <p className="mt-1.5 text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {action ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
              {action}
            </div>
          ) : null}
        </div>
      )}
      <div className={cn(title || action ? "mt-5" : undefined, bodyClassName)}>
        {children}
      </div>
      {footer ? (
        <div className="t-small mt-7 border-t border-border-strong pt-3.5 text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/** Beholdt for kall-kompatibilitet — en tabellseksjon er nå bare en seksjon. */
export function TableSection(props: React.ComponentProps<typeof Section>) {
  return <Section {...props} />;
}

import * as React from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Amount, Num } from '@/components/ui/metric';
import { cn } from '@/lib/utils';

/**
 * The cell vocabulary every table draws from.
 *
 * Goods set the pattern — one row per real-world entity, consolidated across
 * shipments, expandable to the declarations behind it — and these are the pieces
 * that pattern is made of. Refusjon, Deklarasjoner and Leverandører render
 * their columns from exactly these, so a number, a code or a "+2 more" marker
 * looks and behaves the same wherever it appears.
 */

/** Chevron column. Always the first column of an expandable table. */
export const expandColumn = <T,>() => ({
  id: 'exp',
  header: '',
  cell: ({ row }: any) => (
    // Raden kan klikkes med mus, men affordansen må også kunne nås med tastatur.
    // Knappen bærer semantikken; radklikket er bare en bekvemmelighet.
    <button
      type="button"
      aria-expanded={row.getIsExpanded()}
      aria-label={row.getIsExpanded() ? 'Skjul detaljer' : 'Vis detaljer'}
      onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}
      className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <ChevronRight className={cn('size-4 transition-transform duration-200', row.getIsExpanded() && 'rotate-90')} />
    </button>
  ),
});

/** The row's subject: strongest text in the row, truncated with the full value on hover. */
export function Primary({ children, title, width = 'max-w-[22ch]', extra }: { children: React.ReactNode; title?: string; width?: string; extra?: number }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className={cn('truncate font-medium', width)} title={title ?? (typeof children === 'string' ? children : undefined)}>{children || '—'}</span>
      {extra ? <span className="shrink-0 text-xs font-medium text-warning">+{extra}</span> : null}
    </span>
  );
}

/** Supporting text: supplier, description, anything that qualifies the subject. */
export function Secondary({ children, title, width = 'max-w-[18ch]' }: { children: React.ReactNode; title?: string; width?: string }) {
  return <span className={cn('block truncate text-muted-foreground', width)} title={title ?? (typeof children === 'string' ? children : undefined)}>{children || '—'}</span>;
}

/** Identifiers — HS, tollnummer, article numbers. Always tabular, never wrapped. */
export function Code({ children }: { children: React.ReactNode }) {
  return <span className="whitespace-nowrap tabnum">{children || '—'}</span>;
}

export function MoneyCell({ nok, tone }: { nok: number | null | undefined; tone?: 'default' | 'muted' }) {
  return <Amount nok={nok} tabular className={cn('whitespace-nowrap', tone === 'muted' && 'text-muted-foreground')} />;
}

/** A count, optionally over a second count — "52 / 2 583 lin." The unit is required
 *  whenever `of` is given, so the slash never reads as a fraction. */
export function CountCell({ value, of, ofLabel }: { value: number; of?: number | null; ofLabel?: string }) {
  return (
    <span className="whitespace-nowrap tabnum">
      <Num value={value} />
      {of != null && of !== value
        ? <span className="text-muted-foreground"> / <Num value={of} />{ofLabel ? ` ${ofLabel}` : ''}</span>
        : null}
    </span>
  );
}

/**
 * One value plus a marker for the rest. The "+N" is the consolidation tell:
 * it means this row covers shipments that were NOT treated identically.
 */
export function MultiValue({ values, render }: { values: any[]; render?: (v: any) => React.ReactNode }) {
  if (!values?.length) return <span className="text-muted-foreground">—</span>;
  const [first, ...rest] = values;
  return (
    <span className="whitespace-nowrap">
      {render ? render(first) : first}
      {rest.length ? <span className="ml-1 text-xs font-medium text-warning">+{rest.length}</span> : null}
    </span>
  );
}

/** Days until the 3-year claim deadline. Red is reserved for ≤ 90 days. */
export function Deadline({ days, note }: { days: number | null | undefined; note?: React.ReactNode }) {
  if (days == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn('whitespace-nowrap tabnum', days <= 90 && 'font-medium text-destructive')}>
      <Num value={days} /> d{note ? <span className="ml-1 text-xs font-normal">{note}</span> : null}
    </span>
  );
}

/** first → last, or a single date when the entity only appears once. */
export function Period({ first, last }: { first?: string | null; last?: string | null }) {
  if (!first && !last) return <span className="text-muted-foreground">—</span>;
  return <span className="whitespace-nowrap text-xs text-muted-foreground">{first === last ? first : `${first ?? '—'} → ${last ?? '—'}`}</span>;
}

export function Tag({ children, variant = 'secondary' }: { children: React.ReactNode; variant?: any }) {
  return <Badge variant={variant}>{children}</Badge>;
}

/**
 * Kravtypen er en KATEGORI, ikke en tilstand.
 *
 * Den ble tidligere malt med statusvariantene (RÅK = success, Produkt = warning),
 * som både bryter DESIGN.md sin regel om at statusfarger er reservert, og lot
 * samme grønt bety «RÅK» i én kolonne og «sterk match» i nabokolonnen. Typene har
 * allerede en egen identitetsfarge — den fra diagrampaletten — så badgen bruker
 * den, og en søyle i diagrammet og en rad i tabellen får samme farge for samme type.
 */
export const KIND_COLOR: Record<string, string> = {
  Preferanse: 'var(--chart-1)',
  'RÅK': 'var(--chart-2)',
  Produkt: 'var(--chart-3)',
};

export function KindBadge({ kind }: { kind: string }) {
  const color = KIND_COLOR[kind];
  return (
    <Badge variant="secondary">
      {color ? <span aria-hidden className="size-1.5 shrink-0 rounded-xxs" style={{ background: color }} /> : null}
      {kind}
    </Badge>
  );
}

/** Opens the source SAD in a new tab without toggling the row's expansion. */
export function SadLink({ url }: { url?: string | null }) {
  if (!url) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      SAD<ExternalLink className="size-3.5" aria-hidden />
      <span className="sr-only">(åpnes i ny fane)</span>
    </a>
  );
}

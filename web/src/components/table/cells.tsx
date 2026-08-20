import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Amount, Num } from '@/components/ui/metric';
import { cn } from '@/lib/utils';

/**
 * The cell vocabulary every table draws from.
 *
 * Goods set the pattern — one row per real-world entity, consolidated across
 * shipments, expandable to the declarations behind it — and these are the pieces
 * that pattern is made of. Gjenvinning, Deklarasjoner and Leverandører render
 * their columns from exactly these, so a number, a code or a "+2 more" marker
 * looks and behaves the same wherever it appears.
 */

/** Chevron column. Always the first column of an expandable table. */
export const expandColumn = <T,>() => ({
  id: 'exp',
  header: '',
  cell: ({ row }: any) => (
    <ChevronRight className={cn('size-4 text-muted-foreground transition-transform', row.getIsExpanded() && 'rotate-90')} />
  ),
});

/** The row's subject: strongest text in the row, truncated with the full value on hover. */
export function Primary({ children, title, width = 'max-w-[22ch]', extra }: { children: React.ReactNode; title?: string; width?: string; extra?: number }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className={cn('truncate font-medium', width)} title={title ?? (typeof children === 'string' ? children : undefined)}>{children || '—'}</span>
      {extra ? <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400">+{extra}</span> : null}
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
      {rest.length ? <span className="ml-1 text-xs font-medium text-amber-600 dark:text-amber-400">+{rest.length}</span> : null}
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

/** Opens the source SAD in a new tab without toggling the row's expansion. */
export function SadLink({ url }: { url?: string | null }) {
  if (!url) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      onClick={(e) => e.stopPropagation()}
      className="whitespace-nowrap text-primary hover:underline"
    >
      SAD ↗
    </a>
  );
}

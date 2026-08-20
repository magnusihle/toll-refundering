import * as React from 'react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/lib/currency';
import { n } from '@/lib/format';

/**
 * The number layer.
 *
 * Every figure in the app is rendered through these. Two rules make the UI read
 * as one system instead of a pile of pages:
 *
 *  1. SIZE comes from a fixed scale, never from an ad-hoc text-* class.
 *     `display` is the single hero number of a view — exactly one per screen.
 *  2. TONE is semantic, not decorative. A number is `default` unless the colour
 *     itself carries meaning. There is deliberately no colour escape hatch.
 */

export const FIGURE_SIZE = {
  display: 'text-[2.5rem] leading-[1] font-semibold tracking-tight',
  lg: 'text-2xl leading-none font-semibold tracking-tight',
  md: 'text-base leading-none font-semibold',
  sm: 'text-sm leading-none font-medium',
} as const;

export const FIGURE_TONE = {
  default: 'text-foreground',
  /** Money that can actually be recovered. Reserved for the recovery headline. */
  positive: 'text-success',
  /** Deadline risk, or data that must be corrected. */
  risk: 'text-destructive',
  /** Needs verification before it can be trusted. */
  caution: 'text-amber-600 dark:text-amber-400',
  /** Context, denominators, ceilings — present but not the point. */
  muted: 'text-muted-foreground',
} as const;

export type FigureSize = keyof typeof FIGURE_SIZE;
export type FigureTone = keyof typeof FIGURE_TONE;

/** Money, in the currently selected display currency. */
export function Amount({ nok, tabular, className }: { nok: number | null | undefined; tabular?: boolean; className?: string }) {
  const { cur, convert } = useCurrency();
  const v = convert(nok ?? null);
  if (v == null) return <span className={cn(tabular && 'tabnum', className)}>—</span>;
  return <span className={cn(tabular && 'tabnum', className)}>{n(v)} {cur}</span>;
}

/** A count. Same formatter as Amount so thousands separators never disagree. */
export function Num({ value, tabular, className }: { value: number | null | undefined; tabular?: boolean; className?: string }) {
  if (value == null || isNaN(Number(value))) return <span className={cn(tabular && 'tabnum', className)}>—</span>;
  return <span className={cn(tabular && 'tabnum', className)}>{n(value)}</span>;
}

export function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('text-[11px] font-medium uppercase tracking-wider text-muted-foreground', className)}>{children}</span>;
}

export function Caption({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-xs leading-snug text-muted-foreground', className)}>{children}</p>;
}

/** label → value → hint, at one of the four sizes. The only figure layout in the app. */
export function Figure({
  label, value, hint, size = 'lg', tone = 'default', className,
}: {
  label?: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  size?: FigureSize;
  tone?: FigureTone;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      {label ? <FieldLabel className="block">{label}</FieldLabel> : null}
      <div className={cn(FIGURE_SIZE[size], FIGURE_TONE[tone], label ? 'mt-2' : undefined)}>{value}</div>
      {hint ? <Caption className="mt-1.5">{hint}</Caption> : null}
    </div>
  );
}

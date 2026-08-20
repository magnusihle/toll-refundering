import * as React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Figure, type FigureTone } from '@/components/ui/metric';

/**
 * The KPI tile. One size, one layout, one interaction model.
 *
 * A tile is either static, a link into the page that explains the number, or a
 * filter that owns its selected state. It never invents its own typography — the
 * value goes through `Figure`, so every tile on every page is the same size.
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
      {Icon ? <Icon className="absolute right-4 top-4 size-4 text-muted-foreground/40" /> : null}
      <Figure label={label} value={value} hint={hint} size="lg" tone={tone} className="pr-6" />
      {children}
    </>
  );

  const base = cn(
    'group relative flex flex-col rounded-xl border bg-card p-5 text-left shadow-sm transition-colors',
    interactive && 'hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active && 'border-primary/60 ring-1 ring-primary/30',
    className
  );

  if (to) return <Link to={to} className={base}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} aria-pressed={active} className={base}>{body}</button>;
  return <div className={base}>{body}</div>;
}

/** Tiles always sit in this grid, so a row never has two different card heights. */
export function StatRow({ children, cols = 4, className }: { children: React.ReactNode; cols?: 3 | 4; className?: string }) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', cols === 3 ? 'lg:grid-cols-3' : 'xl:grid-cols-4', className)}>
      {children}
    </div>
  );
}

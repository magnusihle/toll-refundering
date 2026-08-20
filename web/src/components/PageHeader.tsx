import * as React from 'react';
import { cn } from '@/lib/utils';

/** The one page-level heading. Section titles sit a level below this, at text-sm. */
export function PageHeader({ title, blurb, actions, className }: { title: string; blurb?: string; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-none tracking-tight">{title}</h1>
        {blurb ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{blurb}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Mutually exclusive views of the same data. The only view/filter switch in the
 * app — pages don't roll their own pill rows, so a filter always looks like a
 * filter regardless of which page it sits on.
 */
export function Segmented<T extends string>({
  value, onChange, options, className,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={cn('inline-flex h-8 items-center rounded-lg border bg-muted/40 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-7 items-center rounded-[calc(var(--radius)-5px)] px-2.5 text-xs transition-colors',
            value === o.value ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

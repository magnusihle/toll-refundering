import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

/**
 * The only card layout pages are allowed to use.
 *
 * Every section on every page gets the same padding, the same title size and the
 * same action slot, so the page rhythm is a property of the system rather than
 * something each page re-invents.
 */
export function Section({
  title, description, action, children, className, bodyClassName, footer,
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
    <Card className={cn('overflow-hidden', className)}>
      {(title || action) && (
        <div className="flex flex-col gap-3 px-5 pb-4 pt-5 md:flex-row md:items-start md:justify-between md:gap-6">
          <div className="min-w-0 md:max-w-3xl">
            {title ? <h2 className="text-sm font-semibold leading-none tracking-tight">{title}</h2> : null}
            {description ? <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">{action}</div> : null}
        </div>
      )}
      <div className={cn('px-5 pb-5', !title && !action && 'pt-5', bodyClassName)}>{children}</div>
      {footer ? <div className="border-t bg-muted/30 px-5 py-3 text-xs text-muted-foreground">{footer}</div> : null}
    </Card>
  );
}

/** A section whose body is a table: the table supplies its own edge padding. */
export function TableSection(props: React.ComponentProps<typeof Section>) {
  return <Section {...props} bodyClassName={cn('px-5 pb-5', props.bodyClassName)} />;
}

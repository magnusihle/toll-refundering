import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Tabellen som regnskapsbok, ikke som admin-grid.
 *
 * DESIGN.md: «thin ledger-like rules». Kolonnetitlene er eyebrows, radene skilles
 * av én hårfin strek, og det er ingen fylt topprad eller sebrastriper. Ytterste
 * kolonner går helt ut til tekstkanten, så tabellen står i samme spalte som
 * teksten over den i stedet for å ligge i sin egen boks.
 *
 * `border-separate` er et krav, ikke en smaksak: med `border-collapse: collapse`
 * males et `position: sticky`-tabellhode UNDER radene som ruller forbi, og
 * cellebakgrunnen dekker dem ikke. Derfor ligger alle streker på cellene.
 */
const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & {
    wrapperClassName?: string;
    /** Rullesonen selv. Den som tegner rullehintet må kunne måle den. */
    wrapperRef?: React.Ref<HTMLDivElement>;
  }
>(({ className, wrapperClassName, wrapperRef, ...props }, ref) => (
  // Rullesonen ligger HER. Et klebrig tabellhode fester seg til nærmeste
  // rullebeholder — ikke til siden — så hodet kan bare bli stående hvis det er
  // denne beholderen som ruller, både vannrett og loddrett.
  <div ref={wrapperRef} className={cn('relative w-full overflow-auto', wrapperClassName)}>
    <table
      ref={ref}
      className={cn(
        'w-full caption-bottom border-separate border-spacing-0 text-base',
        // Én utvidbar rad er sin EGEN <tbody> (se DataTable), så den klebrige
        // sammendragsraden kan pekes ut som en gruppe. Da er «siste rad» en
        // egenskap ved tabellen, ikke ved en tbody.
        '[&>tbody:last-child>tr:last-child>td]:border-b-0',
        className
      )}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <thead ref={ref} className={className} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={className} {...props} />
));
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'transition-colors [&>td]:border-b [&>td]:border-border',
      'hover:bg-surface-sunken data-[state=selected]:bg-secondary-strong/50',
      className
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      't-eyebrow h-10 border-b border-border bg-background px-3 text-left align-middle text-muted-foreground',
      'first:pl-0 last:pr-0 [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('px-3 py-3.5 align-middle first:pl-0 last:pr-0', className)} {...props} />
));
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };

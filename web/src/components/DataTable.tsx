import * as React from 'react';
import {
  ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, getExpandedRowModel, useReactTable, SortingState, Row,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, ChevronUp, ChevronsUpDown, Search, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Props<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  filterPlaceholder?: string;
  initialPageSize?: number;
  /** Seeds the search box — lets a link elsewhere in the app deep-link into a row. */
  initialFilter?: string;
  getRowCanExpand?: (row: Row<T>) => boolean;
  renderSubComponent?: (row: Row<T>) => React.ReactNode;
  toolbar?: React.ReactNode;
  /** Shown instead of the table body when there is nothing to render. */
  empty?: React.ReactNode;
}

export function DataTable<T>({
  columns, data, filterPlaceholder = 'Søk…', initialPageSize = 25, initialFilter = '',
  getRowCanExpand, renderSubComponent, toolbar, empty,
}: Props<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState(initialFilter);

  // A deep link may change the seed while the table stays mounted (same route,
  // new query string), so follow it rather than only reading it on first render.
  React.useEffect(() => { setGlobalFilter(initialFilter); }, [initialFilter]);

  const table = useReactTable({
    data, columns, state: { sorting, globalFilter },
    onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(), getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(), getRowCanExpand,
    initialState: { pagination: { pageSize: initialPageSize } },
    globalFilterFn: 'includesString',
    autoResetPageIndex: true,
  });

  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const rows = table.getRowModel().rows;
  const filtered = table.getFilteredRowModel().rows.length;
  // initialPageSize kan være hva som helst (15, 20 …); uten den i listen viser
  // Select en tom trigger fordi ingen SelectItem matcher gjeldende verdi.
  const pageSizes = React.useMemo(
    () => [...new Set([10, 25, 50, 100, initialPageSize])].sort((a, b) => a - b),
    [initialPageSize]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={filterPlaceholder}
            className="h-9 w-56 pl-8 pr-8"
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Tøm søk"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {toolbar}
        <div className="ml-auto text-sm tabnum text-muted-foreground">
          {filtered === data.length ? `${data.length} rader` : `${filtered} av ${data.length} rader`}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => {
                  const dir = h.column.getIsSorted();
                  return (
                    <TableHead
                      key={h.id}
                      className={cn('whitespace-nowrap', h.column.getCanSort() && 'cursor-pointer select-none transition-colors hover:text-foreground')}
                      onClick={h.column.getToggleSortingHandler()}
                      aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getCanSort() &&
                          (dir === 'asc' ? <ChevronUp className="size-3 text-primary" />
                            : dir === 'desc' ? <ChevronDown className="size-3 text-primary" />
                            : <ChevronsUpDown className="size-3 opacity-30" />)}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? rows.map((row) => (
              <React.Fragment key={row.id}>
                <TableRow
                  className={cn(
                    getRowCanExpand && 'cursor-pointer',
                    (row.original as any)?._flag && 'bg-destructive/5',
                    row.getIsExpanded() && 'bg-accent/40'
                  )}
                  onClick={getRowCanExpand ? () => row.toggleExpanded() : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
                {row.getIsExpanded() && renderSubComponent && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={row.getVisibleCells().length} className="bg-muted/30 p-0">{renderSubComponent(row)}</TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            )) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-28 text-center text-sm text-muted-foreground">
                  {empty ?? (globalFilter ? <>Ingen treff for «{globalFilter}».</> : 'Ingen rader')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 || data.length > 10 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rader per side</span>
            <Select value={String(table.getState().pagination.pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
              <SelectTrigger className="h-8 w-[72px]"><SelectValue /></SelectTrigger>
              <SelectContent>{pageSizes.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="mr-1 tabnum text-muted-foreground">Side {pageIndex + 1} av {Math.max(1, pageCount)}</span>
            <Button variant="outline" size="icon" className="size-8" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} aria-label="Første side"><ChevronsLeft className="size-4" /></Button>
            <Button variant="outline" size="icon" className="size-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Forrige side"><ChevronLeft className="size-4" /></Button>
            <Button variant="outline" size="icon" className="size-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Neste side"><ChevronRight className="size-4" /></Button>
            <Button variant="outline" size="icon" className="size-8" onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()} aria-label="Siste side"><ChevronsRight className="size-4" /></Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

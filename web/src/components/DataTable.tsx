import * as React from 'react';
import {
  ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, getExpandedRowModel, useReactTable, SortingState, Row,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  filterPlaceholder?: string;
  initialPageSize?: number;
  getRowCanExpand?: (row: Row<T>) => boolean;
  renderSubComponent?: (row: Row<T>) => React.ReactNode;
  toolbar?: React.ReactNode;
}

export function DataTable<T>({ columns, data, filterPlaceholder = 'Søk…', initialPageSize = 25, getRowCanExpand, renderSubComponent, toolbar }: Props<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const table = useReactTable({
    data, columns, state: { sorting, globalFilter },
    onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(), getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(), getRowCanExpand,
    initialState: { pagination: { pageSize: initialPageSize } },
    globalFilterFn: 'includesString',
  });
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const rows = table.getRowModel().rows;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder={filterPlaceholder} className="h-9 w-56" />
        {toolbar}
        <div className="ml-auto text-sm text-muted-foreground">{table.getFilteredRowModel().rows.length} rader</div>
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className={h.column.getCanSort() ? 'cursor-pointer select-none' : ''} onClick={h.column.getToggleSortingHandler()}>
                    <span className="inline-flex items-center gap-1">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getCanSort() && <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? rows.map((row) => (
              <React.Fragment key={row.id}>
                <TableRow
                  className={(getRowCanExpand ? 'cursor-pointer ' : '') + ((row.original as any)?._flag ? 'bg-destructive/5' : '')}
                  onClick={getRowCanExpand ? () => row.toggleExpanded() : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
                {row.getIsExpanded() && renderSubComponent && (
                  <TableRow className="hover:bg-transparent"><TableCell colSpan={row.getVisibleCells().length} className="bg-muted/30 p-0">{renderSubComponent(row)}</TableCell></TableRow>
                )}
              </React.Fragment>
            )) : (
              <TableRow><TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">Ingen rader</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rader per side</span>
          <Select value={String(table.getState().pagination.pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
            <SelectTrigger className="h-8 w-[72px]"><SelectValue /></SelectTrigger>
            <SelectContent>{[10, 25, 50, 100].map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Side {pageIndex + 1} av {Math.max(1, pageCount)}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

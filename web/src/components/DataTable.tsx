import * as React from 'react';
import {
  ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, getExpandedRowModel, useReactTable, SortingState, Row,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, ChevronUp, ChevronsUpDown, Search, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableToolbar } from '@/components/TableToolbar';
import { Checkbox } from '@/components/ui/checkbox';
import type { FilterDef, FilterState } from '@/lib/filters';
import type { DisplayGroup } from '@/components/TableToolbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePinnedScroll } from '@/lib/tablescroll';
import { cn } from '@/lib/utils';
import { n } from '@/lib/format';

/** Kolonnetitlene er h-10. En klebrig rad legger seg rett under dem. */
const STICKY_ROW_TOP = 40;

interface Props<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  filterPlaceholder?: string;
  initialPageSize?: number;
  /** Seeds the search box — lets a link elsewhere in the app deep-link into a row. */
  initialFilter?: string;
  getRowCanExpand?: (row: Row<T>) => boolean;
  renderSubComponent?: (row: Row<T>) => React.ReactNode;
  /** Filterdeklarasjonen. Verktøylinjen bygger panelet og brikkene av den. */
  defs?: FilterDef<T>[];
  filters?: FilterState<T>;
  /** Sidens egne visningsvalg. «Tetthet» legges alltid til av tabellen selv. */
  view?: DisplayGroup;
  /**
   * Antall rader FØR sidens filtre, og hva de heter. Tellingen vises bare når
   * filtreringen faktisk har gjort noe, og sier hva den teller — «42 av 321
   * krav», ikke «42 rader», som bare gjentok et nøkkeltall lenger oppe.
   */
  total?: number;
  unit?: string;
  /** Shown instead of the table body when there is nothing to render. */
  empty?: React.ReactNode;
  /**
   * Radvalg. Utvalget eies av SIDEN, ikke av tabellen: `ids` er valgte krav-id-er
   * (alltid flate krav), og `idsOf` sier hvilke krav en rad dekker — én for en
   * flat rad, flere for en gruppe. Da betyr avkrysning det samme i «Gruppert» og
   * «Alle krav», og utvalget overlever et modusbytte.
   */
  selection?: {
    ids: Set<string>;
    idsOf: (row: T) => string[];
    onToggle: (ids: string[], on: boolean) => void;
    bar?: React.ReactNode;
  };
}


export function DataTable<T>({
  columns, data, filterPlaceholder = 'Søk…', initialPageSize = 25, initialFilter = '',
  getRowCanExpand, renderSubComponent, defs, filters, view, total, unit = 'rader', empty, selection,
}: Props<T>) {
  // En tabell uten filtre får samme verktøylinje som alle andre — bare uten
  // filterknapp. Formen skal ikke variere med hvor mye siden tilfeldigvis kan.
  // Tetthet gjelder alle tabeller, så «Visning» står på samme sted overalt —
  // også der siden ikke har noen gruppering. Valget følger brukeren mellom
  // økter; det er en preferanse, ikke en del av utvalget, så det hører ikke
  // hjemme i URL-en.
  const [density, setDensity] = React.useState<string>(() => {
    try { return localStorage.getItem('emma-tetthet') ?? 'normal'; } catch { return 'normal'; }
  });
  const setDensityPersisted = React.useCallback((v: string) => {
    setDensity(v);
    try { localStorage.setItem('emma-tetthet', v); } catch { /* privat modus */ }
  }, []);

  const noFilters = React.useMemo<FilterState<T>>(() => ({
    value: () => '', set: () => {}, apply: (r) => r, active: [], clearAll: () => {},
  }), []);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState(initialFilter);

  // A deep link may change the seed while the table stays mounted (same route,
  // new query string), so follow it rather than only reading it on first render.
  React.useEffect(() => { setGlobalFilter(initialFilter); }, [initialFilter]);

  const cols = React.useMemo(() => {
    if (!selection) return columns;
    const { ids, idsOf, onToggle } = selection;
    const selectCol: ColumnDef<T, any> = {
      id: '__select',
      enableSorting: false,
      header: ({ table: t }) => {
        const visible = t.getFilteredRowModel().rows.flatMap((r) => idsOf(r.original as T));
        const on = visible.length > 0 && visible.every((i) => ids.has(i));
        const some = visible.some((i) => ids.has(i));
        return <Checkbox label="Velg alle i utvalget" checked={on} indeterminate={some} onChange={(v) => onToggle(visible, v)} />;
      },
      cell: ({ row }) => {
        const mine = idsOf(row.original as T);
        const on = mine.length > 0 && mine.every((i) => ids.has(i));
        const some = mine.some((i) => ids.has(i));
        return <Checkbox label="Velg rad" checked={on} indeterminate={some} onChange={(v) => onToggle(mine, v)} />;
      },
    };
    return [selectCol, ...columns];
  }, [columns, selection]);

  const table = useReactTable({
    data, columns: cols, state: { sorting, globalFilter },
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

  // Rullehintet skal fortelle sannheten: det males bare når det faktisk står en
  // kolonne til høyre for kanten, og forsvinner når du har rullet helt ut. Et
  // hint som alltid ligger der dempet den siste kolonnen på sider der ingenting
  // var skjult — da ser tabellen avkuttet ut uten å være det.
  const scroller = React.useRef<HTMLDivElement>(null);
  const [moreRight, setMoreRight] = React.useState(false);

  // Samme pass slipper taket i en åpen rad. En klebrig celle holder seg IKKE
  // innenfor sin egen <tbody> i Chrome — den er bundet av hele tabellen, og ble
  // ellers hengende under kolonnetitlene resten av listen, over rader den ikke
  // har noe med. Regelen er derfor målt: raden kleber så lenge detaljen dekker
  // linjen, og slipper i samme øyeblikk detaljen er passert.
  const expanded = table.getState().expanded;
  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => {
      setMoreRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
      const line = el.getBoundingClientRect().top + STICKY_ROW_TOP;
      el.querySelectorAll<HTMLElement>('tbody[data-open]').forEach((group) => {
        const detail = group.lastElementChild;
        group.toggleAttribute('data-stuck', !!detail && detail.getBoundingClientRect().bottom > line);
        // Underkanten av den klebrige varelinjen. En kildetabell inne i detaljen
        // legger sine egne kolonnetitler her, så de to hodene stables i stedet
        // for å dekke hverandre. Bare vi vet høyden — den følger tettheten og
        // hvor mye som brytes i raden.
        const summary = group.firstElementChild;
        if (summary) group.style.setProperty('--row-bottom', `${STICKY_ROW_TOP + Math.round(summary.getBoundingClientRect().height)}px`);
      });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    // Bredden endrer seg både når flaten endrer seg og når kolonnene gjør det
    // (filter, tetthet, nye data), så begge må observeres.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, [expanded]);

  // Samme rullesone melder seg inn i sidemodellen: siden ruller til tabellen
  // ligger under topplinjen, så tilhører hjulet tabellen, så ruller siden
  // videre. Se `lib/tablescroll.ts`.
  usePinnedScroll(scroller);

  return (
    <div className="space-y-4">
      <TableToolbar<T>
        search={globalFilter}
        onSearch={setGlobalFilter}
        searchPlaceholder={filterPlaceholder}
        defs={defs ?? []}
        filters={filters ?? noFilters}
        display={[
          ...(view ? [view] : []),
          {
            label: 'Tetthet',
            value: density,
            onChange: setDensityPersisted,
            options: [{ value: 'normal', label: 'Normal' }, { value: 'tett', label: 'Tett' }],
          },
        ]}
        countLabel={total != null && total !== data.length ? `${n(data.length)} av ${n(total)} ${unit}` : undefined}
      />

      {/* Tabellen står i SAMME spalte som resten av siden — begge kanter linjerer
          med teksten og nøkkeltallene over den. Den brøt tidligere ut av spalten
          med negative marger, fra den tiden innholdsflaten var 1280 og en
          fortollingstabell ikke fikk plass i den. Flaten er 1680 nå, og utbruddet
          gjorde bare at tabellen stakk forbi alt annet på siden og ble kuttet mot
          vinduskanten. Er den fortsatt bredere enn spalten, ruller den i sin egen
          sone i stedet for å vokse ut av siden. */}
      <div className="relative">
        {/* Uten et hint ser den avkuttede kolonnen ut som en feil i stedet for
            som «det finnes mer til høyre». Med hint der ingenting er skjult ser
            en hel tabell ut som en avkuttet en — derfor bare når det stemmer. */}
        {moreRight ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-20 w-12 bg-gradient-to-l from-background via-background/70 to-transparent"
          />
        ) : null}
        {/* Høyden er nøyaktig rulleflaten i innholdskortet (`--page-scroll`).
            Da fyller tabellen flaten når den ligger på linjen, og fasen «hjulet
            tilhører tabellen» har en synlig grunn: det er ikke noe annet på
            skjermen. */}
        <Table wrapperRef={scroller} wrapperClassName="max-h-[--page-scroll]">
          <TableHeader className="sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => {
                  const dir = h.column.getIsSorted();
                  return (
                    <TableHead
                      key={h.id}
                      className="whitespace-nowrap"
                      aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
                    >
                      {h.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className="inline-flex select-none items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {dir === 'asc' ? <ChevronUp className="size-3 text-primary" />
                            : dir === 'desc' ? <ChevronDown className="size-3 text-primary" />
                            : <ChevronsUpDown className="size-3 opacity-40" />}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </span>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          {/* Én rad = én <tbody>. Det er ikke pynt: en klebrig celle holder seg
              innenfor sin egen radgruppe, så en utvidet rad kan stå fast mens
              detaljen ruller forbi — og slippe taket i samme øyeblikk detaljen er
              passert, i stedet for å bli hengende resten av tabellen. */}
          {rows.length ? rows.map((row) => (
            <TableBody
              key={row.id}
              data-open={row.getIsExpanded() ? '' : undefined}
              /* Åpen rad: sammendraget står rett under kolonnetitlene så lenge
                 detaljen er på skjermen. Du skal aldri lese en begrunnelse uten å
                 se hvilken vare den gjelder. Bakgrunn på cellene, ikke på raden —
                 det er cellene som kleber, og radene under skal gå UNDER dem.
                 `data-stuck` settes av målingen over. z-10 er samme trinn som
                 kolonnetitlene — de to møtes aldri, for raden slippes før den
                 når dem — og legger varelinjen over kolonnetitlene i en
                 kildetabell (z-0) når den siste av dem skyves opp og ut. */
              className="[&[data-stuck]>tr:first-child>td]:sticky [&[data-stuck]>tr:first-child>td]:top-10 [&[data-stuck]>tr:first-child>td]:z-10 [&[data-stuck]>tr:first-child>td]:bg-surface-sunken"
            >
              <TableRow
                data-flagged={(row.original as any)?._flag ? '' : undefined}
                data-expanded={row.getIsExpanded() ? '' : undefined}
                className={cn(
                  density === 'tett' && '[&>td]:py-1.5',
                  // Flagget er en egenskap ved raden og skal ikke forsvinne på
                  // hover — derfor tilstandsattributter framfor rekkefølge-
                  // avhengige bakgrunnsklasser.
                  'data-[flagged]:bg-destructive/[0.06] data-[flagged]:hover:bg-destructive/[0.1]',
                  'data-[expanded]:bg-surface-sunken'
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
              {row.getIsExpanded() && renderSubComponent && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={row.getVisibleCells().length} className="bg-surface-sunken p-0">{renderSubComponent(row)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          )) : (
            <TableBody>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={cols.length} className="h-40 text-center align-middle">
                  {empty ?? (globalFilter ? (
                    <div className="mx-auto max-w-sm">
                      <p className="text-base font-medium">Ingen treff for «{globalFilter}»</p>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        Søket ser på hele raden — prøv et kortere ord, eller tøm søket for å se alle {n(data.length)} radene.
                      </p>
                      <Button variant="outline" size="sm" className="mt-4" onClick={() => setGlobalFilter('')}>
                        Tøm søket
                      </Button>
                    </div>
                  ) : (
                    <div className="mx-auto max-w-sm">
                      <p className="text-base font-medium">Ingenting å vise her ennå</p>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        Tabellen fylles når datagrunnlaget er hentet fra EMMA.
                      </p>
                    </div>
                  ))}
                </TableCell>
              </TableRow>
            </TableBody>
          )}
        </Table>
      </div>

      {selection?.bar}

      {/* Ingen paginering under et tomt resultat — en deaktivert sidevelger under
          «ingen treff» er bare støy. */}
      {rows.length > 0 && (pageCount > 1 || data.length > 10) ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rader per side</span>
            <Select value={String(table.getState().pagination.pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
              <SelectTrigger className="h-8 w-[76px] rounded-md"><SelectValue /></SelectTrigger>
              <SelectContent>{pageSizes.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="mr-1 tabnum text-muted-foreground">
              Viser {n(rows.length ? pageIndex * table.getState().pagination.pageSize + 1 : 0)}–{n(pageIndex * table.getState().pagination.pageSize + rows.length)} av {n(filtered)} {unit}
            </span>
            <Button variant="outline" size="icon-sm" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} aria-label="Første side"><ChevronsLeft className="size-4" /></Button>
            <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Forrige side"><ChevronLeft className="size-4" /></Button>
            <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Neste side"><ChevronRight className="size-4" /></Button>
            <Button variant="outline" size="icon-sm" onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()} aria-label="Siste side"><ChevronsRight className="size-4" /></Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

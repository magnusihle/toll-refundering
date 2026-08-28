import * as React from 'react';
import { AlertTriangle, Package, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TableSection } from '@/components/ui/section';
import { DataTable } from '@/components/DataTable';
import { StatCard, StatRow } from '@/components/StatCard';
import { Segmented } from '@/components/Segmented';
import { Amount, Num } from '@/components/ui/metric';
import { expandColumn, Primary, Secondary, Code, MoneyCell, CountCell, MultiValue, Period } from '@/components/table/cells';
import { RowDetail, COL, entryColumns, type DetailStrip } from '@/components/table/RowDetail';
import { useData, useEntryIndex } from '@/lib/data';
import { useFilters, type FilterDef } from '@/lib/filters';
import { n, n2, plural } from '@/lib/format';
import { groupGoods, groupSummary, lineDeviations, isProductVariance, type GoodsGroup } from '@/lib/group';
import { formatRate } from '@/lib/charges';
import { cn } from '@/lib/utils';

// Satsen er prosent for noen avgiftstyper og kroner per enhet for andre — enheten
// utledes per linje i lib/charges, aldri antatt.
const chargeStr = (cs: any[]) => cs && cs.length ? cs.map((c) => `${c.charge_type} ${formatRate(c)}`).join(', ') : '—';
const rateStr = (rates: (number | null)[], unit: string) =>
  rates.filter((r) => r != null).map((r) => n2(r) + (unit === '%' ? ' %' : unit ? ' ' + unit : '')).join(' / ');

function VarianceBadges({ g }: { g: GoodsGroup }) {
  const vs = g.variances.filter(isProductVariance);
  if (!vs.length) return <span className="text-muted-foreground">—</span>;
  const [first, ...rest] = vs;
  return (
    <span className="whitespace-nowrap" title={vs.map((v) => v.label).join(' · ')}>
      <Badge variant={first.severity === 'avvik' ? 'destructive' : 'warning'}>{first.label}</Badge>
      {rest.length ? <span className="ml-1 text-xs font-medium text-warning">+{rest.length}</span> : null}
    </span>
  );
}

/**
 * Varen sett nedenfra: hva som spriker, hva den koster totalt, og hver enkelt
 * sending den inngår i — med frist og kilde-SAD, som alle andre utvidede rader.
 */
function GroupDetail({ g }: { g: GoodsGroup }) {
  const entries = useEntryIndex();

  const strips: DetailStrip[] = g.variances.map((v) => ({
    label: v.label, tone: v.severity, values: v.values, body: v.note,
  }));

  const facts = g.charges.map((c) => ({
    label: c.charge_type,
    value: (
      <>
        {c.rates.filter((r) => r != null).length > 0 && (
          <span className={cn('mr-2 text-xs', c.rates.filter((r) => r != null).length > 1 ? 'font-medium text-warning' : 'text-muted-foreground')}>
            {rateStr(c.rates, c.unit)}
          </span>)}
        {c.source === 'vat' ? <span className="text-muted-foreground">grunnlag {n(c.base)}</span> : <Amount nok={c.amount} />}
      </>),
    flagged: c.rates.filter((r) => r != null).length > 1,
  }));

  // Kolonnene i midten er varens egne felt; identiteten og sporet tilbake til
  // fortollingen kommer fra entryColumns, likt i hver eneste utvidede rad.
  const columns = entryColumns([
    COL.plain('#', (l) => l.item_number),
    COL.code('HS', (l) => l.hs_code),
    COL.plain('Opphav', (l) => l.origin),
    COL.node('Pref.', (l) => (
      <span className="whitespace-nowrap">
        <Badge variant="outline">{l.preference_code}</Badge>{l.origin_proof ? <Badge variant="secondary" className="ml-1">SER</Badge> : null}
      </span>)),
    COL.text('Vare', (l) => l.description, 'max-w-[22ch]'),
    COL.node('Netto kg', (l) => <span className="tabnum">{n2(l.net_weight)}</span>),
    COL.node('Verdi', (l) => <span className="tabnum">{n(l.item_value)}</span>),
    COL.node('Avgifter', (l) => <span className="text-xs">{chargeStr(l.charges)}</span>),
  ], {
    deadline: (l) => entries.get(l.tollnummer)?.days_left,
    sad: (l) => entries.get(l.tollnummer)?.sad_url,
  });

  // Kolonneindeksene som kan avvike fra gruppen: HS(3), Opphav(4), Pref(5), Avgifter(9).
  const DEVIATING_COLUMN: Record<number, string> = { 3: 'hs_code', 4: 'origin', 5: 'preference_code', 9: 'vat' };

  return (
    <RowDetail
      strips={strips}
      facts={facts}
      factsLabel={`Avgifter samlet — ${plural(g.lineCount, 'linje', 'linjer')}`}
      source={{
        caption: `Inngår i ${plural(g.declCount, 'deklarasjon', 'deklarasjoner')}`,
        columns,
        rows: g.lines,
        cellFlagged: (l, j) => {
          const field = DEVIATING_COLUMN[j];
          return Boolean(field && lineDeviations(g, l).has(field));
        },
      }}
    />
  );
}

export function Goods() {
  const data = useData();
  const [mode, setMode] = React.useState<'grouped' | 'flat'>('grouped');

  const groups = React.useMemo(() => groupGoods(data.goods), [data.goods]);
  // Filteret viser bare ekte avvik (ulikt varenummer / MVA-sats / tollsats på samme
  // grunnlag). «Merk»-variasjonene — ulikt opphav, ulik preferanse, ulik skrivemåte —
  // er som regel legitime og ville druknet de som faktisk må rettes.
  const sum = React.useMemo(() => groupSummary(groups), [groups]);

  // Filteret er deklarert på GRUPPEN, fordi avviksflagget er en egenskap ved
  // gruppen. Flat visning utledes av de samme filtrerte gruppene — tidligere
  // fikk den `data.goods` ufiltrert, så «Må rettes» endret tittel og telling,
  // men ikke radene.
  const defs = React.useMemo<FilterDef<GoodsGroup>[]>(() => [{
    key: 'utvalg',
    label: 'Utvalg',
    fallback: 'alle',
    options: [
      { value: 'alle', label: 'Alle varer', count: sum.groups },
      { value: 'avvik', label: 'Må rettes', count: sum.flagged },
    ],
    apply: (list, v) => (v === 'avvik' ? list.filter((g) => g._flag) : list),
    explain: <>Ulikt varenummer, MVA-sats eller tollsats på samme vare og opphav. «Merk»-variasjoner — ulikt opphav eller skrivemåte — er som regel legitime og holdes utenfor.</>,
  }], [sum.groups, sum.flagged]);
  const filters = useFilters(defs);
  const onlyFlagged = filters.value('utvalg') === 'avvik';

  const shown = React.useMemo(() => filters.apply(groups), [filters, groups]);
  const flatRows = React.useMemo(() => shown.flatMap((g) => g.lines), [shown]);
  const groupCols = [
    expandColumn(),
    { accessorKey: 'produkt', header: 'Vare', cell: (c: any) => <Primary title={c.getValue()}>{c.getValue()}</Primary> },
    { accessorKey: 'aktor', header: 'Aktør', cell: (c: any) => { const g = c.row.original as GoodsGroup;
      return (
        <span className="flex items-baseline gap-1">
          <Secondary title={g.aktorSpellings.join(' / ')}>{c.getValue()}</Secondary>
          {g.aktorSpellings.length > 1
            ? <span className="shrink-0 text-xs font-medium text-warning">+{g.aktorSpellings.length - 1}</span>
            : null}
        </span>); } },
    { id: 'hs', header: 'HS', accessorFn: (r: GoodsGroup) => r.hs_codes.join(' '), cell: (c: any) => <MultiValue values={c.row.original.hs_codes} render={(v) => <Code>{v}</Code>} /> },
    { id: 'origin', header: 'Opphav', accessorFn: (r: GoodsGroup) => r.origins.join(' '), cell: (c: any) => <MultiValue values={c.row.original.origins} /> },
    { id: 'pref', header: 'Pref.', accessorFn: (r: GoodsGroup) => r.preference_codes.join(' '), cell: (c: any) => <MultiValue values={c.row.original.preference_codes} render={(v) => <Badge variant="outline">{v}</Badge>} /> },
    { accessorKey: 'article_number', header: 'Artikkel', cell: (c: any) => <Code>{c.getValue()}</Code> },
    { accessorKey: 'declCount', header: 'Dekl.', cell: (c: any) => <CountCell value={c.getValue()} of={c.row.original.lineCount} ofLabel="lin." /> },
    { id: 'periode', header: 'Periode', accessorFn: (r: GoodsGroup) => r.last, cell: (c: any) => <Period first={c.row.original.first} last={c.row.original.last} /> },
    { accessorKey: 'item_value', header: 'Verdi', cell: (c: any) => <span className="tabnum">{n(c.getValue())}</span> },
    { accessorKey: 'duty', header: 'Avgift', cell: (c: any) => <MoneyCell nok={c.getValue()} /> },
    { id: 'avvik', header: 'Avvik', accessorFn: (r: GoodsGroup) => r.variances.filter(isProductVariance).map((v) => v.label).join(' '), cell: (c: any) => <VarianceBadges g={c.row.original} /> },
  ];

  const flatCols = [
    { accessorKey: 'description', header: 'Vare', cell: (c: any) => <Primary title={c.getValue()}>{c.getValue()}</Primary> },
    { accessorKey: 'aktor', header: 'Aktør', cell: (c: any) => <Secondary>{c.getValue()}</Secondary> },
    { accessorKey: 'hs_code', header: 'HS', cell: (c: any) => <Code>{c.getValue()}</Code> },
    { accessorKey: 'origin', header: 'Opphav' },
    { accessorKey: 'preference_code', header: 'Pref.', cell: (c: any) => <Badge variant="outline">{c.getValue()}</Badge> },
    { accessorKey: 'article_number', header: 'Artikkel', cell: (c: any) => <Code>{c.getValue()}</Code> },
    { accessorKey: 'tollnummer', header: 'Tollnummer', cell: (c: any) => <Code>{c.getValue()}</Code> },
    { accessorKey: 'godkjent', header: 'Godkjent', cell: (c: any) => <Code>{c.getValue()}</Code> },
    { accessorKey: 'item_value', header: 'Verdi', cell: (c: any) => <span className="tabnum">{n(c.getValue())}</span> },
    { id: 'charges', header: 'Avgifter', accessorFn: (r: any) => chargeStr(r.charges) },
  ];

  const view = {
    label: 'Gruppering',
    value: mode,
    onChange: (v: string) => setMode(v as 'grouped' | 'flat'),
    options: [{ value: 'grouped', label: 'Gruppert' }, { value: 'flat', label: 'Alle linjer' }],
  };

  return (
    <>
      <StatRow cols={3}>
        <StatCard
          label="Varer" icon={Package}
          value={<Num value={sum.groups} />}
          hint={<>Konsolidert fra {n(sum.lines)} varelinjer.</>}
        />
        <StatCard
          label="Må rettes" icon={AlertTriangle}
          tone={sum.flagged ? 'risk' : 'muted'}
          value={<Num value={sum.flagged} />}
          hint={<>Av {n(sum.groups)} varer.</>}
        />
        <StatCard
          label="Merket variasjon" icon={Info} tone="caution"
          value={<Num value={sum.noted} />}
          hint="Oftest legitimt, men verdt et blikk."
        />
      </StatRow>

      <TableSection
        title={onlyFlagged ? 'Varer som må rettes' : 'Alle varer'}
      >
        {mode === 'grouped'
          ? <DataTable columns={groupCols} data={shown} filterPlaceholder="Søk vare / HS / artikkel / aktør…"
              defs={defs} filters={filters} view={view} total={groups.length} unit="varer"
              getRowCanExpand={() => true} renderSubComponent={(row) => <GroupDetail g={row.original as GoodsGroup} />}
              empty={onlyFlagged ? 'Ingen varer med avvik som må rettes.' : undefined} />
          : <DataTable columns={flatCols} data={flatRows} filterPlaceholder="Søk HS / vare / artikkel…"
              defs={defs as any} filters={filters as any} view={view} total={data.goods.length} unit="varelinjer" />}
      </TableSection>
    </>
  );
}

import * as React from 'react';
import { FileText, Layers, Coins, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TableSection } from '@/components/ui/section';
import { DataTable } from '@/components/DataTable';
import { StatCard, StatRow } from '@/components/StatCard';
import { PageHeader } from '@/components/PageHeader';
import { Segmented } from '@/components/Segmented';
import { Amount, Num } from '@/components/ui/metric';
import { expandColumn, Primary, Secondary, Code, MoneyCell, CountCell, Deadline, SadLink } from '@/components/table/cells';
import { RowDetail, COL } from '@/components/table/RowDetail';
import { useData } from '@/lib/data';
import { n, plural } from '@/lib/format';
import { formatRate } from '@/lib/charges';
import { navItemFor } from '@/lib/nav';

// Samme satsformattering som Varer: enheten utledes per linje, ikke gjettet.
const chargeStr = (cs: any[]) => cs && cs.length
  ? cs.map((c) => `${c.charge_type} ${formatRate(c)}${c.amount != null ? ' (' + n(c.amount) + ')' : ''}`).join(', ')
  : '—';

/**
 * Deklarasjonen sett nedenfra: varelinjene den består av. Samme utvidelses-
 * komponent som overalt ellers — her er kilden linjer, ikke fortollinger, så
 * identiteten er linjenummer + varenummer.
 */
function Lines({ lines }: { lines: any[] }) {
  const columns = [
    COL.plain('#', (l: any) => l.item_number),
    COL.code('HS', (l: any) => l.hs_code),
    COL.plain('Opphav', (l: any) => l.origin),
    COL.node('Pref.', (l: any) => (
      <span className="whitespace-nowrap">
        <Badge variant="outline">{l.preference_code}</Badge>{l.origin_proof ? <Badge variant="secondary" className="ml-1">SER</Badge> : null}
      </span>)),
    COL.text('Vare', (l: any) => l.description, 'max-w-[28ch]'),
    COL.code('Artikkel', (l: any) => l.article_number),
    COL.node('Verdi', (l: any) => <span className="tabnum">{n(l.item_value)}</span>),
    COL.node('Avgifter', (l: any) => <span className="text-xs">{chargeStr(l.charges)}</span>),
  ];
  return <RowDetail source={{ caption: plural(lines.length, 'varelinje', 'varelinjer'), columns, rows: lines }} />;
}

export function Declarations() {
  const data = useData();
  const [year, setYear] = React.useState('alle');

  const years = React.useMemo(
    () => ['alle', ...[...new Set(data.declarations.map((d: any) => String(d.godkjent_iso || '').slice(0, 4)).filter(Boolean))].sort()] as string[],
    [data.declarations]
  );
  const rows = React.useMemo(
    () => (year === 'alle' ? data.declarations : data.declarations.filter((d: any) => String(d.godkjent_iso || '').startsWith(year))),
    [data.declarations, year]
  );
  const totals = React.useMemo(
    () => rows.reduce((acc: any, d: any) => ({
      value: acc.value + (d.value_nok || 0),
      avg: acc.avg + (d.avg || 0),
      lines: acc.lines + (d.lines?.length || 0),
    }), { value: 0, avg: 0, lines: 0 }),
    [rows]
  );

  // Samme kolonnerekkefølge som Varer: emne → motpart → klassifisering → omfang →
  // tid → beløp → kilde.
  const cols = [
    expandColumn(),
    { accessorKey: 'tollnummer', header: 'Tollnummer', cell: (c: any) => <Primary width="max-w-none"><span className="tabnum">{c.getValue()}</span></Primary> },
    { accessorKey: 'aktor', header: 'Aktør', cell: (c: any) => <Secondary width="max-w-[24ch]">{c.getValue()}</Secondary> },
    { id: 'inco', header: 'Lev.vilkår', accessorFn: (r: any) => r.box20_incoterm || r.levvilk, cell: (c: any) => <Secondary width="max-w-[16ch]">{c.getValue()}</Secondary> },
    { id: 'lines', header: 'Linjer', accessorFn: (r: any) => r.lines.length,
      cell: (c: any) => <span className="whitespace-nowrap"><CountCell value={c.getValue()} /> <Badge variant="secondary">{c.row.original.line_source}</Badge></span> },
    { accessorKey: 'godkjent', header: 'Godkjent', cell: (c: any) => <Code>{c.getValue()}</Code> },
    { id: 'frist', header: 'Frist', accessorFn: (r: any) => r.days_left, cell: (c: any) => <Deadline days={c.getValue()} /> },
    { id: 'faktura', header: 'Faktura (orig)', accessorFn: (r: any) => r.faktura_val,
      cell: (c: any) => <span className="whitespace-nowrap tabnum text-muted-foreground">{n(c.getValue())} {c.row.original.valuta}</span> },
    { accessorKey: 'value_nok', header: 'Verdi', cell: (c: any) => <MoneyCell nok={c.getValue()} /> },
    { accessorKey: 'avg', header: 'Avgift', cell: (c: any) => <MoneyCell nok={c.getValue()} /> },
    { id: 'sad', header: 'Kilde', cell: (c: any) => <SadLink url={c.row.original.sad_url} /> },
  ];

  return (
    <>
      <PageHeader title="Deklarasjoner" blurb={navItemFor('/deklarasjoner').blurb} />

      <StatRow>
        <StatCard
          label={year === 'alle' ? 'Deklarasjoner' : `Deklarasjoner · ${year}`} icon={FileText}
          value={<Num value={rows.length} />}
          hint={year === 'alle' ? 'Hele 3-årsvinduet.' : <>Av {n(data.declarations.length)} i hele vinduet.</>}
        />
        <StatCard
          label="Varelinjer" icon={Layers}
          value={<Num value={totals.lines} />}
          hint={`Snitt ${(totals.lines / Math.max(1, rows.length)).toFixed(1)} linjer per fortolling.`}
        />
        <StatCard
          label="Verdi (NOK-basis)" icon={Coins}
          value={<Amount nok={totals.value} />}
          hint="Summert MVA-grunnlag — sammenlignbart på tvers av valuta."
        />
        <StatCard
          label="Avgifter (deklarert)" icon={Receipt}
          value={<Amount nok={totals.avg} />}
          hint={<>Deklarasjonens eget avgiftstall. Snitt <Amount nok={totals.avg / Math.max(1, rows.length)} /> per fortolling.</>}
        />
      </StatRow>

      <TableSection
        title={year === 'alle' ? 'Alle fortollinger' : `Fortollinger i ${year}`}
        description="Én rad per deklarasjon. Utvid raden for varelinjene, eller åpne kilde-SAD-en i EMMA."
        action={<Segmented value={year} onChange={setYear} options={years.map((y) => ({
          value: y,
          label: y === 'alle' ? 'Alle år' : <>{y} <span className="ml-1 tabnum opacity-60">{n(data.declarations.filter((d: any) => String(d.godkjent_iso || '').startsWith(y)).length)}</span></>,
        }))} />}
      >
        <DataTable
          columns={cols}
          data={rows}
          filterPlaceholder="Søk tollnummer / aktør…"
          getRowCanExpand={() => true}
          renderSubComponent={(row) => <Lines lines={row.original.lines} />}
        />
      </TableSection>
    </>
  );
}

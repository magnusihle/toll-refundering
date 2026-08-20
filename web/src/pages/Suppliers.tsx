import * as React from 'react';
import { Building2, Coins, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TableSection } from '@/components/ui/section';
import { DataTable } from '@/components/DataTable';
import { StatCard, StatRow } from '@/components/StatCard';
import { PageHeader } from '@/components/PageHeader';
import { Amount, Num } from '@/components/ui/metric';
import { expandColumn, Primary, Secondary, Code, MoneyCell, CountCell, MultiValue, Period, Deadline, SadLink } from '@/components/table/cells';
import { RowDetail, COL, entryColumns, type DetailStrip } from '@/components/table/RowDetail';
import { useData } from '@/lib/data';
import { n, plural } from '@/lib/format';
import { groupSuppliers, type SupplierGroup } from '@/lib/suppliers';
import { navItemFor } from '@/lib/nav';

/**
 * Leverandøren sett nedenfra: hele fortollingshistorikken, med de samme to
 * sluttkolonnene — frist og kilde-SAD — som hver annen utvidet rad. Ulik
 * skrivemåte er et funn på linje med avvikene på Varer-siden, ikke løpende tekst.
 */
function SupplierDetail({ g }: { g: SupplierGroup }) {
  const strips: DetailStrip[] = g.spellings.length > 1
    ? [{
        label: 'Ulik skrivemåte',
        tone: 'merk',
        values: g.spellings,
        body: 'Navnet er skrevet på flere måter i EMMA. Radene er slått sammen på samme leverandøridentitet som Varer-siden bruker — kontroller at det faktisk er samme leverandør.',
      }]
    : [];

  const columns = entryColumns([
    COL.plain('Lev.vilkår', (d: any) => d.box20_incoterm || d.levvilk),
    COL.num('Linjer', (d: any) => d.lines?.length ?? 0),
    COL.node('Faktura (orig)', (d: any) => (
      <span className="whitespace-nowrap tabnum text-muted-foreground">{n(d.faktura_val)} {d.valuta}</span>)),
    COL.money('Verdi', (d: any) => d.value_nok),
    COL.money('Avgift', (d: any) => d.avg),
  ]);

  return (
    <RowDetail
      strips={strips}
      source={{
        caption: `${plural(g.declCount, 'fortolling', 'fortollinger')} · ${g.sadCount} med kilde-SAD`,
        columns,
        rows: g.declarations,
      }}
    />
  );
}

export function Suppliers() {
  const data = useData();
  const groups = React.useMemo(() => groupSuppliers(data.declarations), [data.declarations]);

  const totals = React.useMemo(
    () => groups.reduce((acc, g) => ({
      value: acc.value + g.value, duty: acc.duty + g.duty, sad: acc.sad + g.sadCount,
    }), { value: 0, duty: 0, sad: 0 }),
    [groups]
  );

  // Emne → klassifisering → omfang → tid → beløp → flagg, som de andre tabellene.
  const cols = [
    expandColumn(),
    { id: 'navn', header: 'Leverandør', accessorFn: (r: SupplierGroup) => r.spellings.join(' '),
      cell: (c: any) => { const g = c.row.original as SupplierGroup;
        return <Primary width="max-w-[28ch]" title={g.spellings.join(' / ')} extra={g.spellings.length - 1}>{g.aktor}</Primary>; } },
    { id: 'valuta', header: 'Valuta', accessorFn: (r: SupplierGroup) => r.currencies.join(' '),
      cell: (c: any) => <MultiValue values={c.row.original.currencies} render={(v) => <Badge variant="outline">{v}</Badge>} /> },
    { id: 'inco', header: 'Lev.vilkår', accessorFn: (r: SupplierGroup) => r.incoterms.join(' '),
      cell: (c: any) => <MultiValue values={c.row.original.incoterms} render={(v) => <Badge variant="secondary">{v}</Badge>} /> },
    { accessorKey: 'declCount', header: 'Dekl.', cell: (c: any) => <CountCell value={c.getValue()} of={c.row.original.lineCount} ofLabel="lin." /> },
    { id: 'periode', header: 'Periode', accessorFn: (r: SupplierGroup) => r.last, cell: (c: any) => <Period first={c.row.original.first} last={c.row.original.last} /> },
    { accessorKey: 'value', header: 'Verdi', cell: (c: any) => <MoneyCell nok={c.getValue()} /> },
    { accessorKey: 'duty', header: 'Avgift', cell: (c: any) => <MoneyCell nok={c.getValue()} /> },
    { id: 'andel', header: 'Avgift av verdi', accessorFn: (r: SupplierGroup) => (r.value ? r.duty / r.value : 0),
      cell: (c: any) => <span className="tabnum">{(Number(c.getValue()) * 100).toFixed(2)} %</span> },
    { accessorKey: 'sadCount', header: 'SAD', cell: (c: any) => { const g = c.row.original as SupplierGroup;
      return <span className="whitespace-nowrap tabnum text-muted-foreground">{n(c.getValue())} / {n(g.declCount)}</span>; } },
  ];

  return (
    <>
      <PageHeader title="Leverandører" blurb={navItemFor('/leverandorer').blurb} />

      <StatRow cols={3}>
        <StatCard label="Leverandører" icon={Building2} value={<Num value={groups.length} />}
          hint={<>Slått sammen på samme leverandøridentitet som Varer bruker, på tvers av {n(data.declarations.length)} fortollinger.</>} />
        <StatCard label="Innførselsverdi" icon={Coins} value={<Amount nok={totals.value} />}
          hint="Summert MVA-grunnlag for hele 3-årsvinduet." />
        <StatCard label="Avgifter" icon={Receipt} value={<Amount nok={totals.duty} />}
          hint={<>{((totals.duty / (totals.value || 1)) * 100).toFixed(2)} % av verdien. {plural(totals.sad, 'fortolling har', 'fortollinger har')} kilde-SAD.</>} />
      </StatRow>

      <TableSection
        title="Alle leverandører"
        description={<>Én rad per leverandør. «+N» betyr at sendingene ikke var like — flere skrivemåter, valutaer eller
          leveringsvilkår. Utvid raden for hele fortollingshistorikken med lenke til kilde-SAD.</>}
      >
        <DataTable
          columns={cols}
          data={groups}
          initialPageSize={25}
          filterPlaceholder="Søk leverandør…"
          getRowCanExpand={() => true}
          renderSubComponent={(row) => <SupplierDetail g={row.original as SupplierGroup} />}
        />
      </TableSection>
    </>
  );
}

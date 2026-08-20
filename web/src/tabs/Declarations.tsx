import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/DataTable';
import { Money } from '@/components/Money';
import { n } from '@/lib/format';

const chargeStr = (cs: any[]) => cs && cs.length ? cs.map((c) => `${c.charge_type} ${c.rate != null ? c.rate + '%' : ''}${c.amount != null ? ' (' + n(c.amount) + ')' : ''}`).join(', ') : '—';

function GoodsLines({ lines }: { lines: any[] }) {
  return (
    <div className="overflow-x-auto p-3 pl-10">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase text-muted-foreground">
          <th className="p-2">#</th><th className="p-2">HS</th><th className="p-2">Opphav</th><th className="p-2">Pref.</th><th className="p-2">Vare</th><th className="p-2">Artikkel</th><th className="p-2">Verdi</th><th className="p-2">Avgifter</th></tr></thead>
        <tbody>{lines.map((l) => (
          <tr key={l.id} className="border-t border-border/60">
            <td className="p-2">{l.item_number}</td><td className="p-2">{l.hs_code}</td><td className="p-2">{l.origin}</td>
            <td className="p-2"><Badge variant="outline">{l.preference_code}</Badge>{l.origin_proof ? <Badge variant="secondary" className="ml-1">SER</Badge> : null}</td>
            <td className="p-2 text-muted-foreground">{(l.description || '').slice(0, 40)}</td><td className="p-2">{l.article_number}</td>
            <td className="p-2 tabnum">{n(l.item_value)}</td><td className="p-2">{chargeStr(l.charges)}</td></tr>))}</tbody>
      </table>
    </div>
  );
}

export function Declarations({ data }: { data: any }) {
  const cols = [
    { id: 'exp', header: '', cell: ({ row }: any) => <ChevronRight className={'h-4 w-4 text-muted-foreground transition-transform ' + (row.getIsExpanded() ? 'rotate-90' : '')} /> },
    { accessorKey: 'tollnummer', header: 'Tollnummer' },
    { accessorKey: 'godkjent', header: 'Godkjent' },
    { accessorKey: 'aktor', header: 'Aktør' },
    { id: 'inco', header: 'Lev.vilkår', accessorFn: (r: any) => r.box20_incoterm || r.levvilk },
    { id: 'faktura', header: 'Faktura (orig)', accessorFn: (r: any) => r.faktura_val, cell: (c: any) => <span className="tabnum">{n(c.getValue())} {c.row.original.valuta}</span> },
    { accessorKey: 'value_nok', header: 'Verdi', cell: (c: any) => <Money nok={c.getValue()} className="tabnum" /> },
    { accessorKey: 'avg', header: 'Avgift', cell: (c: any) => <Money nok={c.getValue()} className="tabnum" /> },
    { id: 'lines', header: 'Linjer', accessorFn: (r: any) => r.lines.length, cell: (c: any) => <span>{c.getValue()} <Badge variant="secondary">{c.row.original.line_source}</Badge></span> },
    { id: 'sad', header: 'Kilde', cell: (c: any) => c.row.original.sad_url ? <a href={c.row.original.sad_url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">SAD ↗</a> : null },
  ];
  return <DataTable columns={cols} data={data.declarations} filterPlaceholder="Søk tollnummer / aktør…"
    getRowCanExpand={() => true} renderSubComponent={(row) => <GoodsLines lines={row.original.lines} />} />;
}

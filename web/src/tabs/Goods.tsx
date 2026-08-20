import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/DataTable';
import { n } from '@/lib/format';
const chargeStr = (cs: any[]) => cs && cs.length ? cs.map((c) => `${c.charge_type} ${c.rate != null ? c.rate + '%' : ''}`).join(', ') : '—';
export function Goods({ data }: { data: any }) {
  const cols = [
    { accessorKey: 'hs_code', header: 'HS' },
    { accessorKey: 'origin', header: 'Opphav' },
    { accessorKey: 'preference_code', header: 'Pref.', cell: (c: any) => <Badge variant="outline">{c.getValue()}</Badge> },
    { accessorKey: 'description', header: 'Vare', cell: (c: any) => (c.getValue() || '').slice(0, 44) },
    { accessorKey: 'article_number', header: 'Artikkel' },
    { accessorKey: 'aktor', header: 'Aktør' },
    { accessorKey: 'tollnummer', header: 'Tollnummer' },
    { accessorKey: 'item_value', header: 'Verdi', cell: (c: any) => <span className="tabnum">{n(c.getValue())}</span> },
    { id: 'charges', header: 'Avgifter', accessorFn: (r: any) => chargeStr(r.charges) },
  ];
  return <DataTable columns={cols} data={data.goods} filterPlaceholder="Søk HS / vare / artikkel…" />;
}

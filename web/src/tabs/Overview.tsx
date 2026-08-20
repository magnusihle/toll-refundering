import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/DataTable';
import { Money } from '@/components/Money';
import { Badge } from '@/components/ui/badge';
import { useCurrency } from '@/lib/currency';
import { n } from '@/lib/format';
import { chargeCategory, CAT_LABEL } from '@/lib/charges';

function Bars({ rows, max, sel, onSel }: { rows: [string, number][]; max: number; sel: string | null; onSel: (k: string) => void }) {
  const { cur, convert } = useCurrency();
  return <div className="space-y-1.5">{rows.map(([k, v]) => (
    <button key={k} onClick={() => onSel(k)}
      className={'flex w-full items-center gap-3 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent ' + (sel === k ? 'bg-accent ring-1 ring-primary/40' : '')}>
      <span className="w-36 shrink-0 text-sm text-muted-foreground">{CAT_LABEL[k] || k}</span>
      <div className="h-2.5 rounded-full bg-primary" style={{ width: Math.max(4, Math.round((v / max) * 190)) + 'px' }} />
      <span className="tabnum text-sm">{n(convert(v))} {cur}</span>
    </button>))}</div>;
}

export function Overview({ data }: { data: any }) {
  const ins = data.insights;
  const [sel, setSel] = React.useState<string | null>(null);

  // flat per-charge list for the drill-down
  const charges = React.useMemo(() => {
    const out: any[] = [];
    for (const g of data.goods) for (const c of (g.charges || []))
      out.push({ cat: chargeCategory(c), tollnummer: g.tollnummer, aktor: g.aktor, hs_code: g.hs_code, description: g.description, charge_type: c.charge_type, rate: c.rate, base: c.base, amount: c.amount });
    return out;
  }, [data]);

  const cats = Object.entries(ins.chargeBreakdown.byCategory).filter(([, v]) => Number(v)).sort((a: any, b: any) => b[1] - a[1]) as [string, number][];
  const cmax = Math.max(1, ...cats.map((c) => c[1]));
  const tmax = Math.max(1, ...ins.trend.map((t: any) => t.declarations));
  const { cur, convert } = useCurrency();

  const drill = React.useMemo(() => sel ? charges.filter((c) => c.cat === sel) : [], [sel, charges]);
  const drillCols = [
    { accessorKey: 'charge_type', header: 'Type', cell: (c: any) => <Badge variant="secondary">{c.getValue()}</Badge> },
    { accessorKey: 'hs_code', header: 'HS' },
    { accessorKey: 'description', header: 'Vare', cell: (c: any) => (c.getValue() || '').slice(0, 40) },
    { accessorKey: 'aktor', header: 'Aktør' },
    { accessorKey: 'tollnummer', header: 'Tollnummer' },
    { accessorKey: 'rate', header: 'Sats', cell: (c: any) => <span className="tabnum">{c.getValue()}</span> },
    { accessorKey: 'amount', header: 'Beløp', cell: (c: any) => <Money nok={c.getValue()} className="tabnum" /> },
  ];

  const supCols = [
    { accessorKey: 'aktor', header: 'Aktør' },
    { accessorKey: 'declarations', header: 'Dekl.', cell: (c: any) => <span className="tabnum">{c.getValue()}</span> },
    { accessorKey: 'mva_grunnlag', header: 'Verdi (NOK-basis)', cell: (c: any) => <Money nok={c.getValue()} className="tabnum" /> },
    { accessorKey: 'avgift', header: 'Avgift', cell: (c: any) => <Money nok={c.getValue()} className="tabnum" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Avgifter betalt — etter type</CardTitle></CardHeader>
          <CardContent><Bars rows={cats} max={cmax} sel={sel} onSel={(k) => setSel(sel === k ? null : k)} />
            <p className="mt-3 text-xs text-muted-foreground">Klikk en kategori for å se linjene. RÅK (RT) varierer legitimt per produkt og flagges ikke her.</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Deklarasjoner per måned</CardTitle></CardHeader>
          <CardContent><div className="space-y-2">{ins.trend.map((t: any) => (
            <div key={t.month} className="flex items-center gap-3"><span className="w-20 shrink-0 text-sm text-muted-foreground">{t.month}</span>
              <div className="h-2.5 rounded-full bg-primary" style={{ width: Math.max(4, Math.round((t.declarations / tmax) * 180)) + 'px' }} />
              <span className="tabnum text-sm">{t.declarations} dekl · MVA25 {n(convert(t.mva25))} {cur}</span></div>))}</div></CardContent></Card>
      </div>

      {sel && <Card><CardHeader><CardTitle>{CAT_LABEL[sel] || sel} — {drill.length} linjer</CardTitle></CardHeader>
        <CardContent><DataTable columns={drillCols} data={drill} filterPlaceholder="Søk HS / vare / aktør…" initialPageSize={10} /></CardContent></Card>}

      <Card><CardHeader><CardTitle>Største leverandører</CardTitle></CardHeader>
        <CardContent><DataTable columns={supCols} data={ins.suppliers.topSuppliers} initialPageSize={10} filterPlaceholder="Søk aktør…" /></CardContent></Card>
    </div>
  );
}

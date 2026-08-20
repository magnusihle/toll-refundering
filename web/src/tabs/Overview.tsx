import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/DataTable';
import { Money } from '@/components/Money';
import { Badge } from '@/components/ui/badge';
import { useCurrency } from '@/lib/currency';
import { n } from '@/lib/format';
import { chargeCategory, CAT_LABEL } from '@/lib/charges';
import { keyIndex, dominant } from '@/lib/group';
import { ChevronRight } from 'lucide-react';

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

  // flat per-charge list for the drill-down. `gkey` er samme vareidentitet som
  // Varer-fanen grupperer på, så drill-downen kan konsolideres på nøyaktig samme måte.
  const charges = React.useMemo(() => {
    const keys = keyIndex(data.goods);
    const out: any[] = [];
    for (const g of data.goods) for (const c of (g.charges || []))
      out.push({ cat: chargeCategory(c), gkey: keys.get(g), tollnummer: g.tollnummer, godkjent: g.godkjent, aktor: g.aktor, hs_code: g.hs_code, description: g.description, charge_type: c.charge_type, rate: c.rate, base: c.base, amount: c.amount });
    return out;
  }, [data]);

  const cats = Object.entries(ins.chargeBreakdown.byCategory).filter(([, v]) => Number(v)).sort((a: any, b: any) => b[1] - a[1]) as [string, number][];
  const cmax = Math.max(1, ...cats.map((c) => c[1]));
  const tmax = Math.max(1, ...ins.trend.map((t: any) => t.declarations));
  const { cur, convert } = useCurrency();

  const drill = React.useMemo(() => sel ? charges.filter((c) => c.cat === sel) : [], [sel, charges]);
  // Samme konsolidering som Varer-fanen: én rad per (vare, avgiftstype) i stedet for én
  // per sending. Flere satser på samme vare markeres — det er der pengene ligger.
  const drillGrouped = React.useMemo(() => {
    const m = new Map<string, any>();
    for (const c of drill) {
      const k = c.gkey + '§' + c.charge_type;
      let g = m.get(k);
      if (!g) { g = { key: k, charge_type: c.charge_type, aktor: c.aktor, hs_codes: [] as string[], rates: [] as any[], descs: [] as string[], tollnummers: new Set<string>(), amount: 0, base: 0, items: [] as any[] }; m.set(k, g); }
      g.amount += Number(c.amount) || 0; g.base += Number(c.base) || 0;
      g.tollnummers.add(c.tollnummer); g.items.push(c); g.descs.push(c.description || '');
      if (c.hs_code && !g.hs_codes.includes(c.hs_code)) g.hs_codes.push(c.hs_code);
      if (!g.rates.some((r: any) => r === (c.rate ?? null))) g.rates.push(c.rate ?? null);
    }
    return [...m.values()].map((g) => ({
      ...g, description: dominant(g.descs) || '', declCount: g.tollnummers.size,
      rates: g.rates.sort((a: any, b: any) => (a ?? 0) - (b ?? 0)),
      _flag: g.rates.filter((r: any) => r != null).length > 1 && g.hs_codes.length === 1,
    })).sort((a, b) => b.amount - a.amount);
  }, [drill]);
  const [drillMode, setDrillMode] = React.useState<'grouped' | 'flat'>('grouped');

  const drillCols = [
    { accessorKey: 'charge_type', header: 'Type', cell: (c: any) => <Badge variant="secondary">{c.getValue()}</Badge> },
    { accessorKey: 'hs_code', header: 'HS' },
    { accessorKey: 'description', header: 'Vare', cell: (c: any) => (c.getValue() || '').slice(0, 40) },
    { accessorKey: 'aktor', header: 'Aktør' },
    { accessorKey: 'tollnummer', header: 'Tollnummer' },
    { accessorKey: 'rate', header: 'Sats', cell: (c: any) => <span className="tabnum">{c.getValue()}</span> },
    { accessorKey: 'amount', header: 'Beløp', cell: (c: any) => <Money nok={c.getValue()} className="tabnum" /> },
  ];
  const drillGroupCols = [
    { id: 'exp', header: '', cell: ({ row }: any) => <ChevronRight className={'h-4 w-4 text-muted-foreground transition-transform ' + (row.getIsExpanded() ? 'rotate-90' : '')} /> },
    { accessorKey: 'charge_type', header: 'Type', cell: (c: any) => <Badge variant="secondary">{c.getValue()}</Badge> },
    { id: 'hs', header: 'HS', accessorFn: (r: any) => r.hs_codes.join(' '), cell: (c: any) => { const h = c.row.original.hs_codes; return <span className="tabnum whitespace-nowrap">{h[0] || '—'}{h.length > 1 ? <span className="ml-1 text-xs font-medium text-amber-600 dark:text-amber-400">+{h.length - 1}</span> : null}</span>; } },
    { accessorKey: 'description', header: 'Vare', cell: (c: any) => (c.getValue() || '').slice(0, 36) },
    { accessorKey: 'aktor', header: 'Aktør', cell: (c: any) => (c.getValue() || '').slice(0, 24) },
    { accessorKey: 'declCount', header: 'Dekl.', cell: (c: any) => <span className="tabnum">{c.getValue()}</span> },
    { id: 'rates', header: 'Sats', accessorFn: (r: any) => r.rates.join(' '), cell: (c: any) => { const r = c.row.original.rates.filter((x: any) => x != null); return <span className={'tabnum whitespace-nowrap ' + (r.length > 1 ? 'font-medium text-amber-600 dark:text-amber-400' : '')}>{r.length ? r.join(' / ') : '—'}</span>; } },
    { accessorKey: 'amount', header: 'Beløp', cell: (c: any) => <Money nok={c.getValue()} className="tabnum" /> },
  ];
  const drillSub = (row: any) => (
    <div className="overflow-x-auto p-3 pl-10">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase text-muted-foreground">
          <th className="p-2">Tollnummer</th><th className="p-2">Godkjent</th><th className="p-2">HS</th><th className="p-2">Vare</th><th className="p-2">Sats</th><th className="p-2">Grunnlag</th><th className="p-2">Beløp</th></tr></thead>
        <tbody>{row.original.items.map((it: any, i: number) => (
          <tr key={it.tollnummer + '-' + i} className="border-t border-border/60">
            <td className="p-2 tabnum">{it.tollnummer}</td><td className="p-2 whitespace-nowrap">{it.godkjent}</td>
            <td className="p-2 tabnum">{it.hs_code}</td><td className="p-2 text-muted-foreground">{(it.description || '').slice(0, 34)}</td>
            <td className="p-2 tabnum">{it.rate ?? '—'}</td><td className="p-2 tabnum">{n(it.base)}</td>
            <td className="p-2 tabnum"><Money nok={it.amount} /></td></tr>))}</tbody>
      </table>
    </div>);
  const drillToolbar = (
    <div className="flex overflow-hidden rounded-lg border">
      {(['grouped', 'flat'] as const).map((m) => (
        <button key={m} onClick={() => setDrillMode(m)}
          className={'px-3 py-1.5 text-sm transition-colors ' + (drillMode === m ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-accent')}>
          {m === 'grouped' ? 'Gruppert' : 'Alle linjer'}</button>))}
    </div>);

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

      {sel && <Card><CardHeader><CardTitle>{CAT_LABEL[sel] || sel} — {drillGrouped.length} varer / {drill.length} linjer</CardTitle></CardHeader>
        <CardContent>{drillMode === 'grouped'
          ? <DataTable columns={drillGroupCols} data={drillGrouped} filterPlaceholder="Søk HS / vare / aktør…" initialPageSize={10} toolbar={drillToolbar}
              getRowCanExpand={() => true} renderSubComponent={drillSub} />
          : <DataTable columns={drillCols} data={drill} filterPlaceholder="Søk HS / vare / aktør…" initialPageSize={10} toolbar={drillToolbar} />}</CardContent></Card>}

      <Card><CardHeader><CardTitle>Største leverandører</CardTitle></CardHeader>
        <CardContent><DataTable columns={supCols} data={ins.suppliers.topSuppliers} initialPageSize={10} filterPlaceholder="Søk aktør…" /></CardContent></Card>
    </div>
  );
}

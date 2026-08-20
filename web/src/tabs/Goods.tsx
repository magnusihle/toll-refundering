import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/DataTable';
import { Money } from '@/components/Money';
import { n, n2 } from '@/lib/format';
import { groupGoods, groupSummary, lineDeviations, isProductVariance, type GoodsGroup } from '@/lib/group';

const chargeStr = (cs: any[]) => cs && cs.length ? cs.map((c) => `${c.charge_type} ${c.rate != null ? c.rate + '%' : ''}`).join(', ') : '—';
const rateStr = (rates: (number | null)[]) => rates.filter((r) => r != null).map((r) => n2(r) + '%').join(' / ');

/** Verdi + «+N til» når gruppen har flere. Gjør spriket synlig uten å bryte kolonnen. */
function Multi({ values, render }: { values: any[]; render?: (v: any) => React.ReactNode }) {
  if (!values.length) return <span className="text-muted-foreground">—</span>;
  const [first, ...rest] = values;
  return (
    <span className="whitespace-nowrap">{render ? render(first) : first}
      {rest.length ? <span className="ml-1 text-xs font-medium text-amber-600 dark:text-amber-400">+{rest.length}</span> : null}</span>
  );
}

function VarianceBadges({ g }: { g: GoodsGroup }) {
  const vs = g.variances.filter(isProductVariance);
  if (!vs.length) return <span className="text-xs text-muted-foreground">—</span>;
  return <span className="flex flex-wrap gap-1">{vs.map((v) => (
    <Badge key={v.field} variant={v.severity === 'avvik' ? 'destructive' : 'warning'}>{v.label}</Badge>))}</span>;
}

/** Utvidet visning: alle deklarasjonene varen har inngått i, med kostnadene per linje. */
function GroupDetail({ g }: { g: GoodsGroup }) {
  return (
    <div className="space-y-4 p-4 pl-10">
      {g.variances.length > 0 && (
        <div className="space-y-1.5">
          {g.variances.map((v) => (
            <div key={v.field} className={'rounded-md p-2.5 text-sm ' + (v.severity === 'avvik' ? 'bg-destructive/5' : 'bg-amber-500/10')}>
              <span className="inline-flex items-center gap-2">
                <Badge variant={v.severity === 'avvik' ? 'destructive' : 'warning'}>{v.label}</Badge>
                <span className="tabnum text-xs text-muted-foreground">{v.values.map((x) => (x == null ? '—' : String(x))).join(' · ')}</span>
              </span>
              {v.note && <p className="mt-1 text-xs text-muted-foreground">{v.note}</p>}
            </div>))}
        </div>)}

      <div>
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Avgifter samlet — {g.lineCount} linjer</div>
        <div className="flex flex-wrap gap-2">
          {g.charges.length ? g.charges.map((c) => (
            <div key={c.key} className="rounded-md border px-3 py-1.5 text-sm">
              <span className="font-medium">{c.charge_type}</span>
              {c.rates.filter((r) => r != null).length > 0 &&
                <span className={'ml-1.5 tabnum text-xs ' + (c.rates.filter((r) => r != null).length > 1 ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>{rateStr(c.rates)}</span>}
              <span className="ml-2 tabnum">{c.source === 'vat' ? <span className="text-muted-foreground">grunnlag {n(c.base)}</span> : <Money nok={c.amount} />}</span>
            </div>)) : <span className="text-sm text-muted-foreground">Ingen avgifter registrert.</span>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Inngår i {g.declCount} deklarasjoner</div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-muted-foreground">
            <th className="p-2">Tollnummer</th><th className="p-2">Godkjent</th><th className="p-2">#</th><th className="p-2">HS</th>
            <th className="p-2">Opphav</th><th className="p-2">Pref.</th><th className="p-2">Vare</th><th className="p-2">Netto kg</th>
            <th className="p-2">Verdi</th><th className="p-2">Avgifter</th></tr></thead>
          <tbody>{g.lines.map((l) => {
            const dev = lineDeviations(g, l);
            const mark = (f: string) => 'p-2' + (dev.has(f) ? ' bg-destructive/10 font-medium' : '');
            return (
              <tr key={l.id ?? l.tollnummer + '-' + l.item_number} className="border-t border-border/60">
                <td className="p-2 tabnum">{l.tollnummer}</td>
                <td className="p-2 whitespace-nowrap">{l.godkjent}</td>
                <td className="p-2">{l.item_number}</td>
                <td className={mark('hs_code') + ' tabnum'}>{l.hs_code}</td>
                <td className={mark('origin')}>{l.origin}</td>
                <td className={mark('preference_code')}><Badge variant="outline">{l.preference_code}</Badge>{l.origin_proof ? <Badge variant="secondary" className="ml-1">SER</Badge> : null}</td>
                <td className="p-2 text-muted-foreground">{(l.description || '').slice(0, 34)}</td>
                <td className="p-2 tabnum">{n2(l.net_weight)}</td>
                <td className="p-2 tabnum">{n(l.item_value)}</td>
                <td className={mark('vat') + ' text-xs'}>{chargeStr(l.charges)}</td>
              </tr>);
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

export function Goods({ data }: { data: any }) {
  const [mode, setMode] = React.useState<'grouped' | 'flat'>('grouped');
  const [onlyFlagged, setOnlyFlagged] = React.useState(false);

  const groups = React.useMemo(() => groupGoods(data.goods), [data.goods]);
  // Filteret viser bare ekte avvik (ulikt varenummer / MVA-sats / tollsats på samme
  // grunnlag). «Merk»-variasjonene — ulikt opphav, ulik preferanse, ulik skrivemåte —
  // er som regel legitime og ville druknet de 60 som faktisk må rettes.
  const shown = React.useMemo(() => (onlyFlagged ? groups.filter((g) => g._flag) : groups), [groups, onlyFlagged]);
  const sum = React.useMemo(() => groupSummary(groups), [groups]);

  const groupCols = [
    { id: 'exp', header: '', cell: ({ row }: any) => <ChevronRight className={'h-4 w-4 text-muted-foreground transition-transform ' + (row.getIsExpanded() ? 'rotate-90' : '')} /> },
    { accessorKey: 'produkt', header: 'Vare', cell: (c: any) => <span title={c.getValue()}>{(c.getValue() || '').slice(0, 40)}</span> },
    { accessorKey: 'aktor', header: 'Aktør', cell: (c: any) => { const g = c.row.original as GoodsGroup; return <span title={g.aktorSpellings.join(' / ')}>{(c.getValue() || '').slice(0, 24)}{g.aktorSpellings.length > 1 ? <span className="ml-1 text-xs font-medium text-amber-600 dark:text-amber-400">+{g.aktorSpellings.length - 1}</span> : null}</span>; } },
    { id: 'hs', header: 'HS', accessorFn: (r: GoodsGroup) => r.hs_codes.join(' '), cell: (c: any) => <Multi values={c.row.original.hs_codes} render={(v) => <span className="tabnum">{v}</span>} /> },
    { id: 'origin', header: 'Opphav', accessorFn: (r: GoodsGroup) => r.origins.join(' '), cell: (c: any) => <Multi values={c.row.original.origins} /> },
    { id: 'pref', header: 'Pref.', accessorFn: (r: GoodsGroup) => r.preference_codes.join(' '), cell: (c: any) => <Multi values={c.row.original.preference_codes} render={(v) => <Badge variant="outline">{v}</Badge>} /> },
    { accessorKey: 'article_number', header: 'Artikkel' },
    { accessorKey: 'declCount', header: 'Dekl.', cell: (c: any) => <span className="tabnum whitespace-nowrap">{c.getValue()}{c.row.original.lineCount !== c.getValue() ? <span className="text-muted-foreground"> / {c.row.original.lineCount} lin.</span> : null}</span> },
    { id: 'periode', header: 'Periode', accessorFn: (r: GoodsGroup) => r.last, cell: (c: any) => { const g = c.row.original as GoodsGroup; return <span className="whitespace-nowrap text-xs text-muted-foreground">{g.first === g.last ? g.first : `${g.first} → ${g.last}`}</span>; } },
    { accessorKey: 'item_value', header: 'Verdi', cell: (c: any) => <span className="tabnum">{n(c.getValue())}</span> },
    { accessorKey: 'duty', header: 'Avgift', cell: (c: any) => <Money nok={c.getValue()} className="tabnum" /> },
    { id: 'avvik', header: 'Avvik', accessorFn: (r: GoodsGroup) => r.variances.filter(isProductVariance).map((v) => v.label).join(' '), cell: (c: any) => <VarianceBadges g={c.row.original} /> },
  ];

  const flatCols = [
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

  const toolbar = (
    <>
      <div className="flex overflow-hidden rounded-lg border">
        {(['grouped', 'flat'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={'px-3 py-1.5 text-sm transition-colors ' + (mode === m ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-accent')}>
            {m === 'grouped' ? 'Gruppert' : 'Alle linjer'}
          </button>))}
      </div>
      {mode === 'grouped' && (
        <Button variant={onlyFlagged ? 'default' : 'outline'} size="sm" onClick={() => setOnlyFlagged((v) => !v)}>
          Kun avvik ({sum.flagged})
        </Button>)}
    </>
  );

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        Samme vare fra samme leverandør får én varelinje per sending. Her er de <b>slått sammen til én rad per vare</b>:
        {' '}<b>{n(sum.lines)}</b> varelinjer → <b>{n(sum.groups)}</b> varer. Utvid en rad for å se alle deklarasjonene
        varen har inngått i, med avgifter per linje.
        {' '}<b className="text-destructive">{sum.flagged}</b> varer er behandlet ulikt på tvers av sendingene på en måte som
        må rettes — ulikt varenummer, ulik MVA-sats, eller ulik tollsats på samme varenummer og opphav.
        {sum.noted ? <> Ytterligere {sum.noted} har variasjon som oftest er legitim (ulikt opphav, ulik preferanse per sending,
        ulik skrivemåte på avsender); de er merket gult.</> : null}
      </p>
      {mode === 'grouped'
        ? <DataTable columns={groupCols} data={shown} filterPlaceholder="Søk vare / HS / artikkel / aktør…" toolbar={toolbar}
            getRowCanExpand={() => true} renderSubComponent={(row) => <GroupDetail g={row.original as GoodsGroup} />} />
        : <DataTable columns={flatCols} data={data.goods} filterPlaceholder="Søk HS / vare / artikkel…" toolbar={toolbar} />}
    </div>
  );
}

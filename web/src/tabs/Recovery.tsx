import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/DataTable';
import { Money } from '@/components/Money';
import { Download } from 'lucide-react';
import { TYPES, agg, rowsFor } from '@/lib/recovery';

const kindVariant: Record<string, any> = { Preferanse: 'default', 'RÅK': 'success', Produkt: 'warning' };
const confLabel = (v: any) => v === 'strong' ? 'sterk' : v === 'weak' ? 'svak' : v === 'possible' ? 'mulig' : v === 'review' ? 'til gjennomgang' : v === 'raak_grant' ? 'nedsettelse funnet' : v;
const confVariant = (v: any) => v === 'strong' ? 'success' : v === 'weak' ? 'warning' : v === 'review' ? 'outline' : v === 'raak_grant' ? 'warning' : 'secondary';
const likVariant = (v: any) => v === 'høy' ? 'success' : v === 'middels' ? 'warning' : v === 'lav' ? 'destructive' : 'secondary';

function exportCsv(rows: any[], suffix: string) {
  const cols = ['kind', 'tollnummer', 'godkjent', 'aktor', 'produkt', 'confidence', 'likelihood', 'amount_nok', 'frist', 'dager_igjen', 'summary', 'action', 'claim_draft'];
  const head = ['Type', 'Tollnummer', 'Godkjent', 'Aktør', 'Produkt', 'Match', 'Sannsynlighet', 'Beløp (NOK)', 'Frist', 'Dager igjen', 'Hva det er', 'Neste steg', 'Utkast til krav'];
  const esc = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = [head.map(esc).join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'emma-gjenvinning' + suffix + '.csv'; a.click(); URL.revokeObjectURL(a.href);
}

export function Recovery({ data, kind: kindProp, setKind: setKindProp }: { data: any; kind?: string; setKind?: (k: string) => void }) {
  const act = data.insights.actions;
  const cov = data.insights.coverage;
  const raak = data.insights.raak;
  const [localKind, setLocalKind] = React.useState('alle');
  const kind = kindProp ?? localKind;
  const setKind = setKindProp ?? setLocalKind;
  const hasAgent = act.rows.some((r: any) => r.likelihood);

  const byType = React.useMemo(() => Object.fromEntries(TYPES.map((k) => [k, agg(rowsFor(act.rows, k))])), [act.rows]);
  const rows = React.useMemo(() => rowsFor(act.rows, kind), [kind, act.rows]);
  const a = byType[kind];

  const cols = [
    { id: 'exp', header: '', cell: ({ row }: any) => <span className={'text-muted-foreground transition-transform inline-block ' + (row.getIsExpanded() ? 'rotate-90' : '')}>▸</span> },
    { accessorKey: 'kind', header: 'Type', cell: (c: any) => <Badge variant={kindVariant[c.getValue()] || 'secondary'}>{c.getValue()}</Badge> },
    { accessorKey: 'aktor', header: 'Aktør' },
    { accessorKey: 'produkt', header: 'Produkt', cell: (c: any) => (c.getValue() || '').slice(0, 28) },
    { accessorKey: 'tollnummer', header: 'Tollnummer' },
    { id: 'frist', header: 'Frist', accessorFn: (r: any) => r.dager_igjen, cell: (c: any) => { const d = c.getValue(); if (d == null) return <span className="text-muted-foreground">—</span>; return <span className={d <= 90 ? 'text-destructive font-medium' : ''}>{d} d</span>; } },
    { accessorKey: 'confidence', header: 'Match', cell: (c: any) => <Badge variant={confVariant(c.getValue())}>{confLabel(c.getValue())}</Badge> },
    ...(hasAgent ? [{ accessorKey: 'likelihood', header: 'Gjenv.', cell: (c: any) => c.getValue() ? <Badge variant={likVariant(c.getValue())}>{c.getValue()}</Badge> : <span className="text-muted-foreground">—</span> }] : []),
    { accessorKey: 'amount_nok', header: 'Beløp', cell: (c: any) => <Money nok={c.getValue()} className="tabnum font-semibold text-destructive" /> },
  ];
  const sub = (row: any) => { const r = row.original; return (
    <div className="space-y-2 p-4 pl-10">
      <div><span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hva det er</span><p className="text-sm">{r.summary}</p></div>
      <div className="rounded-md bg-primary/5 p-3"><span className="text-xs font-medium uppercase tracking-wide text-primary">Neste steg</span><p className="text-sm">{r.action}</p></div>
      {r.reasoning && <div className="rounded-md bg-muted/60 p-3"><span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agent-vurdering ({r.likelihood} sannsynlighet)</span><p className="text-sm">{r.reasoning}</p></div>}
      {r.claim_draft && <div className="rounded-md border p-3"><span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Utkast til krav</span><p className="whitespace-pre-wrap text-sm">{r.claim_draft}</p></div>}
    </div>); };

  return (
    <div className="space-y-4">
      {/* Type-velger: styrer BÅDE toppkortene og denne fanen. Hver knapp viser typens beløp. */}
      <div className="flex flex-wrap gap-2">
        {TYPES.map((k) => (
          <button key={k} onClick={() => setKind(k)}
            className={'rounded-lg border px-4 py-2 text-left transition-colors ' + (kind === k ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'hover:bg-accent')}>
            <div className="text-sm font-semibold tabnum"><Money nok={byType[k].total} /></div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k === 'alle' ? 'Alle typer' : k} · {byType[k].count}</div>
          </button>
        ))}
        <div className="ml-auto self-center text-sm text-muted-foreground">Velg type — toppkortene og listen oppdateres.</div>
      </div>

      <Card><CardHeader><CardTitle>Slik henter du besparelsene{kind !== 'alle' ? ' — ' + kind : ''}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="ml-4 list-decimal space-y-1">
            <li>Last ned {kind === 'alle' ? 'gjenvinningslisten' : kind + '-listen'} (CSV) — den har skriftlig oppsummering + neste steg per post.</li>
            <li>Send den til <b>DSV / 3PL</b> og be om <b>omberegning i TVINN</b> for de flaggede linjene.</li>
            <li><b>Preferanse:</b> gyldig opprinnelsesbevis. <b>RÅK:</b> oppgi <b>skrivnummeret</b> (ofte enklest å rette — vedtaket finnes allerede). <b>Produkt:</b> avklar HS/MVA-sats.</li>
            <li><b>Frist: 3 år</b> etter fortolling — «Haster»-postene foreldes snart, ta dem først.</li>
            <li><b>Fremover:</b> be 3PL alltid legge inn preferanse + RÅK-skrivnummer, så unngås ny overbetaling.</li>
          </ol>
          {cov ? <p className="text-xs">Datagrunnlag: {cov.n} deklarasjoner ({cov.first || '—'} – {cov.last || '—'}). 3-årsvindu fra {cov.window?.from}.{cov.beforeWindow ? ` ${cov.beforeWindow} eldre er utelatt (foreldet).` : ''}</p> : null}
          <p className="text-xs">«Sannsynlig (vektet)» i toppkortene er beløp vektet med match-styrke{hasAgent ? '/agentvurdering' : ''} — et forsiktig anslag, ikke garantert refusjon.</p>
          {!hasAgent && <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">Agent-vurdering (sannsynlighet + begrunnelse + kravutkast) kjøres når 3-årshentingen er ferdig — da forfines «sannsynlig gjenvinning».</p>}
          <Button variant="outline" onClick={() => exportCsv(rows, kind === 'alle' ? '' : '-' + kind)}><Download />Last ned {kind === 'alle' ? 'hele listen' : kind + '-listen'} (CSV)</Button>
        </CardContent></Card>

      <Card><CardHeader><CardTitle>{kind === 'alle' ? 'Alle poster' : kind + '-poster'} ({a.count}) — sortert etter beløp</CardTitle></CardHeader>
        <CardContent><DataTable columns={cols} data={rows} filterPlaceholder="Søk produkt / aktør / tollnummer…" getRowCanExpand={() => true} renderSubComponent={sub} /></CardContent></Card>

      {raak?.notGrantedOnDate > 0 && (kind === 'alle' || kind === 'RÅK') && (
        <Card><CardHeader><CardTitle>RÅK-kontroll: vedtaket gjaldt ikke på fortollingsdatoen ({raak.notGrantedOnDate} linjer)</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-3 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              Produktet finnes i nedsettelsesregisteret, men vedtaket var <b>ikke gyldig</b> da varen ble fortollet
              (innvilget senere, utløpt, eller annen landgruppe). Hver linje er testet mot vedtakets <b>gyldig f.o.m. – t.o.m.</b>
              Disse er <b>ikke krav</b> — de vises for å hindre feilkrav, og for å fange opp vedtak som må fornyes.
            </p>
            <DataTable
              columns={[
                { id: 'exp', header: '', cell: ({ row }: any) => <span className={'text-muted-foreground transition-transform inline-block ' + (row.getIsExpanded() ? 'rotate-90' : '')}>▸</span> },
                { accessorKey: 'tollnummer', header: 'Tollnummer' },
                { accessorKey: 'godkjent', header: 'Fortollet' },
                { accessorKey: 'description', header: 'Deklarert vare', cell: (c: any) => (c.getValue() || '').slice(0, 30) },
                { accessorKey: 'status', header: 'Årsak', cell: (c: any) => { const v = c.getValue();
                  const map: Record<string, [string, string]> = { ikke_innvilget_enda: ['Innvilget senere', 'warning'], utlopt: ['Vedtak utløpt', 'destructive'], annen_landgruppe: ['Annen landgruppe', 'secondary'] };
                  const t = map[v] || [v, 'secondary']; return <Badge variant={t[1] as any}>{t[0]}</Badge>; } },
                { id: 'gyldig', header: 'Vedtak gyldig', cell: ({ row }: any) => <span className="tabnum whitespace-nowrap text-xs text-muted-foreground">{row.original.granted_fom || '—'} → {row.original.granted_tom || '—'}</span> },
                { accessorKey: 'applied_rate', header: 'Betalt', cell: (c: any) => <span className="tabnum">{c.getValue()} kr/kg</span> },
                { accessorKey: 'raak_amount', header: 'RÅK betalt', cell: (c: any) => <Money nok={c.getValue()} className="tabnum" /> },
              ]}
              data={raak.notGrantedItems}
              filterPlaceholder="Søk vare / tollnummer…"
              getRowCanExpand={() => true}
              renderSubComponent={(row: any) => (
                <div className="space-y-2 p-4 pl-10 text-sm">
                  <p>{row.original.summary}</p>
                  <div className="rounded-md bg-primary/5 p-3"><span className="text-xs font-medium uppercase tracking-wide text-primary">Neste steg</span><p>{row.original.action}</p></div>
                  <p className="text-xs text-muted-foreground">
                    Match i register: «{(row.original.matched_product || '').trim()}» ({row.original.confidence === 'strong' ? 'sterk' : 'svak'}) ·
                    Standardsats på datoen: {row.original.standard_rate_status === 'gyldig' ? row.original.standard_rate + ' kr/kg' : 'ikke verifisert (satsuttrekket starter etter denne datoen)'}
                  </p>
                </div>)} />
          </CardContent></Card>)}
    </div>
  );
}

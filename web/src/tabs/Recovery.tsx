import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/DataTable';
import { Money } from '@/components/Money';
import { Download } from 'lucide-react';
import { TYPES, agg, rowsFor, groupClaims, type ClaimGroup } from '@/lib/recovery';

const kindVariant: Record<string, any> = { Preferanse: 'default', 'RÅK': 'success', Produkt: 'warning' };
// `reclass_*` settes av agent-dommen (TIER_BY_LIKELIHOOD i src/analysis.js) når agenten
// har slått opp faktisk sats og overstyrt tekstheuristikken.
const CONF_LABEL: Record<string, string> = {
  strong: 'sterk', weak: 'svak', possible: 'mulig', review: 'til gjennomgang', info: 'produktavvik',
  raak_grant: 'nedsettelse funnet', no_basis: 'ikke grunnlag',
  reclass_strong: 'agent-vurdert — sterk', reclass_possible: 'agent-vurdert — mulig', reclass_weak: 'agent-vurdert — svak',
};
const CONF_VARIANT: Record<string, any> = {
  strong: 'success', weak: 'warning', review: 'outline', raak_grant: 'warning', no_basis: 'outline',
  reclass_strong: 'success', reclass_possible: 'warning', reclass_weak: 'outline',
};
const confLabel = (v: any) => CONF_LABEL[v] ?? v;
const confVariant = (v: any): any => CONF_VARIANT[v] ?? 'secondary';
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
  const dismissed = data.insights.preference?.dismissed;
  const unassessed = data.insights.preference?.unassessed;
  const [localKind, setLocalKind] = React.useState('alle');
  const kind = kindProp ?? localKind;
  const setKind = setKindProp ?? setLocalKind;
  const hasAgent = act.rows.some((r: any) => r.likelihood);

  const [mode, setMode] = React.useState<'grouped' | 'flat'>('grouped');

  const byType = React.useMemo(() => Object.fromEntries(TYPES.map((k) => [k, agg(rowsFor(act.rows, k))])), [act.rows]);
  const rows = React.useMemo(() => rowsFor(act.rows, kind), [kind, act.rows]);
  // Grupperingen er REN VISNING. `a` (beløp, haster-telling) og CSV-eksporten regnes
  // fortsatt på `rows` — de flate kravene — slik at ingen sum endrer seg av at listen
  // konsolideres. Hver fortolling må uansett omberegnes for seg i TVINN.
  const groups = React.useMemo(() => groupClaims(rows), [rows]);
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

  const groupCols = [
    { id: 'exp', header: '', cell: ({ row }: any) => <span className={'text-muted-foreground transition-transform inline-block ' + (row.getIsExpanded() ? 'rotate-90' : '')}>▸</span> },
    { accessorKey: 'kind', header: 'Type', cell: (c: any) => <Badge variant={kindVariant[c.getValue()] || 'secondary'}>{c.getValue()}</Badge> },
    { accessorKey: 'aktor', header: 'Aktør', cell: (c: any) => (c.getValue() || '').slice(0, 24) },
    { accessorKey: 'produkt', header: 'Produkt', cell: (c: any) => <span title={c.getValue()}>{(c.getValue() || '').slice(0, 30)}</span> },
    // Én fortolling kan ha flere varelinjer for samme produkt, og dermed flere krav.
    // Vis fortollinger primært — det er de som må omberegnes — og kravtallet når de spriker.
    { id: 'omfang', header: 'Fortollinger', accessorFn: (r: ClaimGroup) => r.tollnummers.length, cell: (c: any) => { const g = c.row.original as ClaimGroup;
      return <span className="tabnum whitespace-nowrap">{g.tollnummers.length}{g.count !== g.tollnummers.length ? <span className="text-muted-foreground"> / {g.count} krav</span> : null}</span>; } },
    { id: 'frist', header: 'Første frist', accessorFn: (r: ClaimGroup) => r.dager_igjen, cell: (c: any) => { const g = c.row.original as ClaimGroup;
      if (g.dager_igjen == null) return <span className="text-muted-foreground">—</span>;
      return <span className={'whitespace-nowrap ' + (g.dager_igjen <= 90 ? 'font-medium text-destructive' : '')}>{g.dager_igjen} d{g.urgentCount > 1 ? <span className="ml-1 text-xs">({g.urgentCount} haster)</span> : null}</span>; } },
    { id: 'match', header: 'Match', accessorFn: (r: ClaimGroup) => r.confidences.join(' '), cell: (c: any) => { const cf = (c.row.original as ClaimGroup).confidences;
      return <span className="whitespace-nowrap"><Badge variant={confVariant(cf[0])}>{confLabel(cf[0])}</Badge>{cf.length > 1 ? <span className="ml-1 text-xs font-medium text-amber-600 dark:text-amber-400">+{cf.length - 1}</span> : null}</span>; } },
    ...(hasAgent ? [{ id: 'lik', header: 'Gjenv.', accessorFn: (r: ClaimGroup) => r.likelihoods.join(' '), cell: (c: any) => { const lk = (c.row.original as ClaimGroup).likelihoods;
      if (!lk.length) return <span className="text-muted-foreground">—</span>;
      return <span className="whitespace-nowrap"><Badge variant={likVariant(lk[0])}>{lk[0]}</Badge>{lk.length > 1 ? <span className="ml-1 text-xs font-medium text-amber-600 dark:text-amber-400">+{lk.length - 1}</span> : null}</span>; } }] : []),
    { accessorKey: 'amount_nok', header: 'Beløp', cell: (c: any) => <Money nok={c.getValue()} className="tabnum font-semibold text-destructive" /> },
  ];

  const groupSub = (row: any) => { const g = row.original as ClaimGroup; return (
    <div className="space-y-3 p-4 pl-10">
      {g.shared.action && <div className="rounded-md bg-primary/5 p-3"><span className="text-xs font-medium uppercase tracking-wide text-primary">Neste steg — gjelder alle {g.count} fortollingene</span><p className="text-sm">{g.shared.action}</p></div>}
      {g.shared.reasoning && <div className="rounded-md bg-muted/60 p-3"><span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agent-vurdering{g.shared.likelihood ? ` (${g.shared.likelihood} sannsynlighet)` : ''}</span><p className="text-sm">{g.shared.reasoning}</p></div>}
      {g.shared.claim_draft && <div className="rounded-md border p-3"><span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Utkast til krav</span><p className="whitespace-pre-wrap text-sm">{g.shared.claim_draft}</p></div>}
      <div className="overflow-x-auto">
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.tollnummers.length} fortollinger{g.count !== g.tollnummers.length ? ` · ${g.count} kravlinjer` : ''} — hver fortolling må omberegnes for seg</div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-muted-foreground">
            <th className="p-2">Tollnummer</th><th className="p-2">Godkjent</th><th className="p-2">Frist</th><th className="p-2">Match</th><th className="p-2">Beløp</th><th className="p-2">Hva det er</th></tr></thead>
          <tbody>{g.claims.map((r: any, i: number) => (
            <tr key={(r.tollnummer || '') + '-' + i} className="border-t border-border/60 align-top">
              <td className="p-2 tabnum">{r.tollnummer || '—'}</td>
              <td className="p-2 whitespace-nowrap">{r.godkjent || '—'}</td>
              <td className={'p-2 whitespace-nowrap ' + (r.dager_igjen != null && r.dager_igjen <= 90 ? 'font-medium text-destructive' : '')}>{r.dager_igjen != null ? r.dager_igjen + ' d' : '—'}</td>
              <td className="p-2"><Badge variant={confVariant(r.confidence)}>{confLabel(r.confidence)}</Badge></td>
              <td className="p-2 tabnum"><Money nok={r.amount_nok} /></td>
              <td className="p-2 text-xs text-muted-foreground">{r.summary}</td></tr>))}</tbody>
        </table>
      </div>
      {!g.shared.action && <p className="text-xs text-muted-foreground">Neste steg varierer mellom fortollingene — bytt til «Alle krav» for å se dem enkeltvis.</p>}
    </div>); };

  const modeToolbar = (
    <div className="flex overflow-hidden rounded-lg border">
      {(['grouped', 'flat'] as const).map((m) => (
        <button key={m} onClick={() => setMode(m)}
          className={'px-3 py-1.5 text-sm transition-colors ' + (mode === m ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-accent')}>
          {m === 'grouped' ? 'Gruppert' : 'Alle krav'}</button>))}
    </div>);

  return (
    <div className="space-y-4">
      {/* Type-velger: styrer BÅDE toppkortene og denne fanen. Hver knapp viser typens beløp. */}
      <div className="flex flex-wrap gap-2">
        {TYPES.map((k) => (
          <button key={k} onClick={() => setKind(k)}
            className={'rounded-lg border px-4 py-2 text-left transition-colors ' + (kind === k ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'hover:bg-accent')}>
            <div className="text-sm font-semibold tabnum"><Money nok={byType[k].likely} /></div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k === 'alle' ? 'Alle typer' : k} · {byType[k].count}</div>
            <div className="text-[11px] tabnum text-muted-foreground">tak <Money nok={byType[k].ceiling} /></div>
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
          <p className="text-xs">Knappene og toppkortene viser <b>sannsynlig</b> gjenvinning (beløp vektet med {hasAgent ? 'agentvurdering, ellers ' : ''}match-styrke). «Tak» er summen av berørt toll dersom alt går igjennom — planlegg aldri etter taket.</p>
          {hasAgent
            ? <p className="text-xs">{a.assessed} av {a.count} poster er agent-vurdert mot faktiske satser i tolltariffen; begrunnelse og kravutkast ligger i den utvidbare raden.</p>
            : <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">Agent-vurdering (sannsynlighet + begrunnelse + kravutkast) er ikke kjørt for disse postene ennå.</p>}
          <Button variant="outline" onClick={() => exportCsv(rows, kind === 'alle' ? '' : '-' + kind)}><Download />Last ned {kind === 'alle' ? 'hele listen' : kind + '-listen'} (CSV)</Button>
        </CardContent></Card>

      <Card><CardHeader><CardTitle>{kind === 'alle' ? 'Alle poster' : kind + '-poster'} — {groups.length} produkter / {a.count} fortollinger, sortert etter beløp</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Samme produkt fra samme leverandør gir ett krav per fortolling. Gruppert viser <b>én rad per produkt</b> med
            samlet beløp og <b>korteste frist</b>; utvid raden for å se hver enkelt fortolling. Beløpene, haster-tellingen
            og CSV-eksporten er uendret — de regnes alltid på de enkelte kravene, siden hver fortolling må omberegnes for seg i TVINN.
          </p>
          {mode === 'grouped'
            ? <DataTable columns={groupCols} data={groups} filterPlaceholder="Søk produkt / aktør…" toolbar={modeToolbar} getRowCanExpand={() => true} renderSubComponent={groupSub} />
            : <DataTable columns={cols} data={rows} filterPlaceholder="Søk produkt / aktør / tollnummer…" toolbar={modeToolbar} getRowCanExpand={() => true} renderSubComponent={sub} />}
        </CardContent></Card>

      {dismissed?.count > 0 && (kind === 'alle' || kind === 'Preferanse') && (
        <Card><CardHeader><CardTitle>Vurdert — ikke grunnlag for krav ({dismissed.count} linjer)</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-3 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              Disse linjene ble tidligere talt med i «potensialet» med <b>hele den betalte tollen</b>, selv om ingen
              hadde kontrollert om tollen faktisk kunne kreves tilbake. Agenten har slått opp varenummer og sats i
              tolltariffen og konkludert med at tollen er <b>korrekt betalt</b>. De er derfor tatt ut av kravene —
              til sammen <b><Money nok={dismissed.ceiling} /></b> som før ble presentert som mulig gjenvinning.
              De vises her så vurderingen kan etterprøves.
            </p>
            <DataTable
              columns={[
                { id: 'exp', header: '', cell: ({ row }: any) => <span className={'text-muted-foreground transition-transform inline-block ' + (row.getIsExpanded() ? 'rotate-90' : '')}>▸</span> },
                { accessorKey: 'tollnummer', header: 'Tollnummer' },
                { accessorKey: 'aktor', header: 'Aktør' },
                { accessorKey: 'produkt', header: 'Produkt', cell: (c: any) => (c.getValue() || '').slice(0, 34) },
                { accessorKey: 'hs_code', header: 'Varenr.' },
                { accessorKey: 'origin', header: 'Opphav' },
                { accessorKey: 'betalt_toll', header: 'Betalt toll', cell: (c: any) => <Money nok={c.getValue()} className="tabnum text-muted-foreground" /> },
              ]}
              data={dismissed.items}
              filterPlaceholder="Søk produkt / aktør / tollnummer…"
              getRowCanExpand={() => true}
              renderSubComponent={(row: any) => (
                <div className="p-4 pl-10 text-sm text-muted-foreground">{row.original.begrunnelse || 'Ingen begrunnelse registrert.'}</div>)} />
          </CardContent></Card>)}

      {unassessed?.count > 0 && (kind === 'alle' || kind === 'Preferanse') && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {unassessed.count} mindre linjer (<Money nok={unassessed.ceiling} /> betalt toll) er ennå ikke agent-vurdert
          og holdes utenfor både kravene og totalene. Kjør vurderingen på nytt for å ta dem med.
        </p>)}

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

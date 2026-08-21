import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, CalendarClock, HandCoins, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Section, TableSection } from '@/components/ui/section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/DataTable';
import { StatCard, StatRow } from '@/components/StatCard';
import { PageHeader } from '@/components/PageHeader';
import { Segmented } from '@/components/Segmented';
import { Amount, Num } from '@/components/ui/metric';
import { expandColumn, Primary, Secondary, Code, MoneyCell, CountCell, MultiValue, Deadline } from '@/components/table/cells';
import { RowDetail, COL, entryColumns, type DetailStrip } from '@/components/table/RowDetail';
import { useData, useEntryIndex } from '@/lib/data';
import { getSent, postSent } from '@/lib/api';
import { n, plural } from '@/lib/format';
import { TYPES, agg, rowsFor, groupClaims, confLabel, type ClaimGroup } from '@/lib/recovery';
import { buildClaimEmail } from '@/lib/email';
import { exportXlsx } from '@/lib/xlsx';
import { navItemFor } from '@/lib/nav';

const kindVariant: Record<string, any> = { Preferanse: 'default', 'RÅK': 'success', Produkt: 'warning' };
// `reclass_*` settes av agent-dommen (TIER_BY_LIKELIHOOD i src/analysis.js) når agenten
// har slått opp faktisk sats og overstyrt tekstheuristikken. Etikettene (confLabel)
// bor i lib/recovery.ts og deles med Excel-eksporten.
const CONF_VARIANT: Record<string, any> = {
  strong: 'success', weak: 'warning', review: 'outline', raak_grant: 'warning', no_basis: 'outline',
  reclass_strong: 'success', reclass_possible: 'warning', reclass_weak: 'outline',
};
const confVariant = (v: any): any => CONF_VARIANT[v] ?? 'secondary';
const likVariant = (v: any) => v === 'høy' ? 'success' : v === 'middels' ? 'warning' : v === 'lav' ? 'outline' : 'secondary';
// Årsak til at et RÅK-vedtak ikke gjaldt — brukt både i kolonnen og i utvidelsen.
const RAAK_REASON: Record<string, [string, string]> = {
  ikke_innvilget_enda: ['Innvilget senere', 'merk'],
  utlopt: ['Vedtak utløpt', 'avvik'],
  annen_landgruppe: ['Annen landgruppe', 'info'],
};

type View = 'krav' | 'ingen-grunnlag' | 'raak-kontroll';

export function Recovery() {
  const data = useData();
  const entries = useEntryIndex();
  const act = data.insights.actions;
  const cov = data.insights.coverage;
  const raak = data.insights.raak;
  const dismissed = data.insights.preference?.dismissed;
  const unassessed = data.insights.preference?.unassessed;

  // Filtrene ligger i URL-en, ikke i lokal state: da er et kort på dashbordet en
  // ekte lenke inn i den filtrerte listen, og filteret overlever refresh og deling.
  const [params, setParams] = useSearchParams();
  const kind = TYPES.includes(params.get('type') || '') ? params.get('type')! : 'alle';
  const urgentOnly = params.get('frist') === 'haster';
  const q = params.get('q') || '';
  const view = (['krav', 'ingen-grunnlag', 'raak-kontroll'] as View[]).includes(params.get('vis') as View)
    ? (params.get('vis') as View) : 'krav';

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value == null || value === '' || value === 'alle' || value === 'krav') next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };

  const hasAgent = act.rows.some((r: any) => r.likelihood);
  const [mode, setMode] = React.useState<'grouped' | 'flat'>('grouped');

  // Hasterfilteret gjelder HELE siden, type-velgeren inkludert — ellers ville den
  // vist beløp for et utvalg man ikke ser på.
  const baseRows = React.useMemo(
    () => (urgentOnly ? act.rows.filter((r: any) => r.dager_igjen != null && r.dager_igjen <= 90) : act.rows),
    [act.rows, urgentOnly]
  );
  const byType = React.useMemo(() => Object.fromEntries(TYPES.map((k) => [k, agg(rowsFor(baseRows, k))])), [baseRows]);
  // Grupperingen er REN VISNING. Beløp, haster-telling og Excel-eksport regnes alltid på
  // de flate kravene, siden hver fortolling må omberegnes for seg i TVINN.
  const rows = React.useMemo(() => rowsFor(baseRows, kind), [kind, baseRows]);
  const groups = React.useMemo(() => groupClaims(rows), [rows]);
  const a = React.useMemo(() => agg(rows), [rows]);
  const suffix = (kind === 'alle' ? '' : '-' + kind) + (urgentOnly ? '-haster' : '');
  const filtered = kind !== 'alle' || urgentOnly;

  // «Avvent svar»-leddet: sendeloggen bor på serveren (SQLite lokalt, Postgres
  // hosted via api/sent.js) så alle ser samme status på tvers av nettlesere.
  // localStorage er kun fallback mot en eldre server-prosess uten /api/sent.
  const SENT_KEY = 'emma-3pl-sent';
  const [sentLog, setSentLog] = React.useState<any[]>([]);
  React.useEffect(() => {
    getSent().then((d) => setSentLog(d.items ?? []))
      .catch(() => { try { setSentLog(JSON.parse(localStorage.getItem(SENT_KEY) || '[]')); } catch {} });
  }, []);
  const lastSent = sentLog[0];

  // Ett klikk: Excel-arbeidsboken lastes ned (vedlegget med alle detaljene),
  // følgebrevet legges på utklippstavlen, og e-postprogrammet åpnes med kort
  // emne + tekst. Brukeren fyller inn 3PL-adressen, drar inn filen og sender.
  const fileName = 'emma-gjenvinning' + suffix + '.xlsx';
  const prepareEmail = async () => {
    if (!rows.length) return;
    await exportXlsx(rows, groups, fileName);
    // E-postens tall er de materielle (samme kutt som arkets hovedfaner) —
    // sendeloggen skal speile det som faktisk ble bedt om.
    const email = buildClaimEmail(groups, { fileName });
    navigator.clipboard?.writeText(`Emne: ${email.subject}\n\n${email.body}`).catch(() => {});
    // mailto-navigasjonen utsettes et øyeblikk — navigeres det umiddelbart,
    // avbryter Chrome den ventende blob-nedlastingen av vedlegget.
    window.setTimeout(() => { window.location.href = email.href; }, 400);
    const entry = { count: email.count, amount: email.likely, filter: filtered ? [kind !== 'alle' ? kind : '', urgentOnly ? 'haster' : ''].filter(Boolean).join(' + ') : 'alle' };
    postSent(entry).then((d) => setSentLog(d.items ?? []))
      .catch(() => {
        const next = [{ at: new Date().toISOString(), ...entry }, ...sentLog].slice(0, 20);
        setSentLog(next);
        try { localStorage.setItem(SENT_KEY, JSON.stringify(next)); } catch {}
      });
    toast.success('E-postutkast åpnet i e-postprogrammet', {
      duration: 15000,
      description: `Fyll inn 3PL-adressen og legg ved ${fileName} (nettopp lastet ned). Teksten ligger også på utklippstavlen.`,
    });
  };

  // ---- Kolonner. Samme rekkefølge som Varer: emne → motpart → klassifisering →
  // omfang → tid → beløp → flagg. Alle celler kommer fra det delte vokabularet.
  const claimGroupCols = [
    expandColumn(),
    { accessorKey: 'produkt', header: 'Produkt', cell: (c: any) => <Primary title={c.getValue()}>{c.getValue()}</Primary> },
    { accessorKey: 'aktor', header: 'Aktør', cell: (c: any) => <Secondary>{c.getValue()}</Secondary> },
    { accessorKey: 'kind', header: 'Type', cell: (c: any) => <Badge variant={kindVariant[c.getValue()] || 'secondary'}>{c.getValue()}</Badge> },
    { id: 'omfang', header: 'Fortollinger', accessorFn: (r: ClaimGroup) => r.tollnummers.length,
      cell: (c: any) => { const g = c.row.original as ClaimGroup; return <CountCell value={g.tollnummers.length} of={g.count} ofLabel="krav" />; } },
    { id: 'frist', header: 'Første frist', accessorFn: (r: ClaimGroup) => r.dager_igjen,
      cell: (c: any) => { const g = c.row.original as ClaimGroup;
        return <Deadline days={g.dager_igjen} note={g.urgentCount > 1 ? `(${g.urgentCount} haster)` : undefined} />; } },
    { accessorKey: 'amount_nok', header: 'Beløp', cell: (c: any) => <MoneyCell nok={c.getValue()} /> },
    { id: 'match', header: 'Match', accessorFn: (r: ClaimGroup) => r.confidences.join(' '),
      cell: (c: any) => <MultiValue values={(c.row.original as ClaimGroup).confidences} render={(v) => <Badge variant={confVariant(v)}>{confLabel(v)}</Badge>} /> },
    ...(hasAgent ? [{ id: 'lik', header: 'Gjenv.', accessorFn: (r: ClaimGroup) => r.likelihoods.join(' '),
      cell: (c: any) => <MultiValue values={(c.row.original as ClaimGroup).likelihoods} render={(v) => <Badge variant={likVariant(v)}>{v}</Badge>} /> }] : []),
  ];

  const claimFlatCols = [
    expandColumn(),
    { accessorKey: 'produkt', header: 'Produkt', cell: (c: any) => <Primary title={c.getValue()}>{c.getValue()}</Primary> },
    { accessorKey: 'aktor', header: 'Aktør', cell: (c: any) => <Secondary>{c.getValue()}</Secondary> },
    { accessorKey: 'kind', header: 'Type', cell: (c: any) => <Badge variant={kindVariant[c.getValue()] || 'secondary'}>{c.getValue()}</Badge> },
    { accessorKey: 'tollnummer', header: 'Tollnummer', cell: (c: any) => <Code>{c.getValue()}</Code> },
    { id: 'frist', header: 'Frist', accessorFn: (r: any) => r.dager_igjen, cell: (c: any) => <Deadline days={c.getValue()} /> },
    { accessorKey: 'amount_nok', header: 'Beløp', cell: (c: any) => <MoneyCell nok={c.getValue()} /> },
    { accessorKey: 'confidence', header: 'Match', cell: (c: any) => <Badge variant={confVariant(c.getValue())}>{confLabel(c.getValue())}</Badge> },
    ...(hasAgent ? [{ accessorKey: 'likelihood', header: 'Gjenv.',
      cell: (c: any) => c.getValue() ? <Badge variant={likVariant(c.getValue())}>{c.getValue()}</Badge> : <span className="text-muted-foreground">—</span> }] : []),
  ];

  // Samme strimler i begge visningene — og samme strimmel-språk som avvikene på
  // Varer- og Leverandør-sidene: en merkelapp, eventuelle verdier, og teksten under.
  // Tolletatens egne klassifiseringsuttalelser under de to kodene. Vi påstår ikke
  // hvem som vinner — en uttalelse om lindeblomst-te er presedens for tørket
  // rødkløverblomst, ikke et vedtak om den. Leseren ser begge sider og dømmer.
  const bkuBody = (bku: any) => (
    <span className="block space-y-1.5">
      {(['proposed', 'declared'] as const).map((side) => {
        const list = bku?.[side] ?? [];
        if (!list.length) return null;
        return (
          <span key={side} className="block">
            <span className="text-xs font-medium text-foreground">
              {side === 'proposed' ? 'Foreslått' : 'Deklarert'} {list[0].code}
            </span>
            {' — '}
            {list.map((e: any, i: number) => (
              <React.Fragment key={e.id}>
                {i > 0 ? ' · ' : null}
                <a href={e.link} target="_blank" rel="noopener" onClick={(ev) => ev.stopPropagation()}
                   className="text-primary hover:underline" title={`${e.id} · ${e.publishDate ?? ''} · ${e.description}`}>
                  {e.itemType || e.id}
                </a>
                {e.binding ? null : <span className="text-[10px] uppercase"> (CO)</span>}
              </React.Fragment>
            ))}
          </span>
        );
      })}
      <span className="block text-xs">
        Uttalelsene gjelder varene de er avgitt for — presedens for denne varen, ikke et vedtak om den.
      </span>
    </span>
  );

  const claimStrips = (r: any, opts: { scope?: string } = {}): DetailStrip[] => [
    ...(r.summary ? [{ label: 'Hva det er', tone: 'info', body: r.summary } as DetailStrip] : []),
    ...(r.action ? [{ label: 'Neste steg', tone: 'action', values: opts.scope ? [opts.scope] : undefined, body: r.action } as DetailStrip] : []),
    ...(r.reasoning ? [{ label: 'Agent-vurdering', tone: 'info', values: r.likelihood ? [`${r.likelihood} sannsynlighet`] : undefined, body: r.reasoning } as DetailStrip] : []),
    ...(r.claim_draft ? [{ label: 'Utkast til krav', tone: 'info', body: r.claim_draft } as DetailStrip] : []),
    ...(r.bku && ((r.bku.proposed?.length ?? 0) + (r.bku.declared?.length ?? 0)) > 0
      ? [{ label: 'BKU-presedens', tone: 'info', values: ['Tolletaten'], body: bkuBody(r.bku) } as DetailStrip]
      : []),
  ];

  // Midtkolonnene i kravtabellen. Identiteten og sporet tilbake til fortollingen
  // legges på av entryColumns, som i hver annen utvidet rad.
  const claimSourceColumns = entryColumns([
    COL.money('Beløp', (r: any) => r.amount_nok),
    COL.node('Match', (r: any) => <Badge variant={confVariant(r.confidence)}>{confLabel(r.confidence)}</Badge>),
    COL.text('Hva det er', (r: any) => r.summary, 'max-w-[40ch]'),
  ], {
    deadline: (r: any) => r.dager_igjen,
    sad: (r: any) => entries.get(r.tollnummer)?.sad_url,
  });

  const claimFlatDetail = (row: any) => {
    const r = row.original;
    return (
      <RowDetail
        strips={claimStrips(r)}
        source={{ caption: 'Fortollingen kravet gjelder', columns: claimSourceColumns, rows: [r],
          rowFlagged: (x: any) => x.dager_igjen != null && x.dager_igjen <= 90 }}
      />
    );
  };

  const claimGroupDetail = (row: any) => {
    const g = row.original as ClaimGroup;
    return (
      <RowDetail
        strips={claimStrips(g.shared, { scope: g.count === 1 ? undefined : `gjelder alle ${g.count} fortollingene` })}
        source={{
          caption: `${plural(g.tollnummers.length, 'fortolling', 'fortollinger')}${g.count !== g.tollnummers.length ? ` · ${g.count} kravlinjer` : ''} — hver fortolling må omberegnes for seg`,
          columns: claimSourceColumns,
          rows: g.claims,
          rowFlagged: (r: any) => r.dager_igjen != null && r.dager_igjen <= 90,
          footnote: g.shared.action ? undefined : 'Neste steg varierer mellom fortollingene — bytt til «Alle krav» for å se dem enkeltvis.',
        }}
      />
    );
  };

  const dismissedCols = [
    expandColumn(),
    { accessorKey: 'produkt', header: 'Produkt', cell: (c: any) => <Primary title={c.getValue()}>{c.getValue()}</Primary> },
    { accessorKey: 'aktor', header: 'Aktør', cell: (c: any) => <Secondary>{c.getValue()}</Secondary> },
    { accessorKey: 'hs_code', header: 'Varenr.', cell: (c: any) => <Code>{c.getValue()}</Code> },
    { accessorKey: 'origin', header: 'Opphav' },
    { accessorKey: 'tollnummer', header: 'Tollnummer', cell: (c: any) => <Code>{c.getValue()}</Code> },
    { accessorKey: 'betalt_toll', header: 'Betalt toll', cell: (c: any) => <MoneyCell nok={c.getValue()} tone="muted" /> },
    { id: 'status', header: 'Vurdering', cell: () => <Badge variant="outline">ikke grunnlag</Badge> },
  ];

  const raakCols = [
    expandColumn(),
    { accessorKey: 'description', header: 'Deklarert vare', cell: (c: any) => <Primary title={c.getValue()}>{c.getValue()}</Primary> },
    { accessorKey: 'tollnummer', header: 'Tollnummer', cell: (c: any) => <Code>{c.getValue()}</Code> },
    { accessorKey: 'godkjent', header: 'Fortollet', cell: (c: any) => <Code>{c.getValue()}</Code> },
    { id: 'gyldig', header: 'Vedtak gyldig',
      cell: ({ row }: any) => <span className="whitespace-nowrap text-xs tabnum text-muted-foreground">{row.original.granted_fom || '—'} → {row.original.granted_tom || '—'}</span> },
    { accessorKey: 'applied_rate', header: 'Betalt sats', cell: (c: any) => <Code>{c.getValue()} kr/kg</Code> },
    { accessorKey: 'raak_amount', header: 'RÅK betalt', cell: (c: any) => <MoneyCell nok={c.getValue()} tone="muted" /> },
    { accessorKey: 'status', header: 'Årsak', cell: (c: any) => {
      const t = RAAK_REASON[c.getValue()] ?? [c.getValue(), 'info'];
      const variant = t[1] === 'avvik' ? 'destructive' : t[1] === 'merk' ? 'warning' : 'secondary';
      return <Badge variant={variant as any}>{t[0]}</Badge>; } },
  ];

  const VIEWS: { value: View; label: React.ReactNode; count: number }[] = [
    { value: 'krav', label: <>Krav <span className="ml-1 tabnum opacity-60">{n(a.count)}</span></>, count: a.count },
    { value: 'ingen-grunnlag', label: <>Ikke grunnlag <span className="ml-1 tabnum opacity-60">{n(dismissed?.count ?? 0)}</span></>, count: dismissed?.count ?? 0 },
    { value: 'raak-kontroll', label: <>RÅK-kontroll <span className="ml-1 tabnum opacity-60">{n(raak?.notGrantedOnDate ?? 0)}</span></>, count: raak?.notGrantedOnDate ?? 0 },
  ];

  const VIEW_META: Record<View, { title: string; description: React.ReactNode }> = {
    krav: {
      title: `${kind === 'alle' ? 'Alle krav' : kind + '-krav'}${urgentOnly ? ' som haster' : ''}`,
      description: <>Samme produkt fra samme leverandør gir ett krav per fortolling. <b>Gruppert</b> viser én rad per produkt
        med samlet beløp og korteste frist; utvid raden for å se hver fortolling. Beløp og eksport regnes alltid på de
        enkelte kravene.</>,
    },
    'ingen-grunnlag': {
      title: 'Vurdert — ikke grunnlag for krav',
      description: <>Agenten har slått opp varenummer og sats i tolltariffen og konkludert med at tollen er korrekt betalt.
        Til sammen <b><Amount nok={dismissed?.ceiling} /></b> som tidligere ble presentert som mulig gjenvinning. Vises her
        så vurderingen kan etterprøves.</>,
    },
    'raak-kontroll': {
      title: 'RÅK-kontroll — vedtaket gjaldt ikke på fortollingsdatoen',
      description: <>Produktet finnes i nedsettelsesregisteret, men vedtaket var ikke gyldig da varen ble fortollet.
        Dette er <b>ikke krav</b> — de vises for å hindre feilkrav, og for å fange opp vedtak som må fornyes.</>,
    },
  };

  return (
    <>
      <PageHeader
        title="Refusjon"
        blurb={navItemFor('/gjenvinning').blurb}
        actions={view === 'krav' && (
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => exportXlsx(rows, groups, fileName)}>
                <Download />Last ned Excel {filtered ? '(utvalget)' : ''} ({n(rows.length)})
              </Button>
              <Button onClick={prepareEmail} disabled={!rows.length}>
                <Mail />E-post til 3PL ({n(rows.length)} krav)
              </Button>
            </div>
            {lastSent && (
              <span className="text-xs text-muted-foreground" title={`Utvalg: ${lastSent.filter || 'alle'}${lastSent.sender ? ' · av ' + lastSent.sender : ''}`}>
                Sist sendt {new Date(lastSent.at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}:
                {' '}{n(lastSent.count)} krav (est. {n(lastSent.amount)} kr) — avventer svar fra 3PL.
              </span>
            )}
          </div>
        )}
      />

      <StatRow cols={3}>
        <StatCard
          label="Sannsynlig gjenvinning" tone="positive" icon={HandCoins}
          value={<Amount nok={a.likely} />}
          hint={<>{n(a.count)} krav, vektet med vurdert sannsynlighet. Øvre tak <Amount nok={a.ceiling} />.</>}
        />
        <StatCard
          label="Solid grunnlag" icon={ShieldCheck}
          value={<Amount nok={a.solid} />}
          hint={<>{n(a.assessed)} av {n(a.count)} krav er agent-vurdert mot faktiske satser i tolltariffen.</>}
        />
        <StatCard
          label="Haster — frist ≤ 90 dager" icon={CalendarClock}
          tone={a.urgentCount ? 'risk' : 'muted'}
          active={urgentOnly}
          onClick={() => setParam('frist', urgentOnly ? null : 'haster')}
          value={<Num value={a.urgentCount} />}
          hint={urgentOnly ? 'Viser kun hastesaker — klikk for å vise alle igjen.' : 'Klikk for å vise kun disse.'}
        />
      </StatRow>

      {view === 'krav' && (
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={kind}
          onChange={(v) => setParam('type', v)}
          options={TYPES.map((k) => ({
            value: k,
            label: <>{k === 'alle' ? 'Alle typer' : k} <span className="ml-1 tabnum opacity-60">{n((byType[k] as any).count)}</span></>,
          }))}
        />
        {urgentOnly && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setParam('frist', null)}>Fjern hasterfilter</Button>
        )}
      </div>)}

      <TableSection
        title={VIEW_META[view].title}
        description={VIEW_META[view].description}
        action={<Segmented value={view} onChange={(v) => setParam('vis', v)} options={VIEWS.filter((v) => v.count > 0 || v.value === 'krav')} />}
      >
        {view === 'krav' && (mode === 'grouped'
          ? <DataTable columns={claimGroupCols} data={groups} filterPlaceholder="Søk produkt / aktør…" initialFilter={q}
              toolbar={<Segmented value={mode} onChange={(v) => setMode(v as any)} options={[{ value: 'grouped', label: 'Gruppert' }, { value: 'flat', label: 'Alle krav' }]} />}
              getRowCanExpand={() => true} renderSubComponent={claimGroupDetail}
              empty={urgentOnly ? 'Ingen krav med frist innen 90 dager i dette utvalget.' : undefined} />
          : <DataTable columns={claimFlatCols} data={rows} filterPlaceholder="Søk produkt / aktør / tollnummer…" initialFilter={q}
              toolbar={<Segmented value={mode} onChange={(v) => setMode(v as any)} options={[{ value: 'grouped', label: 'Gruppert' }, { value: 'flat', label: 'Alle krav' }]} />}
              getRowCanExpand={() => true} renderSubComponent={claimFlatDetail}
              empty={urgentOnly ? 'Ingen krav med frist innen 90 dager i dette utvalget.' : undefined} />)}

        {view === 'ingen-grunnlag' && (
          <DataTable columns={dismissedCols} data={dismissed?.items ?? []} filterPlaceholder="Søk produkt / aktør / tollnummer…"
            getRowCanExpand={() => true}
            renderSubComponent={(row: any) => (
              <RowDetail
                strips={[{ label: 'Ikke grunnlag', tone: 'info', body: row.original.begrunnelse || 'Ingen begrunnelse registrert.' }]}
                source={{
                  caption: 'Fortollingen vurderingen gjelder',
                  columns: entryColumns([
                    COL.code('Varenr.', (r: any) => r.hs_code),
                    COL.plain('Opphav', (r: any) => r.origin),
                    COL.money('Betalt toll', (r: any) => r.betalt_toll),
                  ], {
                    godkjent: (r: any) => entries.get(r.tollnummer)?.godkjent,
                    deadline: (r: any) => entries.get(r.tollnummer)?.days_left,
                    sad: (r: any) => entries.get(r.tollnummer)?.sad_url,
                  }),
                  rows: [row.original],
                }} />)} />)}

        {view === 'raak-kontroll' && (
          <DataTable columns={raakCols} data={raak?.notGrantedItems ?? []} filterPlaceholder="Søk vare / tollnummer…"
            getRowCanExpand={() => true}
            renderSubComponent={(row: any) => {
              const r = row.original;
              const reason = RAAK_REASON[r.status] ?? [r.status, 'merk'];
              const strips: DetailStrip[] = [
                {
                  label: reason[0],
                  tone: reason[1] as DetailStrip['tone'],
                  values: [`vedtak gyldig ${r.granted_fom || '—'} – ${r.granted_tom || '—'}`],
                  body: <>Match i register: «{(r.matched_product || '').trim()}» ({r.confidence === 'strong' ? 'sterk' : 'svak'}) ·
                    {' '}Standardsats på datoen: {r.standard_rate_status === 'gyldig'
                      ? r.standard_rate + ' kr/kg'
                      : 'ikke verifisert (satsuttrekket starter etter denne datoen)'}</>,
                },
                ...(r.summary ? [{ label: 'Hva det er', tone: 'info', body: r.summary } as DetailStrip] : []),
                ...(r.action ? [{ label: 'Neste steg', tone: 'action', body: r.action } as DetailStrip] : []),
              ];
              return (
                <RowDetail
                  strips={strips}
                  source={{
                    caption: 'Fortollingen kontrollen gjelder',
                    columns: entryColumns([
                      COL.node('Betalt sats', (x: any) => <Code>{x.applied_rate} kr/kg</Code>),
                      COL.money('RÅK betalt', (x: any) => x.raak_amount),
                    ], {
                      deadline: (x: any) => entries.get(x.tollnummer)?.days_left,
                      sad: (x: any) => entries.get(x.tollnummer)?.sad_url,
                    }),
                    rows: [r],
                  }} />
              );
            }} />)}
      </TableSection>

      <Section
        title="Slik henter du besparelsene"
        description="Det meste er ett klikk — resten er å fylle inn mottaker og sende."
        footer={<>
          Datagrunnlag: {n(cov?.n)} deklarasjoner ({cov?.first || '—'} – {cov?.last || '—'}), 3-årsvindu fra {cov?.window?.from}.
          {cov?.beforeWindow ? ` ${n(cov.beforeWindow)} eldre er utelatt (foreldet).` : ''}
          {unassessed?.count > 0 ? <> {n(unassessed.count)} mindre linjer (<Amount nok={unassessed.ceiling} /> betalt toll) er ennå ikke agent-vurdert og holdes utenfor totalene.</> : null}
        </>}
      >
        <ol className="ml-4 list-decimal space-y-1.5 text-sm text-muted-foreground">
          <li>Klikk <b>«E-post til 3PL»</b> øverst: e-postprogrammet åpnes med et kort følgebrev, og Excel-arbeidsboken med alle detaljene — prioritert oversikt, begrunnelse og kravtekst per fortolling — lastes ned samtidig.</li>
          <li>Fyll inn adressen til <b>DSV / 3PL</b>, dra inn den nedlastede Excel-filen som vedlegg, og send. Følgebrevet ber om <b>omberegning i TVINN</b> per fortolling.</li>
          <li><b>Preferanse:</b> gyldig opprinnelsesbevis. <b>RÅK:</b> skrivnummeret står i arket — vedtaket finnes allerede. <b>Produkt:</b> avklar HS/MVA-sats.</li>
          <li><b>Frist: 3 år</b> etter fortolling — hastesakene står øverst i arket, med rød frist.</li>
          <li>Avvent svar: følgebrevet ber 3PL bekrefte mottak, omberegne per fortolling, og legge inn preferanse + RÅK-skrivnummer fremover. Siste utsendelse vises ved knappene øverst.</li>
        </ol>
      </Section>
    </>
  );
}

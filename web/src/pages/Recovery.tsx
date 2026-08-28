import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMinAmount, splitByAmount, MIN_AMOUNT_OPTIONS, MIN_AMOUNT_DEFAULT, MIN_AMOUNT_KEY } from '@/lib/threshold';
import { Download, CalendarClock, HandCoins, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Section, TableSection } from '@/components/ui/section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/DataTable';
import { StatCard, StatRow } from '@/components/StatCard';
import { Segmented } from '@/components/Segmented';
import { Amount, Num } from '@/components/ui/metric';
import { Lift } from '@/components/ui/lift';
import { Explain } from '@/components/ui/explain';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { expandColumn, Primary, Secondary, Code, MoneyCell, CountCell, MultiValue, Deadline, KindBadge } from '@/components/table/cells';
import { RowDetail, COL, entryColumns, type DetailStrip } from '@/components/table/RowDetail';
import { useData, useEntryIndex } from '@/lib/data';
import { useFilters, type FilterDef } from '@/lib/filters';
import { Evidence } from '@/components/Evidence';
import { getSent, postSent } from '@/lib/api';
import { n, plural } from '@/lib/format';
import { TYPES, agg, rowsFor, groupClaims, confLabel, type ClaimGroup } from '@/lib/recovery';
import { buildClaimEmail } from '@/lib/email';
import { exportXlsx } from '@/lib/xlsx';


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
  // Minstebeløpet gjelder HELE siden, som hasterfilteret: tellere, beløp og
  // eksport skal alltid handle om det utvalget man faktisk ser på.
  const [minAmount, setMinAmount] = useMinAmount();
  const split = React.useMemo(() => splitByAmount(baseRows, minAmount), [baseRows, minAmount]);
  const materialRows = split.material;

  const byType = React.useMemo(() => Object.fromEntries(TYPES.map((k) => [k, agg(rowsFor(materialRows, k))])), [materialRows]);
  // Grupperingen er REN VISNING. Beløp, haster-telling og Excel-eksport regnes alltid på
  // de flate kravene, siden hver fortolling må omberegnes for seg i TVINN.
  const rows = React.useMemo(() => rowsFor(materialRows, kind), [kind, materialRows]);
  const groups = React.useMemo(() => groupClaims(rows), [rows]);
  const a = React.useMemo(() => agg(rows), [rows]);
  const suffix = (kind === 'alle' ? '' : '-' + kind) + (urgentOnly ? '-haster' : '');
  const filtered = kind !== 'alle' || urgentOnly;

  // «Avvent svar»-leddet: sendeloggen bor på serveren (SQLite lokalt, Postgres
  // hosted via api/sent.js) så alle ser samme status på tvers av nettlesere.
  // localStorage er kun fallback mot en eldre server-prosess uten /api/sent.
  // Utvalget er ALLTID flate krav-id-er. En gruppe er avledet (ClaimGroup.claims),
  // så avkrysning betyr det samme i «Gruppert» og «Alle krav», og et modusbytte
  // mister ingenting.
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const claimById = React.useMemo(() => new Map(act.rows.map((r: any) => [r.id, r])), [act.rows]);
  const toggleSelection = React.useCallback((ids: string[], on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) { if (on) next.add(id); else next.delete(id); }
      return next;
    });
  }, []);
  const clearSelection = React.useCallback(() => setSelectedIds(new Set()), []);
  const selectedClaims = React.useMemo(
    () => [...selectedIds].map((id) => claimById.get(id)).filter(Boolean) as any[],
    [selectedIds, claimById]
  );
  // Et valgt krav kan falle utenfor gjeldende filter. Da beholdes det — men
  // antallet skal stå synlig, ikke forsvinne (DESIGN.md).
  const visibleIds = React.useMemo(() => new Set(rows.map((r: any) => r.id)), [rows]);
  const selectedOutside = selectedClaims.filter((r) => !visibleIds.has(r.id)).length;
  const selectedAmount = selectedClaims.reduce((sum, r) => sum + (r.amount_nok || 0), 0);

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
    if (!selectedClaims.length) return;
    const picked = selectedClaims;
    const pickedGroups = groupClaims(picked);
    await exportXlsx(picked, pickedGroups, fileName);
    // E-postens tall er de materielle (samme kutt som arkets hovedfaner) —
    // sendeloggen skal speile det som faktisk ble bedt om.
    const email = buildClaimEmail(pickedGroups, { fileName });
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
    { accessorKey: 'kind', header: 'Type', cell: (c: any) => <KindBadge kind={c.getValue()} /> },
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
    { accessorKey: 'kind', header: 'Type', cell: (c: any) => <KindBadge kind={c.getValue()} /> },
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
                {e.binding ? null : <span className="text-2xs uppercase"> (CO)</span>}
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

  // Feltene overlapper hverandre i datagrunnlaget: `summary` inneholder hele
  // `reasoning` ordrett etter «Agent-vurdering:», og `action` er `claim_draft`
  // pluss en fristsetning. Rendres alle fire rått, leser man de samme to
  // avsnittene fire ganger, og en agent-vurdert rad blir umulig å skumme.
  //
  // Derfor trimmes hvert felt mot det som allerede står lenger opp. Ingen
  // setning forsvinner — hver av dem vises nøyaktig én gang, i den strimmelen
  // den hører hjemme i.
  const withoutOverlap = (text?: string | null, alreadyShown?: (string | null | undefined)[]) => {
    let out = (text ?? '').trim();
    if (!out) return '';
    for (const prev of alreadyShown ?? []) {
      const p = (prev ?? '').trim();
      if (p.length > 40 && out.includes(p)) out = out.replace(p, ' ').trim();
    }
    return out.replace(/\s{2,}/g, ' ').replace(/^[\s—–-]+/, '').trim();
  };

  // Sammendraget er bygget som «fakta om fortollingen. Agent-vurdering: <hele
  // reasoning> Realistisk krav ≈ N». Ledeteksten er delen før vurderingen —
  // resten står i sin egen strimmel.
  const summaryLead = (summary?: string | null, reasoning?: string | null) => {
    const s = (summary ?? '').trim();
    if (!s) return '';
    const [before, ...rest] = s.split(/Agent-vurdering:\s*/i);
    if (!rest.length) return withoutOverlap(s, [reasoning]);
    const tail = withoutOverlap(rest.join(' '), [reasoning]);
    return [before.trim(), tail].filter(Boolean).join(' ');
  };

  /**
   * Forklaringene i en gruppe er «ulike» bare fordi beløp og dato varierer — og
   * begge står allerede i egne kolonner. Normaliserer vi bort tall og datoer,
   * kollapser en gruppe på 22 krav til to reelle forklaringer i stedet for 22
   * nesten like avsnitt. Teksten som vises er den FØRSTE ekte varianten, ikke en
   * maskert versjon; normaliseringen brukes kun til å gruppere.
   */
  const normalise = (t?: string | null) =>
    (t ?? '')
      // Datoer, beløp og dagtellere varierer per fortolling og står i egne
      // kolonner. Varenumre, satser og landkoder rører vi IKKE — to saker som
      // skiller seg på varenummer er to forskjellige saker, og teksten som vises
      // er den første ekte varianten, ikke en maskert en.
      .replace(/\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2}/g, '§D§')
      .replace(/[\d\u00a0\u202f][\d\u00a0\u202f .,]*(?=\s*kr\b)/g, '§B§')
      .replace(/\d+(?=\s*dager)/g, '§T§')
      // «NATUR-DROGERIET A/S» og «NATUR DROGERIET» er samme aktør: bindestrek,
      // dobbeltmellomrom og selskapsform skal ikke lage to «ulike» forklaringer.
      .replace(/[-\s]+/g, ' ')
      .replace(/\b(a\/s|as|asa|aps|ab|oy|oyj|gmbh|ltd|inc|bv|nv|srl|sa|kg)\b\.?/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

  const distinctTexts = (claims: any[], field: string): { text: string; count: number; amount: number }[] => {
    const byKey = new Map<string, { text: string; count: number; amount: number }>();
    for (const c of claims) {
      const raw = (c?.[field] ?? '').trim();
      if (!raw) continue;
      const key = normalise(raw);
      const hit = byKey.get(key);
      if (hit) { hit.count += 1; hit.amount += c.amount_nok ?? 0; }
      // Teksten som vises er den med STØRST beløp, ikke tilfeldig den første —
      // da er eksempeltallet i avsnittet det mest relevante i varianten.
      else byKey.set(key, { text: raw, count: 1, amount: c.amount_nok ?? 0 });
      if (hit && (c.amount_nok ?? 0) > 0 && raw.length && (c.amount_nok ?? 0) > hit.amount / hit.count) hit.text = raw;
    }
    return [...byKey.values()].sort((a, b) => b.amount - a.amount);
  };

  // Beløpet hører hjemme på etiketten bare når varianten dekker et UTVALG av
  // fortollingene. Dekker den alle, står summen allerede i radens Beløp-kolonne,
  // og å gjenta den på hver strimmel er nettopp støyen vi prøver å bli kvitt.
  const fmtAmount = (v: number, partial: boolean) => (partial && v > 0 ? `${n(Math.round(v))} kr` : null);

  const scopeLabel = (count: number, total: number) =>
    total <= 1 || count === total
      ? undefined
      : `gjelder ${count} av ${total} fortollinger`;

  const claimStrips = (r: any, opts: { scope?: string } = {}): DetailStrip[] => {
    const lead = summaryLead(r.summary, r.reasoning);
    const deadlineOnly = withoutOverlap(r.action, [r.claim_draft]);
    return [
    ...(lead ? [{ label: 'Hva det er', tone: 'info', body: lead } as DetailStrip] : []),
    ...(r.reasoning ? [{ label: 'Agent-vurdering', tone: 'info', values: r.likelihood ? [`${r.likelihood} sannsynlighet`] : undefined, body: r.reasoning } as DetailStrip] : []),
    ...(r.claim_draft
      ? [{ label: 'Utkast til krav', tone: 'action',
           values: [opts.scope, deadlineOnly || null].filter(Boolean) as string[], body: r.claim_draft } as DetailStrip]
      : r.action
        ? [{ label: 'Neste steg', tone: 'action', values: opts.scope ? [opts.scope] : undefined, body: r.action } as DetailStrip]
        : []),
    ...(r.bku && ((r.bku.proposed?.length ?? 0) + (r.bku.declared?.length ?? 0)) > 0
      ? [{ label: 'BKU-presedens', tone: 'info', values: ['Tolletaten'], body: bkuBody(r.bku) } as DetailStrip]
      : []),
    ];
  };

  // Midtkolonnene i kravtabellen. Identiteten og sporet tilbake til fortollingen
  // legges på av entryColumns, som i hver annen utvidet rad.
  // Tabellen under strimlene bærer bare det som VARIERER per fortolling:
  // tollnummer, dato, beløp, match, frist og kilde. Forklaringen står over.
  const claimSourceColumns = () => entryColumns([
    COL.money('Beløp', (r: any) => r.amount_nok),
    COL.node('Match', (r: any) => <Badge variant={confVariant(r.confidence)}>{confLabel(r.confidence)}</Badge>),
  ], {
    deadline: (r: any) => r.dager_igjen,
    sad: (r: any) => entries.get(r.tollnummer)?.sad_url,
  });

  const claimFlatDetail = (row: any) => {
    const r = row.original;
    return (
      <RowDetail
        strips={claimStrips(r)}
        source={{ caption: 'Fortollingen kravet gjelder', columns: claimSourceColumns(), rows: [r],
          rowFlagged: (x: any) => x.dager_igjen != null && x.dager_igjen <= 90 }}
      />
    );
  };

  const claimGroupDetail = (row: any) => {
    const g = row.original as ClaimGroup;
    const total = g.claims.length;
    const leads = distinctTexts(g.claims, 'summary');
    const reasons = distinctTexts(g.claims, 'reasoning');
    const drafts = distinctTexts(g.claims, 'claim_draft');

    const strips: DetailStrip[] = [
      ...leads.map((x) => {
        const lead = summaryLead(x.text, reasons.find((r) => x.text.includes(r.text))?.text);
        return lead ? { label: 'Hva det er', tone: 'info',
          values: [scopeLabel(x.count, total), fmtAmount(x.amount, x.count < total)].filter(Boolean) as string[],
          body: lead } as DetailStrip : null;
      }).filter(Boolean) as DetailStrip[],
      ...reasons.map((x) => ({
        label: 'Agent-vurdering', tone: 'info',
        values: [g.shared.likelihood ? `${g.shared.likelihood} sannsynlighet` : null, scopeLabel(x.count, total), fmtAmount(x.amount, x.count < total)].filter(Boolean) as string[],
        body: x.text,
      } as DetailStrip)),
      ...drafts.map((x) => ({
        label: 'Utkast til krav', tone: 'action',
        values: [scopeLabel(x.count, total), fmtAmount(x.amount, x.count < total)].filter(Boolean) as string[],
        body: x.text,
      } as DetailStrip)),
      ...(g.shared.bku && ((g.shared.bku.proposed?.length ?? 0) + (g.shared.bku.declared?.length ?? 0)) > 0
        ? [{ label: 'BKU-presedens', tone: 'info', values: ['Tolletaten'], body: bkuBody(g.shared.bku) } as DetailStrip]
        : []),
    ];

    return (
      <RowDetail
        strips={strips}
        source={{
          caption: `${plural(g.tollnummers.length, 'fortolling', 'fortollinger')}${g.count !== g.tollnummers.length ? ` · ${g.count} kravlinjer` : ''} — hver fortolling må omberegnes for seg`,
          columns: claimSourceColumns(),
          rows: g.claims,
          rowFlagged: (r: any) => r.dager_igjen != null && r.dager_igjen <= 90,
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

  // Filtrene er deklarert, ikke skrevet. Alle tre lå tidligere som håndskrevet
  // JSX i en rad som vokste for hvert nye filter.
  const defs = React.useMemo<FilterDef<any>[]>(() => [
    {
      key: 'type',
      label: 'Kravtype',
      fallback: 'alle',
      options: TYPES.map((k) => ({ value: k, label: k === 'alle' ? 'Alle typer' : k, count: (byType[k] as any).count })),
      apply: (list, v) => rowsFor(list, v),
    },
    {
      key: 'frist',
      label: 'Frist',
      fallback: 'alle',
      options: [
        { value: 'alle', label: 'Alle frister' },
        { value: 'haster', label: 'Haster — ≤ 90 dager', count: agg(act.rows.filter((r: any) => r.dager_igjen != null && r.dager_igjen <= 90)).count },
      ],
      apply: (list, v) => (v === 'haster' ? list.filter((r: any) => r.dager_igjen != null && r.dager_igjen <= 90) : list),
    },
    {
      key: 'min',
      label: 'Minstebeløp',
      fallback: String(MIN_AMOUNT_DEFAULT),
      sticky: MIN_AMOUNT_KEY,
      options: MIN_AMOUNT_OPTIONS.map((v) => ({ value: String(v), label: v === 0 ? 'Alle beløp' : `≥ ${n(v)} kr` })),
      apply: (list, v) => splitByAmount(list, Number(v)).material,
      explain: <>Hver fortolling må omberegnes for seg i TVINN. Under grensen koster et krav mer å hente enn det gir. Ingenting slettes — antall og beløp står alltid under tabellen.</>,
    },
  ], [byType, act.rows]);
  const filters = useFilters(defs);

  const view = {
    label: 'Gruppering',
    value: mode,
    onChange: (v: string) => setMode(v as 'grouped' | 'flat'),
    options: [{ value: 'grouped', label: 'Gruppert' }, { value: 'flat', label: 'Alle krav' }],
  };


  // Bånd 4: handlingen henger på UTVALGET, ikke på siden. Lå tidligere øverst
  // som to brede knapper med tellingen bakt inn i etiketten — det loudeste på
  // skjermen, over tallene siden handler om.
  const claimActionBar = selectedIds.size > 0 ? (
    <div className="rule-t flex flex-wrap items-center gap-x-3 gap-y-2 pt-4">
      <span className="t-small">
        <span className="tabnum font-medium text-foreground">{n(selectedClaims.length)}</span> valgt
        {' · '}<span className="tabnum"><Amount nok={selectedAmount} /></span>
        {selectedOutside > 0 && (
          <span className="text-muted-foreground"> · {n(selectedOutside)} utenfor gjeldende filter</span>
        )}
      </span>
      <Button variant="ghost" size="sm" onClick={clearSelection}>Nullstill</Button>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => exportXlsx(selectedClaims, groupClaims(selectedClaims), fileName)}>
          <Download />Last ned Excel
        </Button>
        <Button onClick={prepareEmail}><Mail />Send til 3PL</Button>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Tallene beskriver DET DATASETTET SOM VISES. Sto tidligere fast på
          kravtallene, så «Ikke grunnlag» viste 189 rader under «65 545 NOK ·
          42 krav» — tall og tabell fra to ulike verdener. */}
        <StatRow cols={3}>
          <StatCard
            label="Sannsynlig gjenvinning" tone="positive" icon={HandCoins}
            value={<Amount nok={a.likely} />}
            hint={<>{n(a.count)} krav, vektet. Øvre tak <Amount nok={a.ceiling} />.</>}
          />
          <StatCard
            label="Solid grunnlag" icon={ShieldCheck}
            value={<Amount nok={a.solid} />}
            hint={<>{n(a.assessed)} av {n(a.count)} agent-vurdert mot tolltariffen.</>}
          />
          <StatCard
            label="Haster — frist ≤ 90 dager" icon={CalendarClock}
            tone={a.urgentCount ? 'risk' : 'muted'}
            value={<Num value={a.urgentCount} />}
            hint={<>Av {n(a.count)} krav i utvalget.</>}
          />
        </StatRow>

      {split.below.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {n(split.below.length)} krav under {n(minAmount)} kr er utelatt — til sammen{' '}
          <span className="tabnum"><Amount nok={split.belowValue} /></span>. Hver fortolling må omberegnes
          for seg, så småkrav koster mer å hente enn de gir.{' '}
          <button
            type="button"
            onClick={() => setMinAmount(0)}
            className="rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Vis dem likevel
          </button>
        </p>
      )}

      <TableSection
        title={kind === 'alle' ? 'Alle krav' : `${kind}-krav`}
        footer={lastSent ? (
          <span title={`Utvalg: ${lastSent.filter || 'alle'}${lastSent.sender ? ' · av ' + lastSent.sender : ''}`}>
            Sist sendt {new Date(lastSent.at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}:
            {' '}{n(lastSent.count)} krav (est. {n(lastSent.amount)} kr) — avventer svar fra 3PL.
          </span>
        ) : undefined}
      >
        {(mode === 'grouped'
          ? <DataTable columns={claimGroupCols} data={groups} filterPlaceholder="Søk produkt / aktør…" initialFilter={q}
              defs={defs} filters={filters} view={view}
              total={act.rows.length} unit="krav"
              selection={{ ids: selectedIds, idsOf: (g: ClaimGroup) => g.claims.map((c: any) => c.id), onToggle: toggleSelection, bar: claimActionBar }}
              getRowCanExpand={() => true} renderSubComponent={claimGroupDetail}
              empty={urgentOnly ? 'Ingen krav med frist innen 90 dager i dette utvalget.' : undefined} />
          : <DataTable columns={claimFlatCols} data={rows} filterPlaceholder="Søk produkt / aktør / tollnummer…" initialFilter={q}
              defs={defs} filters={filters} view={view}
              total={act.rows.length} unit="krav"
              selection={{ ids: selectedIds, idsOf: (r: any) => [r.id], onToggle: toggleSelection, bar: claimActionBar }}
              getRowCanExpand={() => true} renderSubComponent={claimFlatDetail}
              empty={urgentOnly ? 'Ingen krav med frist innen 90 dager i dette utvalget.' : undefined} />)}

      </TableSection>


      {/* Belegget for at kravtallet er til å stole på. Dette var tidligere to
          faner sidestilt med kravene — men ingen av dem er noe man handler på,
          og null lenker i appen pekte inn i dem. De hører hjemme her: etter
          arbeidet, som svar på «kan jeg stole på tallet?». */}
      <Section
        title="Slik ble tallet kontrollert"
        description="Agenten slo opp varenummer og sats i tolltariffen. Dette er hva den tok bort."
      >
        <div className="space-y-2">
          <Evidence
            label="Vurdert uten grunnlag for krav"
            count={dismissed?.count ?? 0}
            note={<>Tollen er korrekt betalt. <Amount nok={dismissed?.ceiling} /> ble tidligere vist som mulig gjenvinning.</>}
          >
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
                }} />)} />
          </Evidence>
          <Evidence
            label="RÅK-kontroll — vedtaket gjaldt ikke på fortollingsdatoen"
            count={raak?.notGrantedOnDate ?? 0}
            note="Ikke krav. Vises for å hindre feilkrav, og for å fange opp vedtak som må fornyes."
          >
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
            }} />
          </Evidence>
        </div>
      </Section>

      <Section
        title="Slik henter du besparelsene"
        description="Det meste er ett klikk — resten er å fylle inn mottaker og sende."
        footer={<>
          Datagrunnlag: {n(cov?.n)} deklarasjoner ({cov?.first || '—'} – {cov?.last || '—'}), 3-årsvindu fra {cov?.window?.from}.
          {cov?.beforeWindow ? ` ${n(cov.beforeWindow)} eldre er utelatt (foreldet).` : ''}
          {unassessed?.count > 0 ? <> {n(unassessed.count)} mindre linjer (<Amount nok={unassessed.ceiling} /> betalt toll) er ennå ikke agent-vurdert og holdes utenfor totalene.</> : null}
        </>}
      >
        {/* Uthevede ord i brødtekst står i vekt 500, ikke <b> (700) — DESIGN.md.
            Kravtypene er en ekte begrepsliste, så de står som <dl>, ikke som
            fetede ord midt i et avsnitt. */}
        <ol className="ml-4 list-decimal space-y-1.5 text-sm text-muted-foreground">
          <li>Velg kravene du vil sende, og send dem til 3PL. E-postprogrammet åpnes med et kort følgebrev, og Excel-arbeidsboken med begrunnelse og kravtekst per fortolling lastes ned samtidig.</li>
          <li>Fyll inn adressen, legg ved Excel-filen, og send. Følgebrevet ber om <Lift>omberegning i TVINN</Lift> per fortolling.</li>
          <li>
            Hva 3PL trenger per kravtype:
            <dl className="mt-1.5 space-y-1">
              <div className="flex gap-2"><dt className="min-w-[5.5rem] font-medium text-foreground">Preferanse</dt><dd>gyldig opprinnelsesbevis.</dd></div>
              <div className="flex gap-2"><dt className="min-w-[5.5rem] font-medium text-foreground">RÅK</dt><dd>skrivnummeret står i arket — vedtaket finnes allerede.</dd></div>
              <div className="flex gap-2"><dt className="min-w-[5.5rem] font-medium text-foreground">Produkt</dt><dd>avklar HS/MVA-sats.</dd></div>
            </dl>
          </li>
          <li><Lift>Fristen er 3 år</Lift> etter fortolling. Hastesakene står øverst i arket, med rød frist.</li>
          <li>Avvent svar: følgebrevet ber 3PL bekrefte mottak, omberegne per fortolling, og legge inn preferanse + RÅK-skrivnummer fremover.</li>
        </ol>
      </Section>
    </>
  );
}

import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/ui/section';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { Amount, Caption, Figure, Num } from '@/components/ui/metric';
import { useData } from '@/lib/data';
import { useCurrency } from '@/lib/currency';
import { n, plural } from '@/lib/format';
import { agg, rowsFor, groupClaims, TYPES } from '@/lib/recovery';
import { groupGoods, groupSummary } from '@/lib/group';
import { chargeCoverage } from '@/lib/coverage';

// Én farge per kravtype, tildelt etter type og aldri etter rangering, slik at et
// filter aldri maler om de radene som blir igjen.
const TYPE_COLOR: Record<string, string> = {
  Preferanse: 'var(--chart-1)',
  'RÅK': 'var(--chart-2)',
  Produkt: 'var(--chart-3)',
};

/**
 * Dashbordet svarer på ett spørsmål: hva gjør jeg nå?
 *
 * Alt som bare beskriver datagrunnlaget — utvikling over tid, avgifter per type,
 * leverandørlister, varetellinger — hører hjemme på sin egen side. Å gjenta det her
 * gjorde bare at det virkelige tallet druknet.
 */
export function Dashboard() {
  const data = useData();
  const { cur, convert } = useCurrency();
  const ins = data.insights;
  const m = data.meta;

  const all = agg(ins.actions.rows);
  const byType = React.useMemo(
    () => TYPES.filter((k) => k !== 'alle')
      .map((k) => ({ kind: k, ...agg(rowsFor(ins.actions.rows, k)) }))
      .filter((t) => t.likely > 0)
      .sort((a, b) => b.likely - a.likely),
    [ins.actions.rows]
  );
  const mixTotal = byType.reduce((s, t) => s + t.likely, 0) || 1;

  const groups = React.useMemo(() => groupClaims(ins.actions.rows), [ins.actions.rows]);
  const soonest = React.useMemo(
    () => groups.filter((g) => g.dager_igjen != null && g.amount_nok > 0)
      .sort((a, b) => a.dager_igjen! - b.dager_igjen!)
      .slice(0, 6),
    [groups]
  );

  const goods = React.useMemo(() => groupSummary(groupGoods(data.goods)), [data.goods]);
  const chargeCov = React.useMemo(() => chargeCoverage(data.declarations), [data.declarations]);
  const assessedPct = ins.actions.count ? Math.round((ins.actions.assessed / ins.actions.count) * 100) : 0;
  const pctOfCeiling = all.ceiling > 0 ? (v: number) => Math.min(100, (v / all.ceiling) * 100) : () => 0;

  return (
    <>
      <PageHeader
        title="Dashbord"
        blurb={`Arnika AS · ${m.claimWindow?.from} – ${m.claimWindow?.to}. Fristen for tilbakebetaling er 3 år fra fortollingsdato.`}
        actions={<Button asChild><Link to="/gjenvinning">Se alle krav<ArrowRight /></Link></Button>}
      />

      <Section
        title="Hva som er å hente"
        description="«Sannsynlig» er tallet å planlegge etter. «Tak» forutsetter at absolutt alt går igjennom — det skjer ikke."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
          <div>
            <Figure
              size="display"
              tone="positive"
              value={<Amount nok={all.likely} />}
              hint={<>Sannsynlig gjenvinning fordelt på {n(all.count)} krav, vektet med vurdert sannsynlighet.</>}
            />

            <div className="mt-5 space-y-2">
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-primary/12">
                <div className="absolute inset-y-0 left-0 rounded-full bg-primary/45" style={{ width: `${pctOfCeiling(all.likely)}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pctOfCeiling(all.solid)}%` }} />
              </div>
              <dl className="grid grid-cols-3 gap-3">
                {[
                  { k: 'Solid grunnlag', v: all.solid, swatch: 'bg-primary' },
                  { k: 'Sannsynlig', v: all.likely, swatch: 'bg-primary/45' },
                  { k: 'Øvre tak', v: all.ceiling, swatch: 'bg-primary/12' },
                ].map((x) => (
                  <div key={x.k}>
                    <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className={`size-2 shrink-0 rounded-[2px] ${x.swatch}`} />{x.k}
                    </dt>
                    <dd className="mt-1 text-sm font-medium tabnum"><Amount nok={x.v} /></dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Fordelt på kravtype</div>
            <div className="mt-3 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full">
              {byType.map((t) => (
                <div
                  key={t.kind}
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(3, (t.likely / mixTotal) * 100)}%`, background: TYPE_COLOR[t.kind] }}
                />
              ))}
            </div>
            <ul className="mt-3 divide-y">
              {byType.map((t) => (
                <li key={t.kind}>
                  <Link
                    to={`/gjenvinning?type=${encodeURIComponent(t.kind)}`}
                    className="flex items-center gap-3 py-2.5 transition-colors hover:text-primary"
                  >
                    <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: TYPE_COLOR[t.kind] }} />
                    <span className="text-sm font-medium">{t.kind}</span>
                    <span className="text-xs text-muted-foreground">{n(t.count)} krav</span>
                    <span className="ml-auto text-sm font-medium tabnum"><Amount nok={t.likely} /></span>
                    <span className="w-10 shrink-0 text-right text-xs tabnum text-muted-foreground">
                      {Math.round((t.likely / mixTotal) * 100)} %
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section
        title="Ta disse først"
        description="Kortest frist øverst. 3-årsfristen løper fra fortollingsdato, og et krav som foreldes er tapt."
        action={<Button asChild variant="ghost" size="sm" className="-mr-2 h-7 text-xs"><Link to="/gjenvinning">Alle krav<ArrowRight /></Link></Button>}
        footer={all.urgentCount
          ? <><Num value={all.urgentCount} /> krav har under 90 dager igjen. <Link to="/gjenvinning?frist=haster" className="text-primary hover:underline">Vis bare disse</Link>.</>
          : 'Ingen krav foreldes de neste 90 dagene.'}
      >
        <ul className="divide-y">
          {soonest.map((g) => (
            <li key={g.key}>
              <Link
                to={`/gjenvinning?type=${encodeURIComponent(g.kind)}&q=${encodeURIComponent(g.produkt.slice(0, 24))}`}
                className="flex items-center gap-3 py-2.5 transition-colors hover:bg-accent/40"
              >
                <span className={`w-14 shrink-0 text-sm tabnum ${g.dager_igjen! <= 90 ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                  {n(g.dager_igjen)} d
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{g.produkt || '—'}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {g.kind} · {g.aktor || '—'} · {plural(g.tollnummers.length, 'fortolling', 'fortollinger')}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium tabnum"><Amount nok={g.amount_nok} /></span>
              </Link>
            </li>
          ))}
          {!soonest.length && <li className="py-8 text-center text-sm text-muted-foreground">Ingen krav med registrert frist.</li>}
        </ul>
      </Section>

      <Section
        title="Grunnlaget"
        description="Hvor mye av 3-årsvinduet som er dekket, og hvor mye av det som faktisk er kontrollert."
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">Agent-vurderte krav</span>
              <span className="text-sm font-medium tabnum">{n(ins.actions.assessed)} / {n(ins.actions.count)}</span>
            </div>
            <Progress value={assessedPct} className="mt-2" />
            <Caption className="mt-1.5">Slått opp mot faktiske satser i tolltariffen. Resten hviler på tekstheuristikk.</Caption>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">Avgifter fordelt på type</span>
              <span className="text-sm font-medium tabnum">{Math.round(chargeCov.pct)} %</span>
            </div>
            <Progress value={chargeCov.pct} className="mt-2" />
            <Caption className="mt-1.5">
              <Amount nok={chargeCov.lineLevel} /> av <Amount nok={chargeCov.declared} /> betalt er registrert per varelinje.
            </Caption>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">Deklarasjoner</span>
              <Link to="/deklarasjoner" className="text-sm font-medium tabnum hover:text-primary">{n(m.declarations)}</Link>
            </div>
            <div className="mt-2 space-y-1">
              {(ins.coverage?.byYear ?? []).map((y: any) => {
                const max = Math.max(1, ...ins.coverage.byYear.map((x: any) => x.n));
                return (
                  <div key={y.year} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-[11px] tabnum text-muted-foreground">{y.year}</span>
                    <span className="h-1.5 min-w-[3px] rounded-full bg-primary/70" style={{ width: `${(y.n / max) * 100}%` }} />
                    <span className="ml-auto text-[11px] tabnum text-muted-foreground">{n(y.n)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">Varer</span>
              <Link to="/varer" className="text-sm font-medium tabnum hover:text-primary">{n(goods.groups)}</Link>
            </div>
            <dl className="mt-2 space-y-1.5 text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Må rettes</dt>
                <dd><Badge variant={goods.flagged ? 'destructive' : 'secondary'}>{n(goods.flagged)}</Badge></dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Merket variasjon</dt>
                <dd className="tabnum text-muted-foreground">{n(goods.noted)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Varelinjer</dt>
                <dd className="tabnum text-muted-foreground">{n(goods.lines)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Section>

      {cur !== 'NOK' && (
        <Caption>Alle beløp er regnet om fra NOK til {cur} med dagens kurs. Lagrede verdier er i NOK.</Caption>
      )}
    </>
  );
}

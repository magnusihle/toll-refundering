import * as React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  Minus,
  Package,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Segmented } from "@/components/Segmented";
import { StatCard, StatRow } from "@/components/StatCard";
import { ErrorTrend } from "@/components/ErrorTrend";
import { CauseBreakdown } from "@/components/CauseBreakdown";
import {
  Amount,
  Caption,
  FieldLabel,
  Figure,
  FIGURE_SIZE,
} from "@/components/ui/metric";
import { useData } from "@/lib/data";
import { useCurrency } from "@/lib/currency";
import { n, noDate, pct, plural } from "@/lib/format";
import { agg } from "@/lib/recovery";
import { byCause, causeOf } from "@/lib/causes";
import {
  monthlyErrorRate,
  summarize,
  windowPair,
  TREND_DEFAULT,
  TREND_WINDOWS,
  type TrendWindow,
} from "@/lib/trend";
import { groupGoods, groupSummary } from "@/lib/group";
import { groupSuppliers } from "@/lib/suppliers";
import { useMinAmount, splitByAmount } from "@/lib/threshold";
import { cn } from "@/lib/utils";

/**
 * The dashboard is the status of the SERVICE, not a second copy of the pages.
 *
 * Four questions, in this order, and nothing else: how much money have we found,
 * is the overpayment getting better or worse, why is it happening, and does
 * anything need doing right now. Everything that merely describes the import
 * activity — declarations per month, import value, currencies, Incoterms,
 * supplier rankings — belongs on the page that owns it. Repeating it here only
 * drowned the one number that matters.
 *
 * Two money definitions would be one too many, so «sannsynlig» (probability
 * weighted) is used everywhere on this page. The one deliberate exception is the
 * trend, which counts every identified error regardless of the minimum-amount
 * threshold, because «are we declaring correctly» is a different question from
 * «what is worth claiming». The section says so out loud rather than quietly
 * using a different set.
 */
export function Dashboard() {
  const data = useData();
  const { cur } = useCurrency();
  const ins = data.insights;
  const m = data.meta;

  // The threshold is shared with the Refusjon page, so the headline here and the
  // list there always describe the same claims.
  const [minAmount] = useMinAmount();
  const split = React.useMemo(
    () => splitByAmount(ins.actions.rows, minAmount),
    [ins.actions.rows, minAmount],
  );
  const worth = split.material;
  const all = agg(worth);

  const causes = React.useMemo(() => byCause(worth), [worth]);

  const [months, setMonths] = React.useState<TrendWindow>(TREND_DEFAULT);
  const series = React.useMemo(
    () => monthlyErrorRate(ins.actions.rows, data.declarations),
    [ins.actions.rows, data.declarations],
  );
  const { current, previous } = React.useMemo(
    () => windowPair(series, months),
    [series, months],
  );
  const now = summarize(current);
  const before = previous ? summarize(previous) : null;
  // Compared on the rounded values the reader can actually see: «opp fra 7,1 %»
  // next to 7,1 % is a contradiction, not a nuance.
  const direction =
    before?.pct != null && now.pct != null
      ? Math.round(now.pct * 10) - Math.round(before.pct * 10)
      : null;

  // What needs doing. Every item is a real link into the page that can act on it.
  const soonest = React.useMemo(() => {
    const days = worth
      .map((r: any) => r.dager_igjen)
      .filter((d: any) => d != null) as number[];
    return days.length ? Math.min(...days) : null;
  }, [worth]);
  // Reclassification is the one finding that cannot be settled without the
  // customer: Tolletaten needs the product specification to accept the new code.
  // Same root-cause test as the chart uses — «mekanisme» is the agent's free text
  // and misses a reclassification it happened to label «avtalesats».
  const needsSpec = React.useMemo(
    () => worth.filter((r: any) => causeOf(r) === "classification"),
    [worth],
  );
  const goods = React.useMemo(
    () => groupSummary(groupGoods(data.goods)),
    [data.goods],
  );
  const suppliers = React.useMemo(
    () => groupSuppliers(data.declarations).length,
    [data.declarations],
  );
  const attention =
    (all.urgentCount ? 1 : 0) +
    (needsSpec.length ? 1 : 0) +
    (goods.flagged ? 1 : 0);

  return (
    <>
      {/* 1 — Hovedstatus. Ett tall, og det står alene i spalten sin. */}
      <section className="grid grid-cols-12">
        <div className="col-span-12 lg:col-span-7">
          <Figure
            size="display"
            tone="positive"
            label="Sannsynlig refusjon"
            value={<Amount nok={all.likely} />}
          />
          <p className="t-lead mt-5">
            {n(all.count)} krav er verdt å gå videre med.
          </p>
        </div>
        <div className="col-span-12 lg:col-span-5 lg:border-l lg:border-border-strong lg:pl-10">
          <p className="mt-3 max-w-[56ch] text-sm leading-relaxed text-muted-foreground">
            Taket er{" "}
            <span className="tabnum">
              <Amount nok={all.ceiling} />
            </span>
            , og forutsetter at hvert eneste krav går igjennom.{" "}
            {split.below.length > 0 && (
              <>
                {plural(split.below.length, "krav", "krav")} under{" "}
                {n(minAmount)} kr står utenfor — til sammen{" "}
                <span className="tabnum">
                  <Amount nok={split.belowValue} />
                </span>
                , og grensen justeres på Refusjon.
              </>
            )}
          </p>
          <Button asChild variant="ghost" size="sm" className="-ml-3 mt-5">
            <Link to="/refusjon">
              Se kravene
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      {/* Her kommer status på refusjonssakene (Funnet → Klargjøres → Sendt inn →
          Hos Tolletaten → Godkjent → Utbetalt) når saksoppfølgingen finnes.
          Plassen er mellom hovedtallet og analysen med vilje: den forteller hva
          som skjer med pengene over, ikke hva analysen fant. */}

      <div className="grid grid-cols-12 gap-y-12">
        {/* 2 — Utvikling over tid, kolonne 1–7. */}
        <Section
          className="col-span-12 lg:col-span-7 lg:pr-10"
          title="Blir fortollingen riktigere?"
          description="Andel av betalt toll og avgift som viste seg å være for mye, etter måneden fortollingen skjedde."
          action={
            <Segmented
              label="Periode"
              value={String(months)}
              onChange={(v) => setMonths(Number(v) as TrendWindow)}
              options={TREND_WINDOWS.map((w) => ({
                value: String(w),
                label: `${w} mnd`,
              }))}
            />
          }
        >
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <span className={cn(FIGURE_SIZE.lg, "tabnum")}>{pct(now.pct)}</span>
            <span className="text-sm text-muted-foreground">
              siste {now.months} mnd
            </span>
            {before?.pct != null && direction != null && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-sm",
                  direction < 0
                    ? "text-success"
                    : direction > 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                )}
              >
                {direction < 0 ? (
                  <TrendingDown className="size-3.5" aria-hidden />
                ) : direction > 0 ? (
                  <TrendingUp className="size-3.5" aria-hidden />
                ) : (
                  <Minus className="size-3.5" aria-hidden />
                )}
                {direction < 0 ? "ned" : direction > 0 ? "opp" : "uendret"} fra{" "}
                {pct(before.pct)} forrige {before.months} mnd
              </span>
            )}
          </div>

          <ErrorTrend points={current} className="mt-6" />
        </Section>

        {/* 3 — Hvor pengene lekker, kolonne 8–12. */}
        <Section
          className="col-span-12 lg:col-span-5 lg:border-l lg:border-border-strong lg:pl-10"
          title="Hvor pengene lekker"
          description="Sannsynlig refusjon fordelt på årsaken til at det ble betalt for mye."
        >
          {/* Samme oppbygning som nabospalten — ett tall over diagrammet — så de
              to seksjonene starter på samme linje og leses som ett oppslag.
              Tallet er ANTALLET årsaker, ikke den største: andel og kroner står
              allerede på hver søyle, og en linje som gjentar den øverste søylen
              er ballast. Er lekkasjen samlet i tre mekanismer eller spredt over
              ti? Det er det ingenting annet på siden som svarer på. */}
          {causes.length > 0 && (
            <p className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
              <span className={cn(FIGURE_SIZE.lg, "tabnum")}>
                {n(causes.length)}
              </span>
              <span className="text-sm text-muted-foreground">
                {causes.length === 1 ? "årsak forklarer" : "årsaker forklarer"}{" "}
                hele beløpet
              </span>
            </p>
          )}

          <CauseBreakdown slices={causes} className="mt-6" />
        </Section>
      </div>

      {/* 4 — Krever oppmerksomhet, kolonne 1–12. */}
      <Section
        title="Krever oppmerksomhet"
        description="Bare det som ikke kan vente. Hele kravlisten står på Refusjon."
      >
        {attention ? (
          <StatRow cols={3}>
            {all.urgentCount > 0 && (
              <StatCard
                label="Krav nærmer seg fristen"
                icon={CalendarClock}
                tone="risk"
                value={n(all.urgentCount)}
                hint={
                  <>
                    Korteste frist er {plural(soonest ?? 0, "dag", "dager")}. Et
                    krav som foreldes er tapt.
                  </>
                }
                to="/refusjon?frist=haster"
              />
            )}
            {needsSpec.length > 0 && (
              <StatCard
                label="Krav venter på dokumentasjon"
                icon={FileText}
                tone="caution"
                value={n(needsSpec.length)}
                hint="Omtariffering må dokumenteres med produktspesifikasjon eller innholdsdeklarasjon fra dere."
                to="/refusjon?type=Preferanse"
              />
            )}
            {goods.flagged > 0 && (
              <StatCard
                label="Varer bør rettes"
                icon={Package}
                tone="caution"
                value={n(goods.flagged)}
                hint="Opplysningene spriker mellom sendinger og kan gi de samme feilene i fremtidige fortollinger."
                to="/varer"
              />
            )}
          </StatRow>
        ) : (
          <p className="flex items-start gap-2.5 text-base">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-success"
              aria-hidden
            />
            <span>
              Du trenger ikke gjøre noe akkurat nå.{" "}
              <span className="text-muted-foreground">
                Ingen frister nærmer seg, og ingen krav venter på dokumentasjon
                fra dere.
              </span>
            </span>
          </p>
        )}
      </Section>

      {cur !== "NOK" && (
        <Caption>
          Alle beløp er regnet om fra NOK til {cur} med dagens kurs. Lagrede
          verdier er i NOK.
        </Caption>
      )}
    </>
  );
}

function SourceLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="rounded-sm underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {children}
    </Link>
  );
}

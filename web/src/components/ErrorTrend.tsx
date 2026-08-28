import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { Amount } from "@/components/ui/metric";
import {
  CHART_HEIGHT,
  ChartContainer,
  ChartTooltip,
  ChartTooltipPanel,
  ChartTooltipRow,
  type ChartConfig,
} from "@/components/ui/chart";
import { n, pct } from "@/lib/format";
import { axisTicks, monthLabel, niceScale, type TrendPoint } from "@/lib/trend";

/**
 * The error rate, month by month — shadcn's area chart on Declaro's palette.
 *
 * The axis is NOT left to Recharts. Its automatic ticks land on values like
 * 6,25 %, and an axis is context: context should not need decoding. `niceScale`
 * picks a round step that hugs the peak, and `axisTicks` decides which months get
 * a label and where the year is written — where it CHANGES between two labels
 * that are actually drawn, not on January, which disappears at wide spacing.
 * Recharts still drops labels that would collide on a narrow screen, so
 * `minTickGap` handles phones without a second set of rules.
 *
 * `accessibilityLayer` is what makes the chart reachable by keyboard: the plot
 * takes focus and the arrow keys walk the months, with the readout following.
 * `title`/`desc` land as real <title>/<desc> inside the SVG, so the focusable
 * plot has a name instead of announcing itself as an unnamed «application», and
 * the numbers themselves stay readable as text below it.
 */
const CONFIG = {
  rate: { label: "Feilandel", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function ErrorTrend({
  points,
  className,
}: {
  points: TrendPoint[];
  className?: string;
}) {
  const scale = React.useMemo(
    () => niceScale(Math.max(1, ...points.map((p) => p.pct ?? 0))),
    [points],
  );
  const ticks = React.useMemo(() => axisTicks(points), [points]);
  const tickText = React.useMemo(
    () => new Map(ticks.map((t) => [t.month, t.label])),
    [ticks],
  );

  if (!points.length) {
    return (
      <p className={cn("py-10 text-sm text-muted-foreground", className)}>
        Ingen fortollinger i denne perioden, så det finnes ingen feilandel å
        regne på.
      </p>
    );
  }

  // The month in progress is drawn hollow, so «lowest point on the chart» never
  // gets read as a finished result.
  const last = points[points.length - 1];
  const openMonth =
    last.month === new Date().toISOString().slice(0, 7) ? last.month : null;

  return (
    <div className={className}>
      <ChartContainer config={CONFIG} className={CHART_HEIGHT}>
        <AreaChart
          accessibilityLayer
          data={points}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="fillRate" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-rate)"
                stopOpacity={0.28}
              />
              <stop
                offset="95%"
                stopColor="var(--color-rate)"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="hsl(var(--chart-grid))" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={16}
            ticks={ticks.map((t) => t.month)}
            tickFormatter={(m: string) => tickText.get(m) ?? ""}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            domain={[0, scale.top]}
            ticks={scale.ticks}
            tickFormatter={(v: number) => pct(v, v % 1 === 0 ? 0 : 1)}
          />
          <ChartTooltip
            cursor={{ stroke: "hsl(var(--border-strong))" }}
            content={<TrendReadout />}
          />
          <Area
            dataKey="pct"
            type="monotone"
            // Recharts wipes the series in over 1,5 s on mount. That is well past
            // the app's motion budget, and requestAnimationFrame is throttled in a
            // background tab — load the dashboard in a tab you are not looking at
            // and you come back to a chart frozen half-drawn. The data is not a
            // reveal; it just has to be there.
            isAnimationActive={false}
            stroke="var(--color-rate)"
            strokeWidth={2}
            fill="url(#fillRate)"
            dot={
              points.length <= 13 ? <TrendDot openMonth={openMonth} /> : false
            }
            activeDot={{ r: 4, strokeWidth: 0, fill: "var(--color-rate)" }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

/** Recharts hands the dot its geometry; we only decide filled or hollow. */
function TrendDot(props: any) {
  const { cx, cy, payload, openMonth } = props;
  if (cx == null || cy == null) return null;
  const open = payload?.month === openMonth;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3.5}
      fill={open ? "hsl(var(--card))" : "var(--color-rate)"}
      stroke="var(--color-rate)"
      strokeWidth={open ? 2 : 0}
    />
  );
}

function TrendReadout({ active, payload }: any) {
  const p: TrendPoint | undefined = payload?.[0]?.payload;
  if (!active || !p || p.pct == null) return null;
  return (
    <ChartTooltipPanel>
      <p className="text-sm font-medium leading-snug">
        {monthLabel(p.month, true)}
      </p>
      <div className="grid gap-1.5">
        <ChartTooltipRow label="Feilandel" value={pct(p.pct)} />
        <ChartTooltipRow
          label="Identifisert"
          value={<Amount nok={p.likely} />}
        />
        <ChartTooltipRow
          label="Toll og avgift betalt"
          value={<Amount nok={p.paid} />}
        />
        <ChartTooltipRow label="Krav" value={n(p.count)} />
      </div>
    </ChartTooltipPanel>
  );
}

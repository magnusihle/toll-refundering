import * as React from 'react';
import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/lib/currency';
import { Amount } from '@/components/ui/metric';
import {
  CHART_HEIGHT,
  ChartContainer,
  ChartTooltip,
  ChartTooltipPanel,
  ChartTooltipRow,
  type ChartConfig,
} from '@/components/ui/chart';
import { money, n, pct } from '@/lib/format';
import type { CauseSlice } from '@/lib/causes';

/**
 * Where the money leaks, ranked — a Recharts bar chart with the cause and its
 * numbers on ONE line above the bar:
 *
 *     Feil klassifisering                         34 % · 22 261 NOK
 *     ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
 *
 * Share and kroner answer two different questions — how much of the problem is
 * this, and what is it worth — and neither should need a hover to read. Above the
 * bar rather than inside it: the name is the answer to the question this section
 * asks, so it never gets truncated, and a filled block with pale text inside it
 * reads as a button.
 *
 * One measure across categories, so every bar is the same colour: length is the
 * comparison, and a second hue would claim the bars belong to different series
 * (DESIGN.md — never invent a fourth chart hue).
 */
const CONFIG = {
  likely: { label: 'Sannsynlig refusjon', color: 'var(--chart-1)' },
} satisfies ChartConfig;

export function CauseBreakdown({ slices, className }: { slices: CauseSlice[]; className?: string }) {
  const { cur, convert } = useCurrency();

  // The label line is text, not data, so it is composed once here rather than
  // inside a renderer that Recharts calls per frame.
  const lines = React.useMemo(
    () =>
      slices.map((s) => ({
        label: s.label,
        numbers: `${pct(s.share, 0)} · ${money(convert(s.likely), cur)}`,
      })),
    [slices, convert, cur],
  );

  if (!slices.length) {
    return (
      <p className={cn('py-6 text-sm text-muted-foreground', className)}>
        Ingen krav i utvalget, så det er ingen årsak å fordele.
      </p>
    );
  }

  // Nothing sits past the end of a bar any more, so the scale needs no headroom
  // and the bars get the full width of the column.
  const max = slices[0].likely;

  return (
    <div className={className}>
      <ChartContainer config={CONFIG} className={CHART_HEIGHT}>
        <BarChart
          accessibilityLayer
          title="Sannsynlig refusjon fordelt på årsak"
          desc="Sannsynlig refusjonsbeløp per rotårsak til at det ble betalt for mye toll, største årsak øverst."
          layout="vertical"
          data={slices}
          margin={{ top: 16, right: 4, bottom: 4, left: 0 }}
          barCategoryGap="26%"
        >
          <YAxis dataKey="key" type="category" hide />
          <XAxis dataKey="likely" type="number" domain={[0, max]} hide />
          <ChartTooltip cursor={false} content={<CauseReadout />} />
          <Bar
            dataKey="likely"
            fill="var(--color-likely)"
            radius={4}
            maxBarSize={24}
            isAnimationActive={false}
          >
            <LabelList dataKey="likely" content={<CauseLabel lines={lines} max={max} />} />
          </Bar>
        </BarChart>
      </ChartContainer>

      {/* Diagrammet er ikke tallene. Den som ikke ser det skal kunne lese dem. */}
      <dl className="sr-only">
        {slices.map((s) => (
          <React.Fragment key={s.key}>
            <dt>{s.label}</dt>
            <dd>
              {s.why} {money(convert(s.likely), cur)}, {n(s.count)} krav,{' '}
              {pct(s.share, 0)} av samlet beløp.
            </dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

/**
 * The header line above a bar: cause on the left, share and kroner on the right.
 *
 * In a vertical layout every bar starts at the plot's left edge, so `x` IS that
 * edge. The right edge takes one step of arithmetic: the scale is linear from
 * zero, so a bar worth `value` covers `value / max` of the plot, and the plot
 * therefore ends at `x + width * max / value`. That holds for every bar, which is
 * how the numbers right-align down the column without measuring the container.
 */
function CauseLabel({ x, y, width, value, index, lines, max }: any) {
  const line = lines?.[index];
  if (x == null || y == null || width == null || !value || !line) return null;
  const right = x + (width * max) / value;
  return (
    <>
      <text x={x} y={y - 9} fontSize={13} fontWeight={500} fill="hsl(var(--foreground))">
        {line.label}
      </text>
      <text
        x={right}
        y={y - 9}
        textAnchor="end"
        fontSize={13}
        fontWeight={500}
        className="tabnum"
        fill="hsl(var(--muted-foreground))"
      >
        {line.numbers}
      </text>
    </>
  );
}

function CauseReadout({ active, payload }: any) {
  const s: CauseSlice | undefined = payload?.[0]?.payload;
  if (!active || !s) return null;
  return (
    <ChartTooltipPanel>
      <p className="text-sm font-medium leading-snug">{s.label}</p>
      <p className="leading-snug text-muted-foreground">{s.why}</p>
      <div className="grid gap-1.5">
        <ChartTooltipRow label="Sannsynlig refusjon" value={<Amount nok={s.likely} />} />
        <ChartTooltipRow label="Krav" value={n(s.count)} />
        <ChartTooltipRow label="Av samlet beløp" value={pct(s.share, 0)} />
      </div>
    </ChartTooltipPanel>
  );
}

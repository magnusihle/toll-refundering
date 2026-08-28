/**
 * Error rate per month — is the customs handling getting better or worse?
 *
 * The measure is identified overpayment divided by what was actually paid in the
 * SAME month, keyed on the CUSTOMS CLEARANCE date, never on the date Declaro found
 * the claim. A claim found today about a clearance from March 2025 is a March 2025
 * error; putting it on today's bar would say the opposite of the truth.
 *
 * Two choices worth knowing about, because they decide what the number means:
 *
 *  1. The denominator is the declaration's own `avg` (the duty and levies charged
 *     at clearance). Line-level charges only cover about 56 % of what was paid —
 *     the rest sits on declarations whose lines came from the Linjer grid — so a
 *     customs-only denominator would swing with data quality month to month. The
 *     declaration total is complete for every declaration, which is what a trend
 *     needs. The label says «toll og avgift», not «toll», because that is what it is.
 *
 *  2. The numerator is the probability-weighted amount, the same «sannsynlig» money
 *     the rest of the dashboard shows — not the ceiling. One money definition per page.
 *
 * The minimum-amount threshold is deliberately NOT applied here. It answers «what is
 * worth claiming», and this chart answers «are we declaring correctly» — a 40-kroner
 * error is still an error. The section says so in writing.
 */
import { isoOf } from '@/lib/group';
import { weightOf } from '@/lib/recovery';

export type TrendPoint = {
  month: string;          // 'YYYY-MM'
  likely: number;         // probability-weighted overpayment identified, NOK
  paid: number;           // duty and levies charged that month, NOK
  pct: number | null;     // likely / paid, in percent — null when nothing was paid
  count: number;          // claims attributed to the month
};

export type TrendSummary = { likely: number; paid: number; count: number; pct: number | null; months: number };

export const TREND_WINDOWS = [6, 12, 36] as const;
export type TrendWindow = (typeof TREND_WINDOWS)[number];
export const TREND_DEFAULT: TrendWindow = 12;

const monthOf = (row: any): string | null => isoOf(row)?.slice(0, 7) ?? null;

export function monthlyErrorRate(claims: any[], declarations: any[]): TrendPoint[] {
  const paid = new Map<string, number>();
  for (const d of declarations ?? []) {
    const m = monthOf(d);
    if (m) paid.set(m, (paid.get(m) || 0) + (Number(d.avg) || 0));
  }
  const found = new Map<string, { likely: number; count: number }>();
  for (const r of claims ?? []) {
    const m = monthOf(r);
    if (!m) continue; // product findings carry no clearance date, and no amount either
    const e = found.get(m) ?? { likely: 0, count: 0 };
    e.likely += (r.amount_nok || 0) * weightOf(r);
    e.count++;
    found.set(m, e);
  }
  return [...paid.keys()].sort().map((month) => {
    const f = found.get(month);
    const p = paid.get(month) || 0;
    const likely = f?.likely ?? 0;
    return { month, paid: p, likely, count: f?.count ?? 0, pct: p > 0 ? (likely / p) * 100 : null };
  });
}

export function summarize(points: TrendPoint[]): TrendSummary {
  const likely = points.reduce((s, p) => s + p.likely, 0);
  const paid = points.reduce((s, p) => s + p.paid, 0);
  return {
    likely, paid,
    count: points.reduce((s, p) => s + p.count, 0),
    pct: paid > 0 ? (likely / paid) * 100 : null,
    months: points.length,
  };
}

/** The chosen window, and the window before it — the latter only when it is complete. */
export function windowPair(points: TrendPoint[], months: TrendWindow) {
  const current = points.slice(-months);
  const previousSlice = points.slice(-2 * months, -months);
  // A half-filled comparison period reads as an improvement that never happened.
  const previous = previousSlice.length === months ? previousSlice : null;
  return { current, previous };
}

const MONTH_NAMES = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
];

/** «april 2026» — capitalised where it stands as a heading. */
export function monthLabel(month: string, capitalize = false): string {
  const [y, m] = month.split('-');
  const name = MONTH_NAMES[Number(m) - 1] ?? month;
  return `${capitalize ? name[0].toUpperCase() + name.slice(1) : name} ${y}`;
}

// Norwegian month abbreviations take a period because they are shortened — «mai»
// is the whole word, so it does not.
const MONTH_TICKS = ['jan.', 'feb.', 'mar.', 'apr.', 'mai', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'des.'];

/** «apr. 26» — the axis, where the year only appears when it changes. */
export function monthTick(month: string, withYear: boolean): string {
  const [y, m] = month.split('-');
  const short = MONTH_TICKS[Number(m) - 1] ?? month;
  return withYear ? `${short} ${y.slice(2)}` : short;
}

/**
 * Which months get a label, and where the year is written.
 *
 * The axis thins out as the window grows, and the newest month always keeps its
 * label — a scheduled tick that would land on top of it is dropped instead. The
 * year goes where it CHANGES between two labels that are actually drawn; keying
 * it to January alone lost «24» entirely at three-month spacing. Recharts still
 * removes what will not fit on a narrow screen, so this only decides the
 * candidates.
 */
export function axisTicks(points: TrendPoint[]): { month: string; label: string }[] {
  if (!points.length) return [];
  const last = points.length - 1;
  const every = points.length > 18 ? 3 : points.length > 13 ? 2 : 1;
  const picked = points
    .map((_, i) => i)
    .filter((i) => i === last || (i % every === 0 && i <= last - every));
  return picked.map((i, k) => {
    const month = points[i].month;
    const newYear = k === 0 || points[picked[k - 1]].month.slice(0, 4) !== month.slice(0, 4);
    return { month, label: monthTick(month, newYear || i === last) };
  });
}

/**
 * A y-axis that lands on round percentages and hugs the data.
 *
 * Two constraints, in this order: the gridlines must read 0 / 5 / 10 / 15 rather
 * than 0 / 6,25 / 12,5 — an axis is context, and context should not need decoding
 * — and the top must sit as close above the peak as a round step allows. Picking
 * the first workable step instead of the tightest one left a third of the plot
 * empty above a 20,5 % peak.
 */
export function niceScale(max: number): { top: number; ticks: number[] } {
  const steps = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100];
  let best: { top: number; step: number } | null = null;
  for (const step of steps) {
    const divisions = Math.ceil(max / step);
    if (divisions < 2 || divisions > 5) continue;
    if (!best || step * divisions < best.top) best = { top: step * divisions, step };
  }
  const { top, step } = best ?? { top: Math.max(max, 1), step: Math.max(max, 1) / 2 };
  const divisions = Math.round(top / step);
  return { top, ticks: Array.from({ length: divisions + 1 }, (_, i) => i * step) };
}

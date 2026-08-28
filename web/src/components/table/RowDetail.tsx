import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Amount, Num } from '@/components/ui/metric';
import { Code, Deadline, SadLink, Secondary } from '@/components/table/cells';

/**
 * The expanded row — ONE component, one fixed order, everywhere.
 *
 * Every expansion in this app was answering the same four questions in a different
 * arrangement. They are now slots, and a page supplies data rather than layout:
 *
 *   1. findings — why is this row flagged?      (variances, status, spelling drift)
 *   2. notes    — what do I do about it?        (next step, agent reasoning, draft)
 *   3. facts    — what does it roll up to?      (charges, rates, key values)
 *   4. source   — what is it made of?           (the rows one level down)
 *
 * Empty slots collapse, so a simple expansion is the same component as a rich one.
 * The reader always finds the same thing in the same place.
 */

/**
 * A strip: the one way this app annotates an expanded row.
 *
 * Goods and Leverandører read well because everything above the table is a short
 * badge with, at most, a muted paragraph under it. Refusjon used to draw the same
 * information as full-width tinted cards instead, which is why the two pages looked
 * unrelated. There is now a single renderer — a strip is a strip whether it carries a
 * variance, a spelling drift, a next step or a draft claim; only the tint differs.
 */
export type DetailStrip = {
  label: string;
  /** avvik = must fix · merk = check it · action = do this next · info = context. */
  tone?: 'avvik' | 'merk' | 'action' | 'info';
  /** Inline after the badge — the differing values, a validity range, a rate. */
  values?: (string | number | null)[];
  /** The paragraph under the badge. Long prose (draft claims) is fine here. */
  body?: React.ReactNode;
};

export type DetailFact = { label: string; value: React.ReactNode; flagged?: boolean };

export type SourceColumn = { header: React.ReactNode; cell: (row: any, index: number) => React.ReactNode };

export type DetailSource = {
  caption?: React.ReactNode;
  columns: SourceColumn[];
  rows: any[];
  rowFlagged?: (row: any) => boolean;
  /** Per-cell emphasis, e.g. the field that deviates from the group. */
  cellFlagged?: (row: any, columnIndex: number) => boolean;
  footnote?: React.ReactNode;
};

const STRIP = {
  avvik: { box: 'bg-destructive/5', badge: 'destructive' },
  merk: { box: 'bg-warning/10', badge: 'warning' },
  action: { box: 'bg-primary/5', badge: 'default' },
  info: { box: 'bg-muted/60', badge: 'secondary' },
} as const;

function SlotLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground">{children}</div>;
}

/**
 * Fixed order, every expansion, every page:
 *   strips (what to know)  →  facts (what it adds up to)  →  source (what it is made of)
 * Empty slots collapse, so a one-strip expansion and a three-strip one are the
 * same component with the same rhythm.
 */
export function RowDetail({
  strips = [], facts = [], factsLabel, source,
}: {
  strips?: DetailStrip[];
  facts?: DetailFact[];
  factsLabel?: React.ReactNode;
  source?: DetailSource;
}) {
  return (
    <div className="space-y-4 p-4 pl-10">
      {strips.length > 0 && (
        <div className="space-y-1.5">
          {strips.map((st, i) => {
            const tone = STRIP[st.tone ?? 'info'];
            return (
              <div key={st.label + i} className={cn('rounded-lg p-2.5', tone.box)}>
                <span className="inline-flex flex-wrap items-center gap-2">
                  <Badge variant={tone.badge as any}>{st.label}</Badge>
                  {st.values?.length
                    ? <span className="text-xs tabnum text-muted-foreground">
                        {st.values.map((v) => (v == null || v === '' ? '—' : String(v))).join(' · ')}
                      </span>
                    : null}
                </span>
                {st.body
                  ? <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{st.body}</p>
                  : null}
              </div>
            );
          })}
        </div>
      )}

      {facts.length > 0 && (
        <div>
          {factsLabel ? <SlotLabel>{factsLabel}</SlotLabel> : null}
          <div className="flex flex-wrap gap-2">
            {facts.map((f) => (
              <div key={f.label} className={cn('rounded-lg border px-3 py-1.5 text-sm', f.flagged && 'border-warning/40 bg-warning/5')}>
                <span className="font-medium">{f.label}</span>
                <span className="ml-2 tabnum">{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {source && source.rows.length > 0 && (
        <div>
          {source.caption ? <SlotLabel>{source.caption}</SlotLabel> : null}
          {/* Samme regel som i sidens tabell: kolonnetitlene blir stående mens
              radene ruller. En kildetabell kan være hundre fortollinger lang, og
              en vegg med tall uten kolonnenavn er ikke lesbar. Titlene legger seg
              rett UNDER den klebrige varelinjen — `--row-bottom` settes av
              DataTable, som er den eneste som vet hvor høy den linjen er.

              Ingen egen rullesone her: hadde denne tabellen ligget i en
              `overflow`-boks, ville titlene klebet til boksen i stedet for til
              sidens tabell, og siden hadde fått en tredje rullesone. Bred kilde-
              tabell ruller derfor vannrett sammen med tabellen den står i.

              `border-separate` er samme krav som i `ui/table.tsx`: med collapse
              males et klebrig hode UNDER radene som passerer. */}
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead
              className="sticky z-0 text-left text-2xs uppercase tracking-wider text-muted-foreground"
              style={{ top: 'var(--row-bottom, 2.5rem)' }}
            >
              <tr>
                {source.columns.map((c, i) => <th key={i} className="bg-surface-sunken p-2 text-left font-medium">{c.header}</th>)}
              </tr>
            </thead>
            <tbody>
              {source.rows.map((r, i) => (
                <tr key={i} className={cn('align-top [&>td]:border-t [&>td]:border-border/60', source.rowFlagged?.(r) && 'bg-destructive/5')}>
                  {source.columns.map((c, j) => (
                    <td key={j} className={cn('p-2', source.cellFlagged?.(r, j) && 'bg-destructive/10 font-medium')}>
                      {c.cell(r, i)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {source.footnote ? <p className="mt-2 text-xs text-muted-foreground">{source.footnote}</p> : null}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Column vocabulary for source tables.
 *
 * Built on the same cells the main tables use, so a tollnummer, an amount or a
 * deadline is rendered identically whether it sits in a page table or three
 * levels down inside an expansion.
 * ------------------------------------------------------------------ */

type Get<T = any> = (row: T) => any;

export const COL = {
  code: (header: React.ReactNode, get: Get): SourceColumn => ({ header, cell: (r) => <Code>{get(r)}</Code> }),
  text: (header: React.ReactNode, get: Get, width = 'max-w-[24ch]'): SourceColumn => ({
    header, cell: (r) => <Secondary width={width}>{get(r)}</Secondary>,
  }),
  plain: (header: React.ReactNode, get: Get): SourceColumn => ({ header, cell: (r) => <>{get(r) ?? '—'}</> }),
  num: (header: React.ReactNode, get: Get): SourceColumn => ({ header, cell: (r) => <Num value={get(r)} tabular /> }),
  money: (header: React.ReactNode, get: Get): SourceColumn => ({ header, cell: (r) => <Amount nok={get(r)} tabular /> }),
  badge: (header: React.ReactNode, get: Get, variant: any = 'secondary'): SourceColumn => ({
    header, cell: (r) => { const v = get(r); return v == null || v === '' ? <span className="text-muted-foreground">—</span> : <Badge variant={variant}>{v}</Badge>; },
  }),
  node: (header: React.ReactNode, cell: (row: any, index: number) => React.ReactNode): SourceColumn => ({ header, cell }),

  /** The two columns that identify a customs entry. Always first. */
  tollnummer: (get: Get = (r) => r.tollnummer): SourceColumn => ({ header: 'Tollnummer', cell: (r) => <Code>{get(r)}</Code> }),
  godkjent: (get: Get = (r) => r.godkjent): SourceColumn => ({ header: 'Godkjent', cell: (r) => <Code>{get(r)}</Code> }),

  /** The two columns that close a declaration-backed source table. Always last. */
  frist: (get: Get = (r) => r.days_left): SourceColumn => ({ header: 'Frist', cell: (r) => <Deadline days={get(r)} /> }),
  kilde: (get: Get = (r) => r.sad_url): SourceColumn => ({ header: 'Kilde', cell: (r) => <SadLink url={get(r)} /> }),
};

/**
 * Columns for "the customs entries behind this row".
 *
 * Identity first, the row-specific middle, then always deadline + source document —
 * so every expansion that bottoms out in declarations ends the same way, and you can
 * always reach the SAD you need to document a claim.
 */
export function entryColumns(middle: SourceColumn[], opts: { godkjent?: Get; deadline?: Get; sad?: Get } = {}): SourceColumn[] {
  const {
    godkjent = (r: any) => r.godkjent,
    deadline = (r: any) => r.days_left,
    sad = (r: any) => r.sad_url,
  } = opts;
  return [COL.tollnummer(), COL.godkjent(godkjent), ...middle, COL.frist(deadline), COL.kilde(sad)];
}

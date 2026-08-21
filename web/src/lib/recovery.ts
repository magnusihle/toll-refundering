export const TYPES = ['alle', 'RÅK', 'Preferanse', 'Produkt'];

// Materialitetsgrense for det som SENDES til 3PL: saker (grupper) under dette
// beløpet legges i egen «Småkrav»-fane i arket og nevnes bare som én linje i
// e-posten — hver omberegning har håndteringskost, og 2 kr-krav svekker
// troverdigheten til resten av listen. Gjelder KUN e-post/eksport; dashbordet
// viser og summerer fortsatt alt.
export const SMALL_CLAIM_NOK = 100;
export const splitByMateriality = (groups: ClaimGroup[]) => {
  const small = groups.filter((g) => g.amount_nok < SMALL_CLAIM_NOK);
  // Er alt smått, finnes ingen «hovedliste» å beskytte — da sendes alt som før.
  if (small.length === groups.length) return { material: groups, small: [] as ClaimGroup[] };
  return { material: groups.filter((g) => g.amount_nok >= SMALL_CLAIM_NOK), small };
};

// Menneskelige etiketter for match-nivåene. Delt mellom tabellen, e-posten og
// Excel-eksporten så en «reclass_strong» aldri lekker rå ut til leseren.
export const CONF_LABEL: Record<string, string> = {
  strong: 'sterk', weak: 'svak', possible: 'mulig', review: 'til gjennomgang', info: 'produktavvik',
  raak_grant: 'nedsettelse funnet', no_basis: 'ikke grunnlag',
  reclass_strong: 'agent-vurdert — sterk', reclass_possible: 'agent-vurdert — mulig', reclass_weak: 'agent-vurdert — svak',
};
export const confLabel = (v: any) => CONF_LABEL[v] ?? (v == null ? '' : String(v));

// Sannsynlighetsvekt. MÅ speile weightOf i src/analysis.js (actionList).
// Agentens vurderte sannsynlighet går ALLTID foran match-styrken: den bygger på
// oppslag av faktisk tollsats, mens match-styrken bare er en tekstheuristikk.
export const weightOf = (r: any) => {
  if (r.likelihood) return r.likelihood === 'høy' ? 0.8 : r.likelihood === 'middels' ? 0.4 : r.likelihood === 'lav' ? 0.1 : 0;
  // «possible» = preferanse UTEN opprinnelsesbevis på linjen (må skaffes fra leverandør).
  // «weak» = usikker match. «info» = produktavvik (strengt filtrert).
  return r.confidence === 'strong' ? 0.8 : r.confidence === 'possible' ? 0.35 : r.confidence === 'weak' ? 0.2
    : r.confidence === 'info' ? 0.55 : r.confidence === 'review' ? 0.1 : r.confidence === 'raak_grant' ? 0.35 : 0.4;
};

export const rowsFor = (rows: any[], kind: string) => kind === 'alle' ? rows : rows.filter((r) => r.kind === kind);

export function agg(rows: any[]) {
  const ceiling = rows.reduce((s, r) => s + (r.amount_nok || 0), 0);
  const likely = rows.reduce((s, r) => s + (r.amount_nok || 0) * weightOf(r), 0);
  // Solid = agent-bekreftet høy sannsynlighet, eller sterk match som ikke er agent-nedgradert.
  const solid = rows.filter((r) => r.likelihood === 'høy' || (!r.likelihood && r.confidence === 'strong'))
    .reduce((s, r) => s + (r.amount_nok || 0), 0);
  const urgent = rows.filter((r) => r.dager_igjen != null && r.dager_igjen <= 90);
  return {
    ceiling, likely, solid,
    total: ceiling, // bakoverkompatibelt alias
    urgentAmount: urgent.reduce((s, r) => s + (r.amount_nok || 0), 0),
    urgentCount: urgent.length,
    count: rows.length,
    assessed: rows.filter((r) => r.likelihood).length,
  };
}

// ---- Konsolidering av krav ----
//
// Ett krav per varelinje betyr at «PLANTFORCE SYNERGY PROTEIN» fra samme leverandør
// står 22 ganger i listen. For DSV er det ÉN sak som gjelder 22 fortollinger, ikke 22
// saker. Vi grupperer derfor på (type, avsender, produkt) for VISNING.
//
// VIKTIG: beløp, «haster»-telling og CSV-eksporten regnes fortsatt på de FLATE radene.
// Grupperingen endrer bare hvordan listen vises — aldri hva som summeres, og aldri hva
// DSV får utlevert. Hver fortolling må uansett omberegnes for seg i TVINN.

import { normSupplier } from '@/lib/group';

export type ClaimGroup = {
  key: string; kind: string; aktor: string | null; produkt: string;
  claims: any[]; count: number;
  amount_nok: number;
  dager_igjen: number | null;   // korteste frist i gruppen — den styrer hastverket
  frist: string | null;
  urgentCount: number;
  confidences: string[];
  likelihoods: string[];
  assessed: number;
  tollnummers: string[];
  /** Felt som er identiske for hele gruppen, og derfor kan løftes ut av radlisten. */
  shared: { action?: string; reasoning?: string; claim_draft?: string; likelihood?: string; bku?: any };
  _flag: boolean;
};

const normProd = (s: any) => String(s || '').toLowerCase().replace(/[^a-z0-9æøå ]+/g, ' ').replace(/\s+/g, ' ').trim();
const uniq = <T,>(a: T[]) => [...new Set(a)];
const sharedVal = (rows: any[], f: string) => { const v = uniq(rows.map((r) => r[f] ?? null)); return v.length === 1 && v[0] ? String(v[0]) : undefined; };
const byCount = (vals: any[]) => {
  const t = new Map<any, number>();
  for (const v of vals) if (v != null && v !== '') t.set(v, (t.get(v) || 0) + 1);
  return [...t.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
};

export function groupClaims(rows: any[]): ClaimGroup[] {
  const buckets = new Map<string, any[]>();
  for (const r of rows) {
    const k = r.kind + '§' + normSupplier(r.aktor) + '§' + normProd(r.produkt);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const out: ClaimGroup[] = [];
  for (const [key, claims] of buckets) {
    const sorted = [...claims].sort((a, b) => (a.dager_igjen ?? Infinity) - (b.dager_igjen ?? Infinity));
    const days = claims.map((r) => r.dager_igjen).filter((d) => d != null) as number[];
    const first = sorted[0];
    out.push({
      key, kind: first.kind,
      aktor: byCount(claims.map((r) => r.aktor))[0] ?? null,
      produkt: byCount(claims.map((r) => r.produkt))[0] ?? '',
      claims: sorted, count: claims.length,
      amount_nok: Math.round(claims.reduce((s, r) => s + (r.amount_nok || 0), 0) * 100) / 100,
      dager_igjen: days.length ? Math.min(...days) : null,
      frist: first.frist ?? null,
      urgentCount: days.filter((d) => d <= 90).length,
      confidences: byCount(claims.map((r) => r.confidence)),
      likelihoods: byCount(claims.map((r) => r.likelihood)),
      assessed: claims.filter((r) => r.likelihood).length,
      tollnummers: uniq(claims.map((r) => r.tollnummer).filter(Boolean)),
      shared: {
        action: sharedVal(claims, 'action'),
        reasoning: sharedVal(claims, 'reasoning'),
        claim_draft: sharedVal(claims, 'claim_draft'),
        likelihood: sharedVal(claims, 'likelihood'),
        // Presedensen henger på (vare, varenummer) — identisk for hele gruppen,
        // så den kan løftes ut sammen med de andre delte feltene.
        bku: claims.find((r) => r.bku)?.bku,
      },
      _flag: days.some((d) => d <= 90),
    });
  }
  return out.sort((a, b) => b.amount_nok - a.amount_nok);
}

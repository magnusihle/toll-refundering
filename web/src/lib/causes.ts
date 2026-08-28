/**
 * Why the duty was overpaid — the ROOT cause, not the symptom.
 *
 * The first version of this file split «feil vareklassifisering» from «feil
 * tollsats», and that was wrong: a wrong commodity code is precisely what
 * produces a wrong rate. The two bars were cause and consequence sitting side by
 * side as if they were alternatives, and the sum of a cause and its own
 * consequence means nothing.
 *
 * The fix is a precedence, not a nicer set of words. Every claim is filed under
 * the FIRST of these that applies, so the buckets are mutually exclusive by
 * construction:
 *
 *   1. A granted RÅK reduction was valid on the clearance date and was not used.
 *   2. The agent proposes a DIFFERENT commodity code. The code decides the rate,
 *      so the misclassification is the cause and the rate is the symptom.
 *   3. Preference was never claimed at all — no verdict, no grant, an eligible
 *      origin and no preference on the declaration.
 *   4. The code stands and the rate paid is not the one that applied.
 *
 * What decides 2 is `foreslatt_hs` against the declared `hs_code`, compared on
 * digits alone («21.06.9039» and «21069039» are the same code). That is a string
 * comparison over two stored fields — not `mekanisme`, which is free text the
 * agent writes and which does not hold the levels apart: of the 14 claims it
 * labels `feil_sats`, 13 propose no new code at all, while one labelled
 * `avtalesats` proposes a different code and is a reclassification.
 *
 * What is NOT here, deliberately: «feil grunnlag/verdi». It exists in the data —
 * a handful of verdicts describe duty computed ad valorem where the tariff sets a
 * specific rate in kr/kg — but it is only visible in the agent's prose, and the
 * one structured field that could separate it (`foreslatt_sats`) cannot tell
 * 0 kr/kg from 0 %. Splitting it out would mean text-matching reasoning
 * paragraphs, which is a guess wearing a category's clothes. It stays inside
 * «feil sats på riktig varenummer» until an assessment run emits a controlled
 * mechanism. See TODO below.
 */
// TODO(magnus, 2026-10-01): la scripts/assess-pref.mjs skrive en LUKKET
// mekanisme-liste (klassifisering | preferanse | nedsettelse | grunnlag | ingen)
// i stedet for fritekst. Da kan «feil grunnlag/verdi» bli en egen søyle uten at
// vi gjetter ut fra begrunnelsen.
import { weightOf } from '@/lib/recovery';

export type CauseKey = 'grant' | 'classification' | 'preference' | 'rate' | 'other';

export const CAUSES: Record<CauseKey, { label: string; why: string }> = {
  classification: {
    label: 'Feil klassifisering',
    why: 'Varen er fortollet på et varenummer den ikke hører hjemme under. Varenummeret bestemmer satsen, så feil nummer gir feil toll.',
  },
  rate: {
    label: 'Feil sats på riktig varenummer',
    why: 'Varenummeret står, men satsen som ble brukt er ikke den som gjaldt for dette opphavet — som regel ordinær sats der handelsavtalen ga en lavere.',
  },
  grant: {
    label: 'Tollnedsettelse ikke benyttet',
    why: 'Varen hadde en innvilget RÅK-tollnedsettelse som gjaldt på fortollingsdagen, men full sats ble betalt likevel.',
  },
  preference: {
    label: 'Preferanse ikke benyttet',
    why: 'Opphavet gir tollfrihet eller redusert sats, men preferanse ble aldri krevd ved fortolling.',
  },
  other: {
    label: 'Andre forhold',
    why: 'Avvik vi har funnet, men ikke kan tilbakeføre til én entydig årsak i grunnlaget.',
  },
};

/** Digits only: «21.06.9039» and «21069039» are the same commodity code. */
const hsDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

export function causeOf(row: any): CauseKey {
  if (row.kind === 'RÅK' || row.confidence === 'raak_grant') return 'grant';
  const proposed = hsDigits(row.foreslatt_hs);
  if (proposed && proposed !== hsDigits(row.hs_code)) return 'classification';
  // An agent verdict means the rate itself was looked up and judged. Without one
  // the claim came off the plain preference path: preference simply never claimed.
  if (row.kind === 'Preferanse') return row.likelihood ? 'rate' : 'preference';
  return 'other';
}

export type CauseSlice = {
  key: CauseKey;
  label: string;
  why: string;
  likely: number;
  ceiling: number;
  count: number;
  /** Share of the total likely refund, in percent. */
  share: number;
};

/** Ranked by money, largest first. Causes worth nothing are left out — a zero bar explains nothing. */
export function byCause(rows: any[]): CauseSlice[] {
  const buckets = new Map<CauseKey, { likely: number; ceiling: number; count: number }>();
  for (const r of rows) {
    const key = causeOf(r);
    const b = buckets.get(key) ?? { likely: 0, ceiling: 0, count: 0 };
    b.likely += (r.amount_nok || 0) * weightOf(r);
    b.ceiling += r.amount_nok || 0;
    b.count++;
    buckets.set(key, b);
  }
  const total = [...buckets.values()].reduce((s, b) => s + b.likely, 0);
  return [...buckets.entries()]
    .filter(([, b]) => b.likely > 0)
    .map(([key, b]) => ({ key, ...CAUSES[key], ...b, share: total > 0 ? (b.likely / total) * 100 : 0 }))
    .sort((a, b) => b.likely - a.likely);
}

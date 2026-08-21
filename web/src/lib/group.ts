// Konsolidering av varelinjer.
//
// Én vare fra én leverandør får én varelinje PER SENDING. Uten konsolidering vises
// «BioAcidophilus» fra Biocare 24 ganger i Varer-siden, og et ekte avvik (én sending
// med 25 % MVA mot 23 med 15 %) drukner i repetisjonen. Vi grupperer derfor på
// (aktør, product_key) — samme vareidentitet som produktavvikene i src/analysis.js —
// og løfter ulikheter INNAD i gruppen opp som eksplisitte avvik.
//
// Viktig: vi grupperer ALLTID på vareidentitet, ikke bare når alt er likt. Grupper der
// alt er likt kollapser til én ren rad; grupper der noe spriker blir markert. Å splitte
// gruppen på det avvikende feltet ville gjenskapt repetisjonen og skjult nettopp det vi
// vil finne.

import { rateUnit } from '@/lib/charges';

export type Severity = 'avvik' | 'merk';
export type Variance = { field: string; label: string; severity: Severity; values: any[]; note?: string };

export type ChargeAgg = {
  key: string; source: string; charge_type: string;
  amount: number; base: number; rates: (number | null)[]; lines: number;
  /** '%' | 'kr/kg' | … — utledet per linje, ikke gjettet ut fra avgiftstypen. */
  unit: string;
};

export type GoodsGroup = {
  key: string;
  aktor: string | null;
  aktorSpellings: string[];
  produkt: string;
  descriptions: string[];
  article_number: string | null;
  hs_codes: string[];
  origins: string[];
  preference_codes: string[];
  lines: any[];
  lineCount: number;
  declCount: number;
  tollnummers: string[];
  first: string | null;
  last: string | null;
  item_value: number;
  net_weight: number;
  charges: ChargeAgg[];
  duty: number;
  vat_rates: (number | null)[];
  variances: Variance[];
  _flag: boolean;
};

const num = (v: any) => (v == null || v === '' || isNaN(Number(v)) ? 0 : Number(v));
const uniq = <T,>(a: T[]) => [...new Set(a)];
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Hyppigste verdi i en liste — gruppens referanseverdi. */
export function dominant<T>(vals: T[]): T | null {
  const tally = new Map<T, number>();
  for (const v of vals) if (v != null && (v as any) !== '') tally.set(v, (tally.get(v) || 0) + 1);
  let best: T | null = null, bestN = 0;
  for (const [v, n] of tally) if (n > bestN) { best = v; bestN = n; }
  return best;
}

/** Sorterbar dato: `godkjent_iso` når den finnes, ellers parsed dd.mm.yyyy. */
export const isoOf = (row: any): string | null => {
  if (row?.godkjent_iso) return row.godkjent_iso;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(row?.godkjent || ''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

// product_key er 'art:<artikkelnr>' når leverandøren oppgir artikkelnummer, ellers
// 'desc:<normalisert beskrivelse>' (satt i src/pipeline.js). Fallback her er kun for
// linjer helt uten både artikkelnummer og beskrivelse.
const identity = (g: any) =>
  g.product_key ||
  ('desc:' + String(g.description || g.hs_code || '?').toLowerCase().replace(/[^a-z0-9æøå ]/gi, ' ').replace(/\s+/g, ' ').trim());

// Leverandørnavnet i EMMA er fritekst per sending. «PLANTFORCE.DK APS», «PLANTFORCE.DK»
// og «PLANTFORCE DK.» er samme avsender — uten normalisering splittes én vare i tre.
// Vi fjerner tegnsetting og selskapsform; det er deterministisk og trygt.
const LEGAL = /\b(a\s?s|a\s?\/\s?s|aps|oy|oyj|ab|asa|gmbh|mbh|ug|kg|ohg|ltd|limited|plc|llc|inc|corp|co|bv|nv|sa|sas|sarl|srl|spa|as\s?oy|kft|sp\s?z\s?oo|dooel|doo|ehf|hf|aktiengesellschaft|holding|group|international|intl)\b/g;
export function normSupplier(aktor: any): string {
  const base = String(aktor || '—').toLowerCase().replace(/[^a-z0-9æøå ]+/gi, ' ').replace(/\s+/g, ' ').trim();
  const stripped = base.replace(LEGAL, ' ').replace(/\s+/g, ' ').trim();
  return (stripped || base).toUpperCase();
}

// Restricted Damerau-Levenshtein, med tidlig exit på avstand > max.
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [], prev = Array.from({ length: b.length + 1 }, (_, j) => j), cur: number[] = [];
  for (let i = 1; i <= a.length; i++) {
    cur = new Array(b.length + 1); cur[0] = i;
    let best = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v; if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}

/**
 * Kanonisk gruppenøkkel per varelinje.
 *
 * To trinn: (1) deterministisk normalisering av leverandørnavnet, (2) slå sammen
 * skrivefeil-varianter — men BARE innenfor samme vare og bare ved én redigering
 * («FINNO HELATH» → «FINNO HEALTH»). Samme vare + nesten samme avsendernavn er i
 * praksis samme avsender; å begrense sammenslåingen til én vare gjør at to reelt
 * ulike leverandører ikke kan smelte sammen.
 */
export function keyIndex(goods: any[]): Map<any, string> {
  const byIdentity = new Map<string, Map<string, { n: number; raw: string[] }>>();
  for (const g of goods || []) {
    const id = identity(g), sup = normSupplier(g.aktor);
    if (!byIdentity.has(id)) byIdentity.set(id, new Map());
    const m = byIdentity.get(id)!;
    if (!m.has(sup)) m.set(sup, { n: 0, raw: [] });
    const e = m.get(sup)!; e.n++; e.raw.push(g.aktor);
  }
  const canon = new Map<string, string>();   // id§sup -> id§canonicalSup
  for (const [id, sups] of byIdentity) {
    const names = [...sups.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])).map(([s]) => s);
    const parent = new Map(names.map((s) => [s, s]));
    const find = (s: string): string => { let r = s; while (parent.get(r) !== r) r = parent.get(r)!; return r; };
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const a = names[i], b = names[j];
      if (Math.min(a.length, b.length) < 6) continue;
      if (editDistance(a, b, 1) <= 1) { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); }
    }
    for (const s of names) canon.set(id + '§' + s, id + '§' + find(s));
  }
  const out = new Map<any, string>();
  for (const g of goods || []) out.set(g, canon.get(identity(g) + '§' + normSupplier(g.aktor))!);
  return out;
}

/** Grupper varelinjer på (avsender, vareidentitet). Sortert etter samlet verdi. */
export function groupGoods(goods: any[]): GoodsGroup[] {
  const keys = keyIndex(goods);
  const buckets = new Map<string, any[]>();
  for (const g of goods || []) {
    const k = keys.get(g)!;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(g);
  }
  const out: GoodsGroup[] = [];
  for (const [key, lines] of buckets) out.push(buildGroup(key, lines));
  return out.sort((a, b) => b.item_value - a.item_value);
}

function buildGroup(key: string, lines: any[]): GoodsGroup {
  const dates = lines.map(isoOf).filter(Boolean) as string[];
  const sorted = [...lines].sort((a, b) => String(isoOf(b) || '').localeCompare(String(isoOf(a) || '')));

  const hs_codes = uniq(lines.map((l) => l.hs_code).filter(Boolean)).sort();
  const origins = uniq(lines.map((l) => l.origin).filter(Boolean)).sort();
  const preference_codes = uniq(lines.map((l) => l.preference_code).filter(Boolean)).sort();
  const descriptions = uniq(lines.map((l) => (l.description || '').trim()).filter(Boolean));

  // Avgifter slås sammen per (kilde, type). Satsen er en EGENSKAP ved gruppen: flere
  // satser på samme avgiftstype for samme vare er nettopp det vi vil se.
  const cmap = new Map<string, ChargeAgg>();
  for (const l of lines) for (const c of l.charges || []) {
    const k = c.source + ':' + c.charge_type;
    let a = cmap.get(k);
    if (!a) { a = { key: k, source: c.source, charge_type: c.charge_type, amount: 0, base: 0, rates: [], lines: 0, unit: '' }; cmap.set(k, a); }
    a.amount += num(c.amount); a.base += num(c.base); a.lines++;
    // Enheten utledes fra den enkelte linjen (grunnlag × sats mot faktisk beløp) —
    // aggregatet kan ikke brukes når gruppen har flere satser.
    if (!a.unit) a.unit = rateUnit(c);
    if (!a.rates.some((r) => r === (c.rate ?? null))) a.rates.push(c.rate ?? null);
  }
  const charges = [...cmap.values()].map((a) => ({ ...a, amount: r2(a.amount), base: r2(a.base), rates: a.rates.sort((x, y) => num(x) - num(y)) }))
    .sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key));
  const vatAgg = charges.filter((c) => c.source === 'vat');
  const vat_rates = uniq(vatAgg.flatMap((c) => c.rates)).sort((a, b) => num(a) - num(b));

  const aktorSpellings = uniq(lines.map((l) => l.aktor).filter(Boolean));
  const g: GoodsGroup = {
    key,
    aktor: dominant(lines.map((l) => l.aktor)) ?? null,
    aktorSpellings,
    produkt: pickLabel(lines),
    descriptions,
    article_number: dominant(lines.map((l) => l.article_number).filter(Boolean)) ?? null,
    hs_codes, origins, preference_codes,
    lines: sorted,
    lineCount: lines.length,
    declCount: uniq(lines.map((l) => l.tollnummer)).length,
    tollnummers: uniq(lines.map((l) => l.tollnummer)),
    first: dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null,
    last: dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null,
    item_value: r2(lines.reduce((s, l) => s + num(l.item_value), 0)),
    net_weight: r2(lines.reduce((s, l) => s + num(l.net_weight), 0)),
    charges,
    duty: r2(charges.filter((c) => c.source !== 'vat').reduce((s, c) => s + c.amount, 0)),
    vat_rates,
    variances: [],
    _flag: false,
  };
  g.variances = detectVariances(g);
  g._flag = g.variances.some((v) => v.severity === 'avvik');
  return g;
}

// Vareteksten: den hyppigste beskrivelsen, med den lengste som tiebreak — korte
// generiske tekster («legemidler») skal ikke vinne over en spesifikk når begge er like vanlige.
function pickLabel(lines: any[]): string {
  const tally = new Map<string, number>();
  for (const l of lines) { const d = (l.description || '').trim(); if (d) tally.set(d, (tally.get(d) || 0) + 1); }
  const best = [...tally.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0];
  return best ? best[0] : (lines[0]?.article_number || lines[0]?.hs_code || '—');
}

// Hva som er et AVVIK og hva som bare er verdt å merke seg:
//   avvik = samme vare er behandlet ulikt på en måte som koster penger eller er feil
//           (ulik 8-sifret varenummer innen samme posisjon, ulik MVA-sats, ulik tollsats
//           når varenummer og opphav er identisk).
//   merk  = variasjon som ofte er legitim (ulikt opphav, ulik preferansekode per sending),
//           eller et tegn på at grupperingen selv er grov (varenummer i ulike posisjoner).
function detectVariances(g: GoodsGroup): Variance[] {
  const v: Variance[] = [];
  if (g.hs_codes.length > 1) {
    const headings = uniq(g.hs_codes.map((h) => String(h).slice(0, 4)));
    v.push(headings.length > 1
      ? { field: 'hs', label: 'Ulik posisjon', severity: 'merk', values: g.hs_codes, note: 'Varenumrene ligger i ulike tolltariff-posisjoner — beskrivelsen er trolig for generisk, så gruppen kan romme ulike varer.' }
      : { field: 'hs', label: 'Ulikt varenummer', severity: 'avvik', values: g.hs_codes, note: 'Samme vare er klassifisert på ulike 8-sifrede varenumre innen samme posisjon. Ett av dem er feil.' });
  }
  if (g.vat_rates.length > 1) {
    v.push({ field: 'vat', label: 'Ulik MVA-sats', severity: 'avvik', values: g.vat_rates, note: 'Samme vare er fortollet med ulik MVA-sats. Innførsels-MVA er fradragsberettiget, så dette er et datakvalitetsavvik — ikke penger å hente.' });
  }
  // Ulik tollsats teller bare som avvik når varenummer OG opphav er identisk; ellers er
  // forskjellen forventet (annen opprinnelse, annen avtalesats).
  const sameBasis = g.hs_codes.length <= 1 && g.origins.length <= 1;
  for (const c of g.charges) {
    if (c.source === 'vat' || c.rates.filter((r) => r != null).length <= 1) continue;
    v.push(sameBasis
      ? { field: 'rate:' + c.charge_type, label: `Ulik ${c.charge_type}-sats`, severity: 'avvik', values: c.rates, note: `Samme varenummer og samme opphav, men ${c.charge_type} er beregnet med ulik sats.` }
      : { field: 'rate:' + c.charge_type, label: `Ulik ${c.charge_type}-sats`, severity: 'merk', values: c.rates, note: `${c.charge_type}-satsen varierer, men gruppen spenner over flere varenumre/opphav — forskjellen kan være legitim.` });
  }
  if (g.preference_codes.length > 1) {
    v.push({ field: 'pref', label: 'Ulik preferanse', severity: 'merk', values: g.preference_codes, note: 'Preferansekoden varierer mellom sendingene. Ofte legitimt (bevis mangler på enkeltsendinger), men verdt å sjekke mot Refusjon-siden.' });
  }
  if (g.origins.length > 1) {
    v.push({ field: 'origin', label: 'Ulikt opphav', severity: 'merk', values: g.origins, note: 'Varen er innført med ulikt opprinnelsesland.' });
  }
  if (g.aktorSpellings.length > 1) {
    v.push({ field: 'aktor', label: 'Ulik skrivemåte avsender', severity: 'merk', values: g.aktorSpellings, note: 'Avsender er skrevet på flere måter i EMMA. Linjene er slått sammen fordi det er samme vare og navnene er tilnærmet like — kontroller at det faktisk er samme leverandør.' });
  }
  return v;
}

/** Felt der linjen avviker fra gruppens dominerende verdi — brukes til å markere celler. */
export function lineDeviations(g: GoodsGroup, line: any): Set<string> {
  const out = new Set<string>();
  if (g.hs_codes.length > 1 && line.hs_code !== dominant(g.lines.map((l) => l.hs_code))) out.add('hs_code');
  if (g.origins.length > 1 && line.origin !== dominant(g.lines.map((l) => l.origin))) out.add('origin');
  if (g.preference_codes.length > 1 && line.preference_code !== dominant(g.lines.map((l) => l.preference_code))) out.add('preference_code');
  if (g.vat_rates.length > 1) {
    const domVat = dominant(g.lines.flatMap((l) => (l.charges || []).filter((c: any) => c.source === 'vat').map((c: any) => c.rate)));
    const mine = (line.charges || []).filter((c: any) => c.source === 'vat').map((c: any) => c.rate);
    if (mine.length && !mine.includes(domVat)) out.add('vat');
  }
  return out;
}

// Ulik skrivemåte på avsender er en observasjon om DATAKILDEN, ikke om varen. Den er
// nesten universell i EMMA og ville fylt avvikskolonnen på annenhver rad. Den vises
// derfor bare som «+N» ved aktørnavnet og i den utvidede raden.
export const isProductVariance = (v: Variance) => v.field !== 'aktor';

/** Sammendrag for verktøylinja over en gruppert tabell. */
export function groupSummary(groups: GoodsGroup[]) {
  return {
    groups: groups.length,
    lines: groups.reduce((s, g) => s + g.lineCount, 0),
    flagged: groups.filter((g) => g._flag).length,
    noted: groups.filter((g) => !g._flag && g.variances.some(isProductVariance)).length,
    value: r2(groups.reduce((s, g) => s + g.item_value, 0)),
    duty: r2(groups.reduce((s, g) => s + g.duty, 0)),
  };
}

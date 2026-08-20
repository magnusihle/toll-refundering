// Konsolidering av leverandører.
//
// Leverandørnavnet i EMMA er fritekst per sending, så «PLANTFORCE.DK APS»,
// «PLANTFORCE.DK» og «PLANTFORCE DK.» blir tre rader uten normalisering. Vi bruker
// nøyaktig samme identitet som Varer-siden (normSupplier), slik at «én rad per
// leverandør» betyr det samme begge steder.

import { normSupplier, dominant, isoOf } from '@/lib/group';

export type SupplierGroup = {
  key: string;
  aktor: string;
  spellings: string[];
  declarations: any[];
  declCount: number;
  lineCount: number;
  first: string | null;
  last: string | null;
  value: number;
  duty: number;
  currencies: string[];
  incoterms: string[];
  /** Deklarasjoner der kilde-SAD-en fortsatt kan åpnes i EMMA. */
  sadCount: number;
};

// Feltet er fritekst, så det inneholder også ting som ikke er leveringsvilkår
// (valutakoder, ordrereferanser). Bare de faktiske klausulene teller som vilkår.
const INCOTERMS = new Set(['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'DAT', 'DEQ', 'DES', 'DAF', 'DDU']);
export const baseTerm = (t: any) => {
  const k = String(t || '').trim().toUpperCase().split(/\s+/)[0];
  return INCOTERMS.has(k) ? k : null;
};

const uniq = <T,>(a: T[]) => [...new Set(a)];
const byCount = (vals: any[]) => {
  const t = new Map<any, number>();
  for (const v of vals) if (v != null && v !== '') t.set(v, (t.get(v) || 0) + 1);
  return [...t.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
};

export function groupSuppliers(declarations: any[]): SupplierGroup[] {
  const buckets = new Map<string, any[]>();
  for (const d of declarations) {
    const k = normSupplier(d.aktor);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(d);
  }

  const out: SupplierGroup[] = [];
  for (const [key, decls] of buckets) {
    const sorted = [...decls].sort((a, b) => String(isoOf(b) ?? '').localeCompare(String(isoOf(a) ?? '')));
    const dates = decls.map(isoOf).filter(Boolean).sort() as string[];
    out.push({
      key,
      aktor: dominant(decls.map((d) => d.aktor)) ?? '—',
      spellings: byCount(decls.map((d) => d.aktor)),
      declarations: sorted,
      declCount: decls.length,
      lineCount: decls.reduce((s, d) => s + (d.lines?.length || 0), 0),
      first: dates[0] ?? null,
      last: dates[dates.length - 1] ?? null,
      value: Math.round(decls.reduce((s, d) => s + (d.value_nok || 0), 0) * 100) / 100,
      duty: Math.round(decls.reduce((s, d) => s + (d.avg || 0), 0) * 100) / 100,
      currencies: byCount(decls.map((d) => d.valuta)),
      incoterms: uniq(decls.map((d) => baseTerm(d.box20_incoterm || d.levvilk)).filter(Boolean) as string[]),
      sadCount: decls.filter((d) => d.sad_url).length,
    });
  }
  return out.sort((a, b) => b.value - a.value);
}

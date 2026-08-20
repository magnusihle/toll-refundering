/**
 * Avgiftsdekning.
 *
 * Deklarasjonen har ett samlet «Avgift»-tall fra EMMA. Avgiftsfordelingen per type
 * bygger derimot på LINJENE, og linjene er bare fullstendige for deklarasjoner der
 * varelinjene er hentet fra SAD-en. Der linjene kommer fra Linjer-griden mangler en
 * god del av avgiftene per linje — summen per type blir da lavere enn det som faktisk
 * er betalt.
 *
 * Vi regner ut avviket og viser det, i stedet for å la to «avgifter»-tall stå ved
 * siden av hverandre uten forklaring.
 */
export type ChargeCoverage = {
  declared: number;      // sum av deklarasjonenes egen avgiftskolonne
  lineLevel: number;     // sum av avgifter registrert per varelinje (det fordelingen viser)
  gap: number;
  pct: number;           // andel av betalte avgifter som er fordelt på type
  /** Deklarasjoner som mangler avgifter på linjenivå, gruppert på hvor linjene kom fra. */
  bySource: { source: string; declarations: number; declared: number; lineLevel: number }[];
};

export function chargeCoverage(declarations: any[]): ChargeCoverage {
  const bySource = new Map<string, { source: string; declarations: number; declared: number; lineLevel: number }>();
  let declared = 0, lineLevel = 0;

  for (const d of declarations) {
    const src = d.line_source || 'ukjent';
    let entry = bySource.get(src);
    if (!entry) { entry = { source: src, declarations: 0, declared: 0, lineLevel: 0 }; bySource.set(src, entry); }
    entry.declarations++;

    const a = Number(d.avg) || 0;
    declared += a; entry.declared += a;

    for (const l of d.lines || []) {
      for (const c of l.charges || []) {
        // MVA er ikke en betalt avgift her — den føres som grunnlag, uten beløp.
        if (c.source === 'vat') continue;
        const amt = Number(c.amount) || 0;
        lineLevel += amt; entry.lineLevel += amt;
      }
    }
  }

  return {
    declared, lineLevel,
    gap: declared - lineLevel,
    pct: declared > 0 ? (lineLevel / declared) * 100 : 100,
    bySource: [...bySource.values()].sort((a, b) => (b.declared - b.lineLevel) - (a.declared - a.lineLevel)),
  };
}

export const SOURCE_LABEL: Record<string, string> = {
  sad: 'SAD (fullstendig)',
  linjer: 'Linjer-griden',
  ukjent: 'Ukjent kilde',
};

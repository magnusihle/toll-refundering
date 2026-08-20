const DUTY_CAT: Record<string, string> = { TL: 'customs', RT: 'raak', FA: 'levy', SU: 'excise', FK: 'excise', GA: 'packaging', MA: 'packaging', GB: 'packaging', MB: 'packaging', GG: 'packaging', MG: 'packaging', GP: 'packaging', MP: 'packaging', FF: 'export' };
export const CAT_LABEL: Record<string, string> = { customs: 'Toll (TL)', raak: 'RÅK (RT)', excise: 'Særavgift', packaging: 'Emballasje', levy: 'Forskningsavgift', vat: 'MVA', export: 'Eksportavgift', other: 'Annet' };
export const chargeCategory = (c: any) => c.source === 'vat' ? 'vat' : (DUTY_CAT[c.charge_type] || 'other');

// ---- Satsens enhet ----
//
// En sats i box 47 er enten ad valorem (prosent av grunnlaget) eller spesifikk
// (kroner per enhet). Å skrive «%» på alt — som vi gjorde — gjør en RÅK-sats på
// 31,71 kr/kg om til «31,71 %», altså et helt annet tall.
//
// Avgiftstypen alene avgjør det ikke: TL er blandet i dette datagrunnlaget (421
// spesifikke mot 45 ad valorem), akkurat som i tolltariffen. Vi utleder derfor per
// linje ved å se hvilken tolkning som faktisk gir det beløpet som er betalt, og
// faller først tilbake på typen når beløpet ikke kan brukes.

const PER_UNIT_LABEL: Record<string, string> = {
  RT: 'kr/kg',                    // RÅK-satser er kr/kg
  TL: 'kr/kg',                    // spesifikk toll oppgis kr/kg
  SU: 'kr/enhet', FK: 'kr/enhet', // særavgifter: kr per kg eller liter
  GA: 'kr/stk', MA: 'kr/stk', GB: 'kr/stk', MB: 'kr/stk',
  GG: 'kr/stk', MG: 'kr/stk', GP: 'kr/stk', MP: 'kr/stk',
};

/** Avgiftstyper vi vet er ad valorem selv når beløpet er avrundet til 0. */
const ALWAYS_PERCENT = new Set(['FA', 'FF']);

/** '%' | 'kr/kg' | 'kr/stk' | 'kr/enhet' | '' (ukjent — da skriver vi ingen enhet). */
export function rateUnit(c: any): string {
  if (c?.source === 'vat') return '%';           // MVA er alltid prosent av grunnlaget
  if (c?.rate == null) return '';

  const rate = Number(c.rate), base = Number(c.base), amount = Number(c.amount);
  if (Number.isFinite(base) && base > 0 && Number.isFinite(amount) && amount !== 0) {
    const asPercent = Math.abs(base * rate / 100 - amount);
    const asPerUnit = Math.abs(base * rate - amount);
    const tol = Math.max(1, Math.abs(amount) * 0.02);
    if (asPercent <= tol && asPercent <= asPerUnit) return '%';
    if (asPerUnit <= tol) return PER_UNIT_LABEL[c.charge_type] ?? 'kr/enhet';
  }

  if (ALWAYS_PERCENT.has(c?.charge_type)) return '%';
  return PER_UNIT_LABEL[c?.charge_type] ? '' : '%';
}

/** «25 %» / «31,71 kr/kg». Enheten skilles med mellomrom når den ikke er prosent. */
export function formatRate(c: any): string {
  if (c?.rate == null) return '—';
  const unit = rateUnit(c);
  const v = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 }).format(Number(c.rate));
  return unit === '%' ? `${v} %` : unit ? `${v} ${unit}` : v;
}

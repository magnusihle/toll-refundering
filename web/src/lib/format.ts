const nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 });
export const n = (v: any) => (v == null || v === '' || isNaN(Number(v)) ? '' : nf.format(Number(v)));
export const n2 = (v: any) => (v == null || v === '' || isNaN(Number(v)) ? '' : nf2.format(Number(v)));
export const money = (v: any, cur: string) => (v == null || v === '' || isNaN(Number(v)) ? '' : `${nf.format(Number(v))} ${cur}`);

/** «1 fortolling» / «22 fortollinger». Norwegian nouns don't pluralise by adding -s. */
export const plural = (count: number, one: string, many: string) =>
  `${nf.format(Number(count) || 0)} ${Number(count) === 1 ? one : many}`;

/** «6,8 %». Norwegian decimal comma, space before the sign. */
const pctFmt = (digits: number) => new Intl.NumberFormat('nb-NO', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct0 = pctFmt(0), pct1 = pctFmt(1);
export const pct = (v: any, digits = 1) =>
  v == null || v === '' || isNaN(Number(v)) ? '—' : `${(digits ? pct1 : pct0).format(Number(v))} %`;

/** ISO date → «27.08.2026». Norwegian order, for dates the reader recognises. */
export const noDate = (iso: any) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
};

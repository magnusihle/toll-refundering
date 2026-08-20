const nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 });
export const n = (v: any) => (v == null || v === '' || isNaN(Number(v)) ? '' : nf.format(Number(v)));
export const n2 = (v: any) => (v == null || v === '' || isNaN(Number(v)) ? '' : nf2.format(Number(v)));
export const money = (v: any, cur: string) => (v == null || v === '' || isNaN(Number(v)) ? '' : `${nf.format(Number(v))} ${cur}`);

/** «1 fortolling» / «22 fortollinger». Norwegian nouns don't pluralise by adding -s. */
export const plural = (count: number, one: string, many: string) =>
  `${nf.format(Number(count) || 0)} ${Number(count) === 1 ? one : many}`;

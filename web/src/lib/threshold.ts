import * as React from 'react';
import { useParam } from '@/lib/filters';

/**
 * Minstebeløp — grensen for hva som er verdt å kreve tilbake.
 *
 * Hver fortolling må omberegnes for seg i TVINN, så ARBEIDET ligger per
 * kravlinje, ikke per sak. Et krav på 4 kr koster mer å hente enn det er verdt,
 * og 104 av 321 linjer i dagens grunnlag er under 5 kr — til sammen 52 kroner.
 * Med grensen på 500 kr står 42 linjer igjen som holder 94 % av verdien.
 *
 * Grensen er et VISNINGSFILTER, aldri en sletting: alt som faller under vises
 * som antall og beløp der det filtreres, og kan slås av med ett klikk.
 *
 * Verdien ligger i URL-en (delbar lenke, overlever refresh) med localStorage som
 * fallback, slik at valget følger brukeren mellom sider og økter.
 */
export const MIN_AMOUNT_OPTIONS = [0, 100, 250, 500, 1000, 2500] as const;
export const MIN_AMOUNT_DEFAULT = 500;
export const MIN_AMOUNT_KEY = 'emma-min-amount';

const read = (raw: string | null): number | null => {
  if (raw == null || raw === '') return null;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : null;
};

/**
 * Minstebeløpet er ett filter blant flere nå, men det har sin egen inngang fordi
 * Dashbordet LESER det uten å eie det: begge sidene må beskrive de samme 42
 * kravene. Skrivingen går gjennom den delte `useParam`, så to filtre satt i
 * samme tick ikke lenger overskriver hverandre.
 */
export function useMinAmount(): [number, (v: number) => void] {
  const [raw, setRaw] = useParam('min', String(MIN_AMOUNT_DEFAULT), MIN_AMOUNT_KEY);
  const parsed = read(raw);
  const value = parsed ?? MIN_AMOUNT_DEFAULT;
  const set = React.useCallback((v: number) => setRaw(String(v)), [setRaw]);
  return [value, set];
}

/** Deler et sett kravlinjer i det som er verdt å hente og det som er støy. */
export function splitByAmount<T extends { amount_nok?: number | null }>(rows: T[], min: number) {
  if (!min) return { material: rows, below: [] as T[], belowValue: 0 };
  const material: T[] = [];
  const below: T[] = [];
  for (const r of rows) ((r.amount_nok ?? 0) >= min ? material : below).push(r);
  return { material, below, belowValue: below.reduce((s, r) => s + (r.amount_nok ?? 0), 0) };
}

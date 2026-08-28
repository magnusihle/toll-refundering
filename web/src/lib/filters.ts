import * as React from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Filtrering som DATA, ikke som JSX.
 *
 * Hver side deklarerer filtrene sine som en liste. Verktøylinjen, panelet,
 * brikkene, telleren og URL-synkingen bygges av deklarasjonen. Det er dette som
 * gjør at filter nummer tretti koster like lite som filter nummer tre — før lå
 * hvert filter som håndskrevet JSX i hver enkelt side, og da vokste raden
 * lineært med antall valg.
 *
 * ÉN regel binder det sammen: et filter er AKTIVT nøyaktig når verdien ikke er
 * `fallback`. Samme betingelse avgjør om det står i URL-en, om det får en brikke,
 * og om det telles på filterknappen.
 */

export type FilterOption = { value: string; label: string; count?: number };

export type FilterDef<Row> = {
  /** URL-parameter. Utelates fra URL-en når verdien er `fallback`. */
  key: string;
  label: string;
  options: FilterOption[];
  /** Nøytralverdien — «alle», «ingen grense». Vises aldri som brikke. */
  fallback: string;
  apply: (rows: Row[], value: string) => Row[];
  /** localStorage-nøkkel for valg som skal følge brukeren mellom økter. */
  sticky?: string;
  /** Forklaring på begrepet, vist i panelet. */
  explain?: React.ReactNode;
};

export type ActiveFilter = {
  key: string;
  label: string;
  valueLabel: string;
  clear: () => void;
};

const readStored = (key?: string): string | null => {
  if (!key) return null;
  try { return localStorage.getItem(key); } catch { return null; }
};

/**
 * Én delt skrivefunksjon for all URL-tilstand.
 *
 * Den funksjonelle formen av `setSearchParams` er ikke en detalj: tidligere lukket
 * både `threshold.ts` og `Recovery.tsx` hver sin `set` over `params`, så to filtre
 * satt i samme tick skrev over hverandre. Her leses forrige tilstand ved
 * anvendelse, ikke ved oppretting.
 */
export function useParam(
  key: string,
  fallback: string,
  sticky?: string
): [string, (next: string) => void] {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get(key);
  const stored = React.useMemo(() => readStored(sticky), [sticky]);
  const value = fromUrl ?? stored ?? fallback;

  const set = React.useCallback((next: string) => {
    if (sticky) { try { localStorage.setItem(sticky, next); } catch { /* privat modus */ } }
    setParams((prev) => {
      const out = new URLSearchParams(prev);
      // Standardverdien står aldri i URL-en — det holder delte lenker rene og
      // gjør «er dette filteret aktivt?» til ett og samme spørsmål overalt.
      if (next === fallback) out.delete(key); else out.set(key, next);
      return out;
    }, { replace: true });
  }, [key, fallback, sticky, setParams]);

  return [value, set];
}

export type FilterState<Row> = {
  /** Gjeldende verdi for ett filter. */
  value: (key: string) => string;
  set: (key: string, next: string) => void;
  /** Kjører alle filtrene i rekkefølge. */
  apply: (rows: Row[]) => Row[];
  /** Kun filtre som ikke står på `fallback` — brikker og teller. */
  active: ActiveFilter[];
  clearAll: () => void;
};

export function useFilters<Row>(defs: FilterDef<Row>[]): FilterState<Row> {
  const [params, setParams] = useSearchParams();

  const values = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const d of defs) out[d.key] = params.get(d.key) ?? readStored(d.sticky) ?? d.fallback;
    return out;
  }, [defs, params]);

  const write = React.useCallback((entries: { def: FilterDef<Row>; next: string }[]) => {
    for (const { def, next } of entries) {
      if (def.sticky) { try { localStorage.setItem(def.sticky, next); } catch { /* privat modus */ } }
    }
    setParams((prev) => {
      const out = new URLSearchParams(prev);
      for (const { def, next } of entries) {
        if (next === def.fallback) out.delete(def.key); else out.set(def.key, next);
      }
      return out;
    }, { replace: true });
  }, [setParams]);

  const set = React.useCallback((key: string, next: string) => {
    const def = defs.find((d) => d.key === key);
    if (def) write([{ def, next }]);
  }, [defs, write]);

  const apply = React.useCallback(
    (rows: Row[]) => defs.reduce((acc, d) => d.apply(acc, values[d.key]), rows),
    [defs, values]
  );

  const active = React.useMemo(
    () => defs
      .filter((d) => values[d.key] !== d.fallback)
      .map((d) => ({
        key: d.key,
        label: d.label,
        valueLabel: d.options.find((o) => o.value === values[d.key])?.label ?? values[d.key],
        clear: () => write([{ def: d, next: d.fallback }]),
      })),
    [defs, values, write]
  );

  const clearAll = React.useCallback(
    () => write(defs.map((d) => ({ def: d, next: d.fallback }))),
    [defs, write]
  );

  return { value: (k) => values[k], set, apply, active, clearAll };
}

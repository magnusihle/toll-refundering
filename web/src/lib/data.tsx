import * as React from 'react';

// One fetch, one context. Pages read the snapshot by name instead of receiving it
// through props — routes mount independently, so prop-drilling `data` would mean
// every route re-declaring the same plumbing.
type Ctx = { data: any; reload: () => void; lastLoaded: number };
const DataContext = React.createContext<Ctx>(null as any);

export function DataProvider({ data, reload, lastLoaded, children }: Ctx & { children: React.ReactNode }) {
  const value = React.useMemo(() => ({ data, reload, lastLoaded }), [data, reload, lastLoaded]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => React.useContext(DataContext).data;
export const useDataCtx = () => React.useContext(DataContext);

/**
 * Tollnummer → deklarasjon.
 *
 * Varelinjer og krav bærer bare tollnummeret. Uten dette oppslaget kunne bare
 * Deklarasjoner- og Leverandør-sidene tilby frist og lenke til kilde-SAD; nå kan
 * hver eneste utvidede rad avslutte med de samme to kolonnene.
 */
export function useEntryIndex(): Map<string, any> {
  const { data } = React.useContext(DataContext);
  return React.useMemo(() => {
    const m = new Map<string, any>();
    for (const d of data?.declarations ?? []) m.set(d.tollnummer, d);
    return m;
  }, [data]);
}

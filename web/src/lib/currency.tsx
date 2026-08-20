import * as React from 'react';
type Fx = { base: string; date: string | null; rates: Record<string, number>; live?: boolean; stale?: boolean; source?: string };
type Ctx = { cur: string; setCur: (c: string) => void; fx: Fx | null; convert: (nok: number | null | undefined) => number | null; currencies: string[] };
const CurrencyContext = React.createContext<Ctx>(null as any);
export function CurrencyProvider({ fx, children }: { fx: Fx | null; children: React.ReactNode }) {
  const [cur, setCur] = React.useState('NOK');
  const currencies = React.useMemo(() => ['NOK', ...Object.keys(fx?.rates || {}).filter((k) => k !== 'NOK').sort()], [fx]);
  const convert = React.useCallback((nok: number | null | undefined) => {
    if (nok == null) return null; const rate = cur === 'NOK' ? 1 : fx?.rates?.[cur]; if (!rate) return nok; return nok * rate;
  }, [cur, fx]);
  return <CurrencyContext.Provider value={{ cur, setCur, fx, convert, currencies }}>{children}</CurrencyContext.Provider>;
}
export const useCurrency = () => React.useContext(CurrencyContext);

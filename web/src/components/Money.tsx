import { useCurrency } from '@/lib/currency';
import { n } from '@/lib/format';
// Renders a NOK value in the currently selected display currency.
export function Money({ nok, className }: { nok: number | null | undefined; className?: string }) {
  const { cur, convert } = useCurrency();
  const v = convert(nok ?? null);
  if (v == null) return <span className={className}>—</span>;
  return <span className={className}>{n(v)} {cur}</span>;
}

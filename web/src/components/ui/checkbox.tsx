import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Native avkrysning, ikke Radix.
 *
 * `indeterminate` finnes bare som DOM-egenskap, aldri som attributt — Radix
 * modellerer den som en tredje «checked»-verdi og krever en egen indikator.
 * Native gir delvis-tilstand, tastatur og skjermleser gratis, og `accent-color`
 * tar merkevarefargen. Én kontroll er ikke verdt en avhengighet.
 */
export function Checkbox({ checked, indeterminate, onChange, label, className }: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (on: boolean) => void;
  label: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate && !checked);
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className={cn(
        'size-4 cursor-pointer accent-primary align-middle',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className
      )}
    />
  );
}

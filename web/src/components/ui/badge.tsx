import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Små markører, ikke fargede piller.
 *
 * DESIGN.md ber om «small markers» og advarer mot «excessive pills». Derfor:
 * nesten kvadratisk radius, hårfin kant, dempet flate. KUN statusvariantene får
 * en prikk foran teksten (::before) — statusfarger ligger tett i denne paletten,
 * så farge alene skal aldri bære betydningen. Nøytrale etiketter som «Preferanse»
 * er ikke status og står uten prikk, ellers blir en tabellkolonne full av støy.
 */
const badgeVariants = cva(
  'inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-xs border px-1.5 py-0.5 text-2xs font-medium leading-[1.35] transition-colors ' +
    'before:size-1.5 before:shrink-0 before:rounded-xxs before:bg-current before:content-[""]',
  {
    variants: {
      variant: {
        default: 'border-border bg-transparent text-foreground before:hidden',
        secondary: 'border-transparent bg-secondary text-secondary-foreground before:hidden',
        outline: 'border-border bg-transparent text-muted-foreground before:hidden',
        destructive: 'border-destructive/25 bg-destructive/[0.07] text-destructive',
        success: 'border-success/25 bg-success/[0.07] text-success',
        warning: 'border-warning/30 bg-warning/[0.09] text-warning',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };

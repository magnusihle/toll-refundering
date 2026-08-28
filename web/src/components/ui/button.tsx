import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Knappene fra landingssiden, i app-tetthet.
 *
 * DESIGN.md: 10–12px radius, forest fyll med on-dark tekst, sekundær med 1px
 * linjekant. Dybde er flatekontrast og kantlinjer — ingen skygger. Trykket gir
 * samme lille scale-nedtrekk som `.btn-primary` på siden.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ' +
    'transition-[background-color,color,border-color,transform] duration-200 ease-out-strong ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
    'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-[hsl(var(--sidebar))]',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-strong',
        outline: 'border border-border bg-card text-foreground hover:bg-surface-sunken',
        ghost: 'text-foreground hover:bg-surface-sunken',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      // Høydeskalaen: 8 / 9 / 11, og ingenting annet.
      //   sm      tett — inne i tabeller og strimler
      //   default standard — SAMME høyde som Input og SelectTrigger, så en
      //           verktøylinje aldri får tre ulike høyder ved siden av hverandre
      //   lg      sidens primærhandling, og eneste som er 44px (berøringsmål)
      size: {
        sm: 'h-8 rounded-md px-3',
        default: 'h-9 px-4',
        lg: 'h-11 px-5',
        icon: 'size-9 rounded-md',
        'icon-sm': 'size-8 rounded-md',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';
export { Button, buttonVariants };

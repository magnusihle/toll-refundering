import * as React from 'react';
import { cn } from '@/lib/utils';
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input type={type} ref={ref} className={cn('flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-base ' +
      // Samme form og samme bevegelse som knappene: radius lg, 200 ms med
      // ease-out-strong. Hover gir samme flatetrinn som en outline-knapp, men
      // vikes for fokus — et felt du skriver i skal ikke ligge nedsenket.
      'transition-[background-color,color,border-color] duration-200 ease-out-strong ' +
      'hover:bg-surface-sunken focus:bg-card ' +
      'placeholder:text-muted-foreground ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
      'disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />));
Input.displayName = 'Input';
export { Input };

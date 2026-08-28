import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Papirflaten. Etter omleggingen bruker IKKE seksjoner denne — de er åpne.
 * Card er nå forbeholdt flater som faktisk svever: menyer, popovers, dialoger,
 * og de få stedene noe skal løftes bevisst ut av siden.
 *
 * DESIGN.md: dybde er flatekontrast og 1px kant. Skygge kun i taket
 * `0 16px 44px rgba(23,35,29,0.08)`, aldri som standard.
 */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('rounded-xl border border-border bg-card text-card-foreground', className)} {...props} />));
Card.displayName = 'Card';
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 p-5', className)} {...props} />));
CardHeader.displayName = 'CardHeader';
const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('t-section', className)} {...props} />));
CardTitle.displayName = 'CardTitle';
const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('t-small text-muted-foreground', className)} {...props} />));
CardDescription.displayName = 'CardDescription';
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />));
CardContent.displayName = 'CardContent';
const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-5 pt-0', className)} {...props} />));
CardFooter.displayName = 'CardFooter';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-xl border px-4 py-3.5 text-base [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-4 [&>svg~*]:pl-7',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground [&>svg]:text-muted-foreground',
        info: 'border-primary/25 bg-primary/[0.06] text-foreground [&>svg]:text-primary',
        warning: 'border-warning/30 bg-warning/[0.09] text-foreground [&>svg]:text-warning',
        destructive: 'border-destructive/25 bg-destructive/[0.07] text-foreground [&>svg]:text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>>(
  ({ className, variant, ...props }, ref) => <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
);
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => <h5 ref={ref} className={cn('mb-1 text-base font-medium leading-none tracking-[-0.01em]', className)} {...props} />
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('text-sm text-muted-foreground [&_p]:leading-relaxed', className)} {...props} />
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };

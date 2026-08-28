import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/lib/theme';

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Følger appens eget tema, ikke bare OS-innstillingen — ellers blir toasten lys
// mens resten av appen er mørk når brukeren har overstyrt temaet.
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      className="toaster group"
      toastOptions={{ classNames: {
        toast: 'group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-overlay',
        description: 'group-[.toast]:text-muted-foreground',
      } }}
      {...props}
    />
  );
};
export { Toaster };

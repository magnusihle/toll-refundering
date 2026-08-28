import * as React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Header } from '@/components/layout/Header';

export function Layout() {
  const { pathname } = useLocation();
  const main = React.useRef<HTMLDivElement>(null);

  // A route change must land the reader at the top of the new page — otherwise
  // deep-linking from a dashboard card drops them mid-table.
  React.useEffect(() => { main.current?.scrollTo({ top: 0 }); window.scrollTo({ top: 0 }); }, [pathname]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <div ref={main} className="flex-1">
          {/* Lesespalten er begrenset per tekstblokk (max-ch), ikke av containeren
              — datatabellene her er bredere enn en lesespalte, og innhold som
              faller utenfor kanten er verre enn en bred flate. */}
          <div key={pathname} className="mx-auto w-full max-w-[1680px] animate-fade-in-up space-y-10 px-6 pb-20 pt-7 md:space-y-12 md:px-10 lg:px-16">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

import * as React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarInset, SidebarProvider, SidebarScroll } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Header } from '@/components/layout/Header';
import { navItemFor } from '@/lib/nav';
import { SnapshotNotice } from '@/components/SnapshotNotice';

export function Layout() {
  const { pathname } = useLocation();
  const main = React.useRef<HTMLDivElement>(null);

  // A route change must land the reader at the top of the new page — otherwise
  // deep-linking from a dashboard card drops them mid-table.
  React.useEffect(() => { main.current?.scrollTo({ top: 0 }); }, [pathname]);

  // «Refusjon – Declaro», the same title template declaro.no uses. The tab is
  // part of the brand: a browser full of tabs all reading «Declaro» is no more
  // useful than one reading an internal codename, which is what stood here.
  React.useEffect(() => {
    const page = navItemFor(pathname).label;
    document.title = `${page} – Declaro`;
  }, [pathname]);

  return (
    // Rammen rundt kortet er sidebarens egen flate — ingen ny farge, kortet er
    // det som skiller navigasjonen fra innholdet.
    <SidebarProvider className="h-svh overflow-hidden bg-sidebar">
      <AppSidebar />
      <SidebarInset>
        <Header />
        <SidebarScroll ref={main}>
          {/* Lesespalten er begrenset per tekstblokk (max-ch), ikke av containeren
              — datatabellene her er bredere enn en lesespalte, og innhold som
              faller utenfor kanten er verre enn en bred flate. */}
          <div key={pathname} className="mx-auto w-full max-w-[1680px] animate-fade-in-up space-y-10 px-6 pb-20 pt-7 md:space-y-12 md:px-10 lg:px-16">
            <SnapshotNotice />
            <Outlet />
          </div>
        </SidebarScroll>
      </SidebarInset>
    </SidebarProvider>
  );
}

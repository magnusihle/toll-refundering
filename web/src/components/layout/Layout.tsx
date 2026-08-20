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
          <div key={pathname} className="mx-auto w-full max-w-[1500px] animate-fade-in-up space-y-5 p-4 md:p-6">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

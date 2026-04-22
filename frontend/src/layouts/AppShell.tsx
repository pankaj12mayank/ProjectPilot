import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { PageTransition } from "@/components/layout/PageTransition";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pp_sidebar_collapsed";

export function AppShell() {
  const [mobileNav, setMobileNav] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-background transition-colors duration-300 ease-out">
      <button
        type="button"
        className={cn(
          "fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px] transition-opacity md:hidden",
          mobileNav ? "opacity-100 pointer-events-auto" : "pointer-events-none opacity-0",
        )}
        aria-label="Close menu"
        onClick={() => setMobileNav(false)}
      />
      <AppSidebar
        mobileOpen={mobileNav}
        collapsed={collapsed}
        onCollapseChange={setCollapsed}
        onNavigate={() => setMobileNav(false)}
      />
      <div className={cn("flex min-h-screen flex-col transition-[padding] duration-300 ease-out", collapsed ? "md:pl-[4.5rem]" : "md:pl-60")}>
        <AppHeader onMenu={() => setMobileNav(true)} />
        <main className="flex-1 px-4 pb-10 pt-2 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1600px]">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useBranding } from "../../branding/BrandingProvider";
import { useTheme } from "../../theme";
import { headerContent } from "../content/header";

export function LandingHeader() {
  const { branding } = useBranding();
  const { resolved, toggle } = useTheme();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const product = (branding?.meta_title || "ProjectPilot").trim() || "ProjectPilot";
  const logoUrl = resolved === "dark"
    ? (branding?.asset_urls?.logo_dark as string | undefined)
    : (branding?.asset_urls?.logo as string | undefined);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 no-underline">
          {logoUrl ? (
            <img src={logoUrl} alt={product} className="h-8 w-auto" />
          ) : (
            <span className="font-hero text-xl font-bold tracking-tight text-foreground">
              {product}
            </span>
          )}
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {headerContent.nav.map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`text-sm font-medium transition-colors no-underline hover:text-foreground ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
          >
            {resolved === "dark" ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>

          <Link
            to={headerContent.login.href}
            className="hidden text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground sm:inline-block"
          >
            {headerContent.login.label}
          </Link>
          <Link
            to={headerContent.cta.href}
            className="pp-btn pp-btn--primary inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium no-underline"
          >
            {headerContent.cta.label}
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-border/40 px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-2">
            {headerContent.nav.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors ${
                    isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              to={headerContent.login.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-foreground"
            >
              {headerContent.login.label}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

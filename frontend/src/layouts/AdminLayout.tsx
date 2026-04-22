import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AdminSidebar } from "../components/AdminSidebar";
import { TopNavbar } from "../components/TopNavbar";

const titles: Record<string, string> = {
  "/admin": "Admin dashboard",
  "/admin/branding": "Branding settings",
  "/admin/users": "Users & roles",
  "/admin/audit": "Audit logs",
  "/admin/system": "System settings",
};

function resolveTitle(pathname: string): string {
  if (titles[pathname]) return titles[pathname]!;
  return "Administration";
}

export function AdminLayout() {
  const { pathname } = useLocation();
  const title = resolveTitle(pathname);
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className={`pp-shell pp-shell--admin${navOpen ? " pp-shell--nav-open" : ""}`}>
      <button
        type="button"
        className="pp-nav-backdrop"
        aria-label="Close navigation"
        onClick={() => setNavOpen(false)}
      />
      <AdminSidebar onNavigate={() => setNavOpen(false)} />
      <div className="pp-shell__main">
        <TopNavbar title={title} onMenuPress={() => setNavOpen((o) => !o)} />
        <div className="pp-shell__content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

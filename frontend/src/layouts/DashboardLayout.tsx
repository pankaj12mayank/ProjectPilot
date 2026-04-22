import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { TopNavbar } from "../components/TopNavbar";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/projects": "Projects",
  "/dashboard/projects/new": "Create project",
  "/dashboard/metrics": "Metrics dashboard",
  "/dashboard/governance": "Governance report",
  "/dashboard/profile": "Profile",
  "/dashboard/settings": "Settings",
  "/dashboard/users": "User management",
};

function resolveTitle(pathname: string): string {
  if (titles[pathname]) return titles[pathname]!;
  if (/\/dashboard\/projects\/[^/]+\/upload$/.test(pathname)) return "Upload files";
  if (/\/dashboard\/projects\/[^/]+\/health$/.test(pathname)) return "Project health";
  if (/\/dashboard\/projects\/[^/]+$/.test(pathname)) return "Project details";
  return "ProjectPilot";
}

export function DashboardLayout() {
  const { pathname } = useLocation();
  const title = resolveTitle(pathname);
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className={`pp-shell${navOpen ? " pp-shell--nav-open" : ""}`}>
      <button
        type="button"
        className="pp-nav-backdrop"
        aria-label="Close navigation"
        onClick={() => setNavOpen(false)}
      />
      <Sidebar onNavigate={() => setNavOpen(false)} />
      <div className="pp-shell__main">
        <TopNavbar title={title} onMenuPress={() => setNavOpen((o) => !o)} />
        <div className="pp-shell__content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

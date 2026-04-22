import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { isPlatformAdmin } from "../auth/roleUtils";
import { useBranding } from "../branding/BrandingProvider";
import { useTheme } from "../theme";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `pp-sidebar__link${isActive ? " pp-sidebar__link--active" : ""}`;

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { branding } = useBranding();
  const { resolved } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const product = (branding?.product_name || "ProjectPilot").trim() || "ProjectPilot";
  const logoLight = branding?.asset_urls?.sidebar_logo as string | undefined;
  const logoDark = (branding?.asset_urls?.sidebar_logo_dark as string | undefined) || logoLight;
  const sidebarLogo = resolved === "dark" ? logoDark : logoLight;

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
    onNavigate?.();
  }

  return (
    <aside className="pp-sidebar">
      <div className="pp-sidebar__brand">
        {sidebarLogo ? (
          <img src={sidebarLogo} alt="" className="pp-sidebar__brand-img" />
        ) : (
          product
        )}
      </div>
      <nav className="pp-sidebar__nav">
        <NavLink to="/dashboard" end className={linkClass} onClick={() => onNavigate?.()}>
          Dashboard
        </NavLink>
        <NavLink to="/dashboard/metrics" className={linkClass} onClick={() => onNavigate?.()}>
          Metrics
        </NavLink>
        <NavLink to="/dashboard/projects" className={linkClass} onClick={() => onNavigate?.()}>
          Projects
        </NavLink>
        <NavLink to="/dashboard/portfolio" className={linkClass} onClick={() => onNavigate?.()}>
          Portfolio
        </NavLink>
        <NavLink to="/dashboard/logs" className={linkClass} onClick={() => onNavigate?.()}>
          Logs
        </NavLink>
        <NavLink to="/dashboard/governance" className={linkClass} onClick={() => onNavigate?.()}>
          Governance report
        </NavLink>
        <NavLink to="/dashboard/profile" className={linkClass} onClick={() => onNavigate?.()}>
          Profile
        </NavLink>
        <NavLink to="/dashboard/settings" className={linkClass} onClick={() => onNavigate?.()}>
          Settings
        </NavLink>
        {user && isPlatformAdmin(user.role) ? (
          <NavLink to="/admin" className={linkClass} onClick={() => onNavigate?.()}>
            Administration
          </NavLink>
        ) : null}
      </nav>
      <div className="pp-sidebar__footer">
        <button type="button" className="pp-sidebar__logout" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </aside>
  );
}

import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `pp-sidebar__link${isActive ? " pp-sidebar__link--active" : ""}`;

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
    onNavigate?.();
  }

  return (
    <aside className="pp-sidebar">
      <div className="pp-sidebar__brand">ProjectPilot</div>
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
        <NavLink to="/dashboard/governance" className={linkClass} onClick={() => onNavigate?.()}>
          Governance report
        </NavLink>
        <NavLink to="/dashboard/profile" className={linkClass} onClick={() => onNavigate?.()}>
          Profile
        </NavLink>
        <NavLink to="/dashboard/settings" className={linkClass} onClick={() => onNavigate?.()}>
          Settings
        </NavLink>
        {user?.role === "admin" ? (
          <NavLink to="/dashboard/users" className={linkClass} onClick={() => onNavigate?.()}>
            User management
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

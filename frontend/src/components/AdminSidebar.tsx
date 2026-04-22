import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `pp-sidebar__link${isActive ? " pp-sidebar__link--active" : ""}`;

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
    onNavigate?.();
  }

  return (
    <aside className="pp-sidebar pp-sidebar--admin">
      <div className="pp-sidebar__brand">Administration</div>
      <nav className="pp-sidebar__nav">
        <NavLink to="/admin" end className={linkClass} onClick={() => onNavigate?.()}>
          Admin dashboard
        </NavLink>
        <NavLink to="/admin/branding" className={linkClass} onClick={() => onNavigate?.()}>
          Branding
        </NavLink>
        <NavLink to="/admin/users" className={linkClass} onClick={() => onNavigate?.()}>
          Users &amp; roles
        </NavLink>
        <NavLink to="/admin/audit" className={linkClass} onClick={() => onNavigate?.()}>
          Audit logs
        </NavLink>
        <NavLink to="/admin/system" className={linkClass} onClick={() => onNavigate?.()}>
          System settings
        </NavLink>
        <NavLink to="/dashboard" className={linkClass} onClick={() => onNavigate?.()}>
          User app
        </NavLink>
      </nav>
      <div className="pp-sidebar__footer">
        <p className="pp-sidebar__user pp-sidebar__muted">
          {user?.full_name}
          <br />
          <span className="pp-sidebar__muted">{user?.role}</span>
        </p>
        <button type="button" className="pp-sidebar__logout" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </aside>
  );
}

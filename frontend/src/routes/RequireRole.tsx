import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "../auth/types";

export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <div className="pp-loading">
        <div className="pp-spinner" aria-hidden />
        <span>Loading…</span>
      </div>
    );
  }
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

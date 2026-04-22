import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, parseJson } from "../api/client";
import { Card } from "../components/ui/Card";

type Stats = {
  total_users: number;
  total_projects: number;
  active_projects: number;
  reports_generated: number;
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch("/admin/stats");
      if (!res.ok) {
        const d = await parseJson<{ detail?: string }>(res);
        throw new Error(typeof d.detail === "string" ? d.detail : "Failed to load stats");
      }
      setStats(await parseJson<Stats>(res));
    } catch (e) {
      setStats(null);
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="pp-grid pp-grid--2">
      <Card title="Overview">
        {error ? (
          <p className="pp-field__error" role="alert">
            {error}
          </p>
        ) : null}
        {!stats && !error ? <p className="pp-muted">Loading…</p> : null}
        {stats ? (
          <ul className="pp-admin-stats">
            <li>
              <strong>{stats.total_users}</strong> users
            </li>
            <li>
              <strong>{stats.total_projects}</strong> projects
            </li>
            <li>
              <strong>{stats.active_projects}</strong> active projects
            </li>
            <li>
              <strong>{stats.reports_generated}</strong> reports generated
            </li>
          </ul>
        ) : null}
      </Card>
      <Card title="Admin modules">
        <ul className="pp-shortcuts">
          <li>
            <Link to="/admin/branding">Branding settings</Link>
          </li>
          <li>
            <Link to="/admin/users">Role management &amp; users</Link>
          </li>
          <li>
            <Link to="/admin/audit">Audit logs</Link>
          </li>
          <li>
            <Link to="/admin/system">System settings</Link>
          </li>
          <li>
            <Link to="/dashboard">Open user dashboard</Link>
          </li>
        </ul>
      </Card>
    </div>
  );
}

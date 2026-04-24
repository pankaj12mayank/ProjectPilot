import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, readJsonOk } from "../api/client";
import { ROLE_LABELS, type UserRole } from "../auth/types";
import { Card } from "../components/ui/Card";

type RagDistribution = Record<string, number>;

type ActivityRow = {
  created_at: string;
  kind: string;
  summary: string;
  actor_email: string | null;
};

type RiskyProject = {
  project_id: string;
  name: string;
  risk_score: number;
  rag: string | null;
};

type RiskSummary = {
  projects_with_metrics: number;
  average_risk_score: number | null;
  by_rag_latest_metrics: Record<string, number>;
  top_risky_projects: RiskyProject[];
};

type Stats = {
  total_users: number;
  total_projects: number;
  active_projects: number;
  inactive_projects: number;
  reports_generated: number;
  users_active: number;
  users_inactive: number;
  platform_admins_active: number;
  project_files_total: number;
  projects_with_report_runs: number;
  report_runs_last_7_days: number;
  latest_report_at: string | null;
  audit_events_last_7_days: number;
  governance_runs_total: number;
  role_breakdown: Record<string, number>;
  rag_distribution: RagDistribution;
  recent_activity: ActivityRow[];
  risk_summary: RiskSummary;
};

function roleLabel(slug: string): string {
  if (slug in ROLE_LABELS) return ROLE_LABELS[slug as UserRole];
  return slug;
}

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch("/admin/stats");
      const data = await readJsonOk<Stats>(res);
      setStats(data);
    } catch (e) {
      setStats(null);
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ragRunEntries = stats?.rag_distribution ? Object.entries(stats.rag_distribution) : [];
  const roleEntries = useMemo(() => {
    if (!stats?.role_breakdown) return [];
    return Object.entries(stats.role_breakdown).sort((a, b) => b[1] - a[1]);
  }, [stats?.role_breakdown]);

  const metricsRagEntries = stats?.risk_summary?.by_rag_latest_metrics
    ? Object.entries(stats.risk_summary.by_rag_latest_metrics)
    : [];

  return (
    <div className="pp-grid pp-grid--2">
      <Card title="Summary">
        {error ? (
          <p className="pp-field__error" role="alert">
            {error}
          </p>
        ) : null}
        {!stats && !error ? <p className="pp-muted">Loading…</p> : null}
        {stats ? (
          <>
            <ul className="pp-admin-stats">
              <li>
                <strong>{stats.total_users}</strong> total users
              </li>
              <li>
                <strong>{stats.total_projects}</strong> total projects
              </li>
              <li>
                <strong>{stats.active_projects}</strong> active projects — <strong>{stats.inactive_projects}</strong>{" "}
                archived (inactive)
              </li>
              <li>
                <strong>{stats.users_active}</strong> users can sign in — <strong>{stats.users_inactive}</strong>{" "}
                disabled accounts
              </li>
              <li>
                <strong>{stats.platform_admins_active}</strong> active platform admins (system owner + admin)
              </li>
            </ul>
            <p className="pp-muted" style={{ margin: "0.85rem 0 0.35rem", fontSize: "0.85rem" }}>
              Accounts by role
            </p>
            <ul className="pp-admin-stats">
              {roleEntries.length > 0 ? (
                roleEntries.map(([role, n]) => (
                  <li key={role}>
                    <strong>{n}</strong> — {roleLabel(role)}
                  </li>
                ))
              ) : (
                <li>
                  <span className="pp-muted">No user accounts in the database yet.</span>
                </li>
              )}
            </ul>
            <p className="pp-muted" style={{ margin: "0.85rem 0 0.35rem", fontSize: "0.85rem" }}>
              Report pipeline (generated runs)
            </p>
            <ul className="pp-admin-stats">
              <li>
                <strong>{stats.reports_generated}</strong> report runs (all time) —{" "}
                <strong>{stats.report_runs_last_7_days}</strong> in the last 7 days
              </li>
              <li>
                Last report run: <strong>{fmtWhen(stats.latest_report_at)}</strong>
              </li>
              {ragRunEntries.length > 0 ? (
                ragRunEntries.map(([k, v]) => (
                  <li key={k}>
                    <strong>{v}</strong> runs — RAG <strong>{k}</strong>
                  </li>
                ))
              ) : (
                <li>
                  <span className="pp-muted">No report runs yet — RAG counts will appear after the first package.</span>
                </li>
              )}
            </ul>
            <p className="pp-muted" style={{ margin: "0.85rem 0 0.35rem", fontSize: "0.85rem" }}>
              Compliance
            </p>
            <ul className="pp-admin-stats">
              <li>
                <strong>{stats.audit_events_last_7_days}</strong> audit events (last 7 days) —{" "}
                <strong>{stats.governance_runs_total}</strong> governance reports (all time)
              </li>
            </ul>
          </>
        ) : null}
      </Card>

      <Card title="Risk summary">
        {!stats ? <p className="pp-muted">Loading…</p> : null}
        {stats ? (
          <ul className="pp-admin-stats">
            <li>
              <strong>{stats.risk_summary.projects_with_metrics}</strong> projects with latest metrics snapshot
            </li>
            <li>
              Portfolio average risk score:{" "}
              <strong>
                {stats.risk_summary.average_risk_score != null ? stats.risk_summary.average_risk_score : "—"}
              </strong>
              {stats.risk_summary.average_risk_score == null ? (
                <span className="pp-muted"> (capture health or run a report to populate metrics)</span>
              ) : null}
            </li>
            <li className="pp-muted" style={{ fontSize: "0.95rem", marginTop: "0.35rem" }}>
              Highest-risk projects (latest snapshot)
            </li>
            {stats.risk_summary.top_risky_projects.length > 0 ? (
              stats.risk_summary.top_risky_projects.map((p) => (
                <li key={p.project_id}>
                  <strong>{p.risk_score}</strong> —{" "}
                  <Link to={`/dashboard/projects/${p.project_id}/health`}>{p.name}</Link>
                  {p.rag != null && p.rag !== "" ? (
                    <span className="pp-muted">
                      {" "}
                      (RAG {p.rag})
                    </span>
                  ) : null}
                </li>
              ))
            ) : (
              <li>
                <span className="pp-muted">No ranked projects yet — same scope as your portfolio overview.</span>
              </li>
            )}
            <li className="pp-muted" style={{ fontSize: "0.95rem", marginTop: "0.35rem" }}>
              RAG from latest metrics (per project)
            </li>
            {metricsRagEntries.length > 0 ? (
              metricsRagEntries.map(([k, v]) => (
                <li key={`m-${k}`}>
                  <strong>{v}</strong> — {k}
                </li>
              ))
            ) : (
              <li>
                <span className="pp-muted">No snapshot-based RAG mix yet.</span>
              </li>
            )}
          </ul>
        ) : null}
      </Card>

      <Card title="Recent activity">
        {!stats ? <p className="pp-muted">Loading…</p> : null}
        {stats ? (
          <ul className="pp-admin-activity">
            {stats.recent_activity.length > 0 ? (
              stats.recent_activity.map((a, i) => (
                <li key={`${a.created_at}-${i}`}>
                  <span className="pp-muted">{new Date(a.created_at).toLocaleString()}</span> —{" "}
                  <code>{a.kind}</code> — {a.summary}
                  {a.actor_email ? <span className="pp-muted"> ({a.actor_email})</span> : null}
                </li>
              ))
            ) : (
              <li>
                <span className="pp-muted">No product activity logged yet.</span>
              </li>
            )}
          </ul>
        ) : null}
        {stats ? (
          <p className="pp-muted" style={{ marginTop: "0.85rem", fontSize: "0.9rem" }}>
            <Link to="/dashboard/logs?tab=activity">Open full activity log</Link>
            {" · "}
            <Link to="/dashboard/logs?tab=audit">Audit tab</Link>
          </p>
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
            <Link to="/dashboard/portfolio">Portfolio overview</Link>
          </li>
          <li>
            <Link to="/dashboard/governance">Governance report</Link>
          </li>
          <li>
            <Link to="/dashboard">Open user dashboard</Link>
          </li>
        </ul>
      </Card>
    </div>
  );
}

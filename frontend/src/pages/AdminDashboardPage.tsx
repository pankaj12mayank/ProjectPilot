import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, readJsonOk } from "../api/client";
import { fetchAdminActivityLogsPaged, type ActivityLogRow } from "../api/logs";
import { ROLE_LABELS, type UserRole } from "../auth/types";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent } from "@/components/shadcn/card";

type RagDistribution = Record<string, number>;

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
  report_runs_last_7_days: number;
  latest_report_at: string | null;
  audit_events_last_7_days: number;
  governance_runs_total: number;
  role_breakdown: Record<string, number>;
  rag_distribution: RagDistribution;
  risk_summary: RiskSummary;
  /** ISO timestamp when this payload was computed (server clock, UTC). */
  stats_computed_at?: string;
  /** Rolling window length for audit_events_last_7_days. */
  audit_events_window_days?: number;
};

const ACT_PAGE = 8;
const STATS_POLL_MS = 45_000;

function roleLabel(slug: string): string {
  if (slug in ROLE_LABELS) return ROLE_LABELS[slug as UserRole];
  return slug;
}

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function StatCard({
  label,
  value,
  hint,
  detail,
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** Extra explainer (e.g. audit trail). */
  detail?: string;
}) {
  return (
    <Card className="h-full w-full min-w-0 border-border/70 bg-gradient-to-br from-card to-card/80 shadow-card">
      <CardContent className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-display mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        {detail ? <p className="mt-2 border-t border-border/50 pt-2 text-[11px] leading-relaxed text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [actRows, setActRows] = useState<ActivityLogRow[]>([]);
  const [actTotal, setActTotal] = useState(0);
  const [actOff, setActOff] = useState(0);
  const [actLoading, setActLoading] = useState(false);

  const load = useCallback(async () => {
    setStatsLoading(true);
    setError(null);
    try {
      const bust = Date.now();
      const res = await apiFetch(`/admin/stats?_=${bust}`);
      const data = await readJsonOk<Stats>(res);
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    setActLoading(true);
    try {
      const r = await fetchAdminActivityLogsPaged({
        limit: ACT_PAGE,
        offset: actOff,
        _: Date.now(),
      });
      setActRows(r.items);
      setActTotal(r.total);
    } catch {
      setActRows([]);
      setActTotal(0);
    } finally {
      setActLoading(false);
    }
  }, [actOff]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void load();
      void loadActivity();
    }, STATS_POLL_MS);
    return () => window.clearInterval(id);
  }, [load, loadActivity]);

  async function handleRefreshAll() {
    await load();
    await loadActivity();
  }

  const roleEntries = stats?.role_breakdown ? Object.entries(stats.role_breakdown).sort((a, b) => b[1] - a[1]) : [];

  const auditDays = stats?.audit_events_window_days ?? 7;
  const auditDetail = stats
    ? `Rows in the security audit log (${auditDays}-day rolling window, UTC) — logins, permission changes, branding updates, etc. Same source as Admin → Audit log. This number updates whenever you press Refresh or every ${Math.round(STATS_POLL_MS / 1000)}s.`
    : undefined;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Control center</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Live counts and shortcuts — same workspace shell as the rest of the app. Figures poll in the background; use
            refresh for an immediate pull.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 rounded-md"
          disabled={statsLoading}
          onClick={() => void handleRefreshAll()}
        >
          {statsLoading ? "Refreshing…" : "Refresh data"}
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!stats && !error ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      {stats?.stats_computed_at ? (
        <p className="text-xs text-muted-foreground">Server snapshot time: {fmtWhen(stats.stats_computed_at)} (UTC)</p>
      ) : null}

      {stats ? (
        <>
          <section aria-label="Key metrics">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overview</h2>
            <div className="grid w-full grid-cols-2 justify-items-stretch gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Users" value={stats.total_users} hint={`${stats.users_active} active`} />
              <StatCard label="Projects" value={stats.total_projects} hint={`${stats.active_projects} active`} />
              <StatCard label="Reports" value={stats.reports_generated} hint={`${stats.report_runs_last_7_days} / 7d`} />
              <StatCard label="Audit (7d)" value={stats.audit_events_last_7_days} hint="Security audit log" detail={auditDetail} />
              <StatCard label="Governance" value={stats.governance_runs_total} hint="all time" />
              <StatCard label="Admins" value={stats.platform_admins_active} hint="active" />
            </div>
          </section>

          <section aria-label="Roles">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accounts by role</h2>
            <div className="flex w-full flex-wrap justify-center gap-2 sm:justify-start">
              {roleEntries.length ? (
                roleEntries.map(([role, n]) => (
                  <span
                    key={role}
                    className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-3 py-1 text-sm backdrop-blur-sm"
                  >
                    <span className="font-semibold text-foreground">{n}</span>
                    <span className="text-muted-foreground">{roleLabel(role)}</span>
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No accounts yet.</span>
              )}
            </div>
          </section>

          <section aria-label="Risk">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portfolio risk</h2>
            <div className="grid w-full grid-cols-1 justify-items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <StatCard
                label="With metrics"
                value={stats.risk_summary.projects_with_metrics}
                hint="latest snapshot"
              />
              <StatCard
                label="Avg risk"
                value={stats.risk_summary.average_risk_score ?? "—"}
                hint="score"
              />
              {stats.risk_summary.top_risky_projects.slice(0, 5).map((p) => (
                <Card key={p.project_id} className="h-full w-full min-w-0 border-border/70 shadow-card">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Hot project</p>
                    <Link className="mt-1 block truncate font-medium text-primary hover:underline" to={`/dashboard/projects/${p.project_id}/health`}>
                      {p.name}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Risk <strong className="text-foreground">{p.risk_score}</strong>
                      {p.rag ? ` · ${p.rag}` : ""}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section aria-label="Recent activity">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent activity</h2>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-md"
                  disabled={actOff === 0 || actLoading}
                  onClick={() => setActOff((o) => Math.max(0, o - ACT_PAGE))}
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-md"
                  disabled={actOff + ACT_PAGE >= actTotal || actLoading}
                  onClick={() => setActOff((o) => o + ACT_PAGE)}
                >
                  Next
                </Button>
              </div>
            </div>
            <Card className="border-border/80">
              <CardContent className="p-0">
                {actLoading ? <p className="p-4 text-sm text-muted-foreground">Loading…</p> : null}
                {!actLoading && actRows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No rows.</p> : null}
                {!actLoading && actRows.length > 0 ? (
                  <ul className="divide-y divide-border/60">
                    {actRows.map((a) => (
                      <li key={a.id} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-sm">
                        <span className="text-xs text-muted-foreground">{fmtWhen(a.created_at)}</span>
                        <code className="text-xs text-foreground/90">{a.kind}</code>
                        <span className="min-w-0 flex-1">{a.summary}</span>
                        <span className="font-mono text-xs text-muted-foreground">{a.actor_user_id}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
                  {actTotal ? `Showing ${actOff + 1}–${actOff + actRows.length} of ${actTotal}` : null}
                  {" · "}
                  <Link to="/dashboard/admin/activity" className="font-medium text-primary hover:underline">
                    Full explorer
                  </Link>
                </p>
              </CardContent>
            </Card>
          </section>

          <section aria-label="Shortcuts">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shortcuts</h2>
            <div className="flex w-full flex-wrap justify-center gap-2 sm:justify-start">
              <Button asChild variant="outline" className="rounded-md">
                <Link to="/dashboard/admin/branding">Branding</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-md">
                <Link to="/dashboard/admin/email">Email / SMTP</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-md">
                <Link to="/dashboard/admin/users">Users</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-md">
                <Link to="/dashboard/admin/audit">Audit</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-md">
                <Link to="/dashboard/admin/system">System</Link>
              </Button>
              <Button asChild className="rounded-md">
                <Link to="/dashboard/portfolio">Portfolio</Link>
              </Button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

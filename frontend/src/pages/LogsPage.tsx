import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchActivityLogsPaged,
  fetchAuditLogsPaged,
  fetchNotificationLogsPaged,
  type ActivityLogRow,
  type AuditLogRow,
  type NotificationLogRow,
} from "../api/logs";
import { fetchPortfolioReportHistory, type PortfolioReportHistoryRow } from "../api/portfolio";
import { useAuth } from "../auth/AuthContext";
import { isPlatformAdmin } from "../auth/roleUtils";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";

type Tab = "audit" | "activity" | "notifications" | "reports";

const PAGE = 50;

function fmtIso(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function validTab(s: string | null): Tab {
  if (s === "audit" || s === "activity" || s === "notifications" || s === "reports") return s;
  return "activity";
}

export default function LogsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = validTab(searchParams.get("tab"));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditLogRow[]>([]);
  const [activity, setActivity] = useState<ActivityLogRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationLogRow[]>([]);
  const [reports, setReports] = useState<PortfolioReportHistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [projectId, setProjectId] = useState("");
  const [kind, setKind] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const isAdmin = isPlatformAdmin(user?.role);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setOffset(0);
  }, [tab, qDebounced, projectId, kind, action, entityType, dateFrom, dateTo]);

  const setTab = useCallback(
    (next: Tab) => {
      const sp = new URLSearchParams(searchParams);
      sp.set("tab", next);
      setSearchParams(sp, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "audit") {
        if (!isAdmin) {
          setAudit([]);
          setTotal(0);
          setError("Audit log is restricted to administrators.");
          return;
        }
        const r = await fetchAuditLogsPaged({
          q: qDebounced || undefined,
          action: action || undefined,
          entity_type: entityType || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          limit: PAGE,
          offset,
        });
        setAudit(r.items);
        setTotal(r.total);
      } else if (tab === "activity") {
        const r = await fetchActivityLogsPaged({
          q: qDebounced || undefined,
          project_id: projectId || undefined,
          kind: kind || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          limit: PAGE,
          offset,
        });
        setActivity(r.items);
        setTotal(r.total);
      } else if (tab === "notifications") {
        const r = await fetchNotificationLogsPaged({
          q: qDebounced || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          limit: PAGE,
          offset,
        });
        setNotifications(r.items);
        setTotal(r.total);
      } else {
        const r = await fetchPortfolioReportHistory(100, projectId || undefined);
        setReports(r);
        setTotal(r.length);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [tab, isAdmin, qDebounced, projectId, kind, action, entityType, dateFrom, dateTo, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageInfo =
    tab === "reports" ? (
      <span className="pp-muted">{reports.length} rows</span>
    ) : (
      <span className="pp-muted">
        Showing {offset + 1}–{offset + (tab === "audit" ? audit.length : tab === "activity" ? activity.length : notifications.length)} of {total}
      </span>
    );

  return (
    <div className="pp-grid pp-grid--1">
      <Card title="Logs & history">
        <p className="pp-muted">Search and filter server-side. Audit is admin-only. All activity rows include linked project_id when applicable.</p>
        <div className="pp-log-tabs" role="tablist" style={{ marginTop: "1rem" }}>
          {(
            [
              ["activity", "Activity"],
              ["notifications", "Notifications"],
              ["reports", "Report history"],
              ["audit", "Audit (admin)"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`pp-log-tab${tab === id ? " pp-log-tab--active" : ""}`}
              onClick={() => setTab(id as Tab)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "reports" ? (
          <div className="pp-log-filters">
            <div>
              <label className="pp-muted">Project ID</label>
              <input
                className="pp-input"
                placeholder="Optional UUID filter"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="pp-log-filters">
            <div>
              <label className="pp-muted">Search</label>
              <input className="pp-input" placeholder="Text search…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {tab === "activity" ? (
              <>
                <div>
                  <label className="pp-muted">Project ID</label>
                  <input
                    className="pp-input"
                    placeholder="Filter by project"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="pp-muted">Kind</label>
                  <input
                    className="pp-input"
                    placeholder="e.g. report.generate"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  />
                </div>
              </>
            ) : null}
            {tab === "audit" ? (
              <>
                <div>
                  <label className="pp-muted">Action</label>
                  <input className="pp-input" value={action} onChange={(e) => setAction(e.target.value)} />
                </div>
                <div>
                  <label className="pp-muted">Entity type</label>
                  <input className="pp-input" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
                </div>
              </>
            ) : null}
            <div>
              <label className="pp-muted">From</label>
              <input className="pp-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="pp-muted">To</label>
              <input className="pp-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        )}
        <div className="pp-row-actions" style={{ marginTop: "0.75rem", alignItems: "center" }}>
          <Button type="button" variant="secondary" className="pp-btn--sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Apply / reload"}
          </Button>
          {tab !== "reports" ? (
            <>
              <Button
                type="button"
                variant="secondary"
                className="pp-btn--sm"
                disabled={offset === 0 || loading}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="pp-btn--sm"
                disabled={offset + PAGE >= total || loading}
                onClick={() => setOffset((o) => o + PAGE)}
              >
                Next
              </Button>
            </>
          ) : null}
          {pageInfo}
          <Link to="/dashboard/portfolio" className="pp-btn pp-btn--secondary pp-btn--sm">
            Portfolio
          </Link>
        </div>
        {error ? (
          <p className="pp-field__error" role="alert">
            {error}
          </p>
        ) : null}
      </Card>

      {tab === "audit" && isAdmin ? (
        <Card title="Audit log">
          {loading ? <PageLoader /> : null}
          {!loading && (
            <div className="pp-table-wrap">
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Actor</th>
                    <th>IP</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtIso(r.created_at)}</td>
                      <td>
                        <code>{r.action}</code>
                      </td>
                      <td>
                        {r.entity_type} {r.entity_id ? <code>{r.entity_id.slice(0, 8)}…</code> : null}
                      </td>
                      <td className="pp-muted">{r.actor_user_id ? `${r.actor_user_id.slice(0, 8)}…` : "—"}</td>
                      <td className="pp-muted">{r.ip_address ?? "—"}</td>
                      <td className="pp-muted" style={{ maxWidth: "16rem", fontSize: "0.8rem", wordBreak: "break-all" }}>
                        {JSON.stringify(r.detail)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!audit.length ? <p className="pp-muted">No rows match filters.</p> : null}
            </div>
          )}
        </Card>
      ) : null}

      {tab === "audit" && !isAdmin ? (
        <Card title="Audit log">
          <p className="pp-muted">Administrator role required.</p>
        </Card>
      ) : null}

      {tab === "activity" ? (
        <Card title="Activity log">
          {loading ? <PageLoader /> : null}
          {!loading && (
            <div className="pp-table-wrap">
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Kind</th>
                    <th>Summary</th>
                    <th>Project</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtIso(r.created_at)}</td>
                      <td>
                        <code>{r.kind}</code>
                      </td>
                      <td>{r.summary}</td>
                      <td>
                        {r.project_id ? (
                          <>
                            {r.project_name ? <span>{r.project_name} · </span> : null}
                            <Link to={`/dashboard/projects/${r.project_id}/history`}>History</Link>
                          </>
                        ) : (
                          <span className="pp-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!activity.length ? <p className="pp-muted">No rows match filters.</p> : null}
            </div>
          )}
        </Card>
      ) : null}

      {tab === "notifications" ? (
        <Card title="Notification history">
          {loading ? <PageLoader /> : null}
          {!loading && (
            <ul className="pp-notif-list">
              {notifications.map((r) => (
                <li key={r.id} className="pp-notif-item">
                  <div className="pp-notif-item__title">{r.title}</div>
                  <div className="pp-muted pp-notif-item__meta">
                    {fmtIso(r.created_at)} · {r.channel}
                  </div>
                  {Object.keys(r.detail).length ? (
                    <pre className="pp-pre-json pp-pre-json--sm">{JSON.stringify(r.detail, null, 2)}</pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {!loading && !notifications.length ? <p className="pp-muted">No rows match filters.</p> : null}
        </Card>
      ) : null}

      {tab === "reports" ? (
        <Card title="Report history (portfolio)">
          {loading ? <PageLoader /> : null}
          {!loading && (
            <div className="pp-table-wrap">
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Project</th>
                    <th>RAG</th>
                    <th>Headline</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.job_id}>
                      <td>{fmtIso(r.created_at)}</td>
                      <td>
                        <Link to={`/dashboard/projects/${r.project_id}/history`}>{r.project_name}</Link>
                      </td>
                      <td>{r.rag_status}</td>
                      <td className="pp-muted" style={{ maxWidth: "20rem" }}>
                        {r.forecast_headline ?? "—"}
                      </td>
                      <td>
                        <Link className="pp-btn pp-btn--secondary pp-btn--sm" to={`/dashboard/projects/${r.project_id}/reports?jobId=${r.job_id}`}>
                          Files
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!reports.length ? <p className="pp-muted">No report runs match filters.</p> : null}
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}

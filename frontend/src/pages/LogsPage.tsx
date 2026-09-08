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
import { apiFetch } from "../api/client";
import { fetchPortfolioReportHistory, type PortfolioReportHistoryRow } from "../api/portfolio";
import { useAuth } from "../auth/AuthContext";
import { isPlatformAdmin } from "../auth/roleUtils";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";
import { FilterField, FiltersBar, SearchField } from "@/components/ui/FiltersBar";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/ToastProvider";

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

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const isAdmin = isPlatformAdmin(user?.role);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setOffset(0);
  }, [tab, qDebounced, projectId, kind, action, entityType, dateFrom, dateTo]);

  useEffect(() => {
    setSelected(new Set());
  }, [tab]);

  useEffect(() => {
    setSelected(new Set());
  }, [audit, activity, notifications]);

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

  function toggleOne(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    let ids: string[] = [];
    if (tab === "audit") ids = audit.map((r) => r.id);
    else if (tab === "activity") ids = activity.map((r) => r.id);
    else if (tab === "notifications") ids = notifications.map((r) => r.id);
    else return;
    if (ids.length > 0 && selected.size === ids.length) setSelected(new Set());
    else setSelected(new Set(ids));
  }
  async function handleHardDelete() {
    if (selected.size === 0) return;
    setDeleting(true);
    let endpoint = "";
    let label = "";
    if (tab === "activity") {
      endpoint = "/logs/activity/bulk-delete";
      label = "activity logs";
    } else if (tab === "audit") {
      endpoint = "/logs/audit/bulk-delete";
      label = "audit logs";
    } else if (tab === "notifications") {
      endpoint = "/logs/notifications/bulk-delete";
      label = "notifications";
    } else {
      setDeleting(false);
      return;
    }
    try {
      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 300) || "Delete failed");
      const data = (await res.json().catch(() => ({}))) as { deleted?: number };
      toast.push("success", `${data.deleted ?? selected.size} ${label} hard deleted.`);
      setSelected(new Set());
      setConfirmOpen(false);
      void load();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const confirmTitle =
    tab === "audit"
      ? "Hard delete audit logs?"
      : tab === "activity"
        ? "Hard delete activity logs?"
        : tab === "notifications"
          ? "Hard delete notifications?"
          : "Hard delete?";

  const confirmMessage =
    tab === "audit"
      ? `Permanently delete ${selected.size} audit log(s)? This cannot be undone.`
      : tab === "activity"
        ? `Permanently delete ${selected.size} activity log(s)? This cannot be undone.`
        : `Permanently delete ${selected.size} notification(s)? This cannot be undone.`;

  // helper for header checkbox checked state
  const currentIds =
    tab === "audit" ? audit.map((r) => r.id) : tab === "activity" ? activity.map((r) => r.id) : tab === "notifications" ? notifications.map((r) => r.id) : [];
  const allChecked = currentIds.length > 0 && selected.size === currentIds.length;

  return (
    <div className="pp-grid pp-grid--1">
      <Card title="Logs & history">
        <p className="pp-muted">
          Search and filter server-side. <strong>Activity</strong> shows only <strong>your own</strong> actions. Audit is admin-only. Project
          admins can review anyone&apos;s activity under{" "}
          <Link to="/dashboard/admin/activity" className="font-medium text-primary hover:underline">
            Administration → Activity explorer
          </Link>
          .
        </p>
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
          <FiltersBar className="mt-4">
            <FilterField label="Project ID">
              <input
                className="pp-input h-9 rounded-xl"
                placeholder="Optional UUID filter"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              />
            </FilterField>
          </FiltersBar>
        ) : (
          <FiltersBar className="mt-4">
            <SearchField label="Search" value={q} onChange={setQ} placeholder="Text search…" />
            {tab === "activity" ? (
              <>
                <FilterField label="Project ID">
                  <input
                    className="pp-input h-9 rounded-xl"
                    placeholder="Filter by project"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                  />
                </FilterField>
                <FilterField label="Kind">
                  <input
                    className="pp-input h-9 rounded-xl"
                    placeholder="e.g. report.generate"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  />
                </FilterField>
              </>
            ) : null}
            {tab === "audit" ? (
              <>
                <FilterField label="Action">
                  <input className="pp-input h-9 rounded-xl" value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. login" />
                </FilterField>
                <FilterField label="Entity type">
                  <input className="pp-input h-9 rounded-xl" value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="e.g. project" />
                </FilterField>
              </>
            ) : null}
            <FilterField label="From" className="min-w-[148px] flex-none">
              <input className="pp-input h-9 rounded-xl" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </FilterField>
            <FilterField label="To" className="min-w-[148px] flex-none">
              <input className="pp-input h-9 rounded-xl" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </FilterField>
          </FiltersBar>
        )}
        <div className="pp-row-actions" style={{ marginTop: "0.75rem", alignItems: "center" }}>
          <Button type="button" variant="secondary" className="pp-btn--sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Apply / reload"}
          </Button>
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
        <Card
          title={`Audit log${selected.size > 0 ? ` · ${selected.size} selected` : ""}`}
          actions={
            selected.size > 0 ? (
              <Button variant="danger" className="pp-btn--sm rounded-xl" onClick={() => setConfirmOpen(true)}>
                Hard delete ({selected.size})
              </Button>
            ) : undefined
          }
        >
          {loading ? <PageLoader /> : null}
          {!loading && (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <div className="pp-table-wrap">
                <table className="pp-table">
                  <thead>
                    <tr>
                      <th className="w-9 px-3 py-2.5">
                        <input type="checkbox" className="size-4 rounded border-input accent-primary" checked={allChecked} onChange={toggleAll} aria-label="Select all" />
                      </th>
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
                        <td className="px-3 py-2">
                          <input type="checkbox" className="size-4 rounded border-input accent-primary" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} aria-label={`Select ${r.id}`} />
                        </td>
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
                {!audit.length ? <p className="pp-muted p-3">No rows match filters.</p> : null}
              </div>
              <Pagination
                page={offset}
                pageSize={PAGE}
                total={total}
                onPrev={() => setOffset((o) => Math.max(0, o - PAGE))}
                onNext={() => setOffset((o) => o + PAGE)}
              />
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
        <Card
          title={`Activity log${selected.size > 0 ? ` · ${selected.size} selected` : ""}`}
          actions={
            selected.size > 0 ? (
              <Button variant="danger" className="pp-btn--sm rounded-xl" onClick={() => setConfirmOpen(true)}>
                Hard delete ({selected.size})
              </Button>
            ) : undefined
          }
        >
          {loading ? <PageLoader /> : null}
          {!loading && (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <div className="pp-table-wrap">
                <table className="pp-table">
                  <thead>
                    <tr>
                      <th className="w-9 px-3 py-2.5">
                        <input type="checkbox" className="size-4 rounded border-input accent-primary" checked={allChecked} onChange={toggleAll} aria-label="Select all" />
                      </th>
                      <th>When</th>
                      <th>Kind</th>
                      <th>Summary</th>
                      <th>Project</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2">
                          <input type="checkbox" className="size-4 rounded border-input accent-primary" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} aria-label={`Select ${r.id}`} />
                        </td>
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
                {!activity.length ? <p className="pp-muted p-3">No rows match filters.</p> : null}
              </div>
              <Pagination
                page={offset}
                pageSize={PAGE}
                total={total}
                onPrev={() => setOffset((o) => Math.max(0, o - PAGE))}
                onNext={() => setOffset((o) => o + PAGE)}
              />
            </div>
          )}
        </Card>
      ) : null}

      {tab === "notifications" ? (
        <Card
          title={`Notification history${selected.size > 0 ? ` · ${selected.size} selected` : ""}`}
          actions={
            selected.size > 0 ? (
              <Button variant="danger" className="pp-btn--sm rounded-xl" onClick={() => setConfirmOpen(true)}>
                Hard delete ({selected.size})
              </Button>
            ) : undefined
          }
        >
          {loading ? <PageLoader /> : null}
          {!loading && (
            <div className="overflow-hidden rounded-xl border border-border/60">
              {notifications.length > 0 ? (
                <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">
                  <input type="checkbox" className="size-4 rounded border-input accent-primary" checked={allChecked} onChange={toggleAll} aria-label="Select all" />
                  <span>Select all</span>
                  <span className="ml-auto text-xs normal-case tracking-normal text-muted-foreground">{selected.size > 0 ? `${selected.size} selected` : ""}</span>
                </div>
              ) : null}
              <ul className="pp-notif-list">
                {notifications.map((r) => (
                  <li key={r.id} className="pp-notif-item flex gap-3">
                    <input type="checkbox" className="mt-1 size-4 shrink-0 rounded border-input accent-primary" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} aria-label={`Select ${r.id}`} />
                    <div className="min-w-0 flex-1">
                      <div className="pp-notif-item__title">{r.title}</div>
                      <div className="pp-muted pp-notif-item__meta">
                        {fmtIso(r.created_at)} · {r.channel}
                      </div>
                      {Object.keys(r.detail).length ? (
                        <pre className="pp-pre-json pp-pre-json--sm">{JSON.stringify(r.detail, null, 2)}</pre>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              {!notifications.length ? <p className="pp-muted p-3">No rows match filters.</p> : null}
              <Pagination
                page={offset}
                pageSize={PAGE}
                total={total}
                onPrev={() => setOffset((o) => Math.max(0, o - PAGE))}
                onNext={() => setOffset((o) => o + PAGE)}
              />
            </div>
          )}
          {!loading && !notifications.length ? null : null}
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

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel="Hard delete"
        variant="danger"
        loading={deleting}
        onConfirm={() => void handleHardDelete()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

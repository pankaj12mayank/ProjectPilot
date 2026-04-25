import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, readJsonOk } from "@/api/client";
import { fetchAuditLogsPaged, type AuditLogRow } from "@/api/logs";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";

const PAGE = 25;

type UserOpt = { id: string; email: string; full_name: string };

function fmtIso(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const inputClass =
  "flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function AdminAuditPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [users, setUsers] = useState<UserOpt[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setOffset(0);
  }, [qDebounced, action, entityType, entityId, actorUserId, dateFrom, dateTo]);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await apiFetch("/users");
        const data = await readJsonOk<Array<Record<string, unknown>>>(res);
        if (c) return;
        const opts = (Array.isArray(data) ? data : [])
          .map((r) => ({
            id: String(r.id ?? ""),
            email: String(r.email ?? ""),
            full_name: String(r.full_name ?? ""),
          }))
          .filter((u) => u.id);
        setUsers(opts.sort((a, b) => a.email.localeCompare(b.email)));
      } catch {
        if (!c) setUsers([]);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchAuditLogsPaged({
        q: qDebounced || undefined,
        action: action.trim() || undefined,
        entity_type: entityType.trim() || undefined,
        entity_id: entityId.trim() || undefined,
        actor_user_id: actorUserId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        limit: PAGE,
        offset,
      });
      setRows(r.items);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit logs");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [qDebounced, action, entityType, entityId, actorUserId, dateFrom, dateTo, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE));
  const pageIndex = Math.floor(offset / PAGE) + 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Audit log</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Immutable security trail. Filter by actor, entity, or free text. For the combined log viewer see{" "}
          <Link to="/dashboard/logs?tab=audit" className="font-medium text-primary hover:underline">
            Activity &amp; logs
          </Link>
          .
        </p>
      </div>

      <Card className="border-border/80 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Search runs server-side.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="ad-q">
              Search
            </label>
            <input id="ad-q" className={inputClass} placeholder="Action, entity, detail…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="ad-action">
              Action contains
            </label>
            <input id="ad-action" className={inputClass} value={action} onChange={(e) => setAction(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="ad-etype">
              Entity type
            </label>
            <input id="ad-etype" className={inputClass} placeholder="e.g. branding" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="ad-eid">
              Entity id
            </label>
            <input id="ad-eid" className={inputClass} value={entityId} onChange={(e) => setEntityId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Actor</label>
            <select className={inputClass} value={actorUserId} onChange={(e) => setActorUserId(e.target.value)} aria-label="Actor user">
              <option value="">Any</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ad-df">
                From
              </label>
              <input id="ad-df" type="date" className={inputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ad-dt">
                To
              </label>
              <input id="ad-dt" type="date" className={inputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-card">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Events</CardTitle>
            <CardDescription>
              {total === 0 ? "No rows" : `${offset + 1}–${offset + rows.length} of ${total}`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="rounded-xl" disabled={offset === 0 || loading} onClick={() => setOffset((o) => Math.max(0, o - PAGE))}>
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl"
              disabled={offset + PAGE >= total || loading}
              onClick={() => setOffset((o) => o + PAGE)}
            >
              Next
            </Button>
            <span className="self-center text-xs text-muted-foreground">
              Page {pageIndex} / {pageCount}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
          {!loading && rows.length === 0 && !error ? <p className="text-sm text-muted-foreground">No audit rows match.</p> : null}
          {rows.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">When</th>
                    <th className="px-3 py-2.5 font-medium">Action</th>
                    <th className="px-3 py-2.5 font-medium">Entity</th>
                    <th className="px-3 py-2.5 font-medium">Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-muted/15">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{fmtIso(r.created_at)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                      <td className="px-3 py-2 text-xs">
                        {r.entity_type}
                        {r.entity_id ? <span className="text-muted-foreground"> / {r.entity_id}</span> : null}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs text-muted-foreground">{r.actor_user_id ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

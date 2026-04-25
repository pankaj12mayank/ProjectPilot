import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, readJsonOk } from "@/api/client";
import { fetchAdminActivityLogsPaged, type ActivityLogRow } from "@/api/logs";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";

const PAGE = 25;

type UserOpt = { id: string; email: string; full_name: string };

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminActivityPage() {
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [actorId, setActorId] = useState<string>("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [kind, setKind] = useState("");
  const [projectId, setProjectId] = useState("");
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setOffset(0);
  }, [qDebounced, actorId, kind, projectId]);

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
      const r = await fetchAdminActivityLogsPaged({
        actor_user_id: actorId || undefined,
        q: qDebounced || undefined,
        kind: kind || undefined,
        project_id: projectId.trim() || undefined,
        limit: PAGE,
        offset,
      });
      setRows(r.items);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [actorId, qDebounced, kind, projectId, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE)), [total]);
  const pageIndex = Math.floor(offset / PAGE) + 1;

  const inputClass =
    "flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Activity explorer</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Cross-user product activity. End users only see their own timeline under{" "}
          <Link to="/dashboard/logs?tab=activity" className="font-medium text-primary hover:underline">
            Activity &amp; logs
          </Link>
          .
        </p>
      </div>

      <Card className="border-border/80 shadow-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Actor, text search, kind, or project id.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Actor</label>
            <select
              className={inputClass}
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              aria-label="Filter by user"
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="act-q">
              Search
            </label>
            <input id="act-q" className={inputClass} placeholder="Summary, kind…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="act-kind">
              Kind contains
            </label>
            <input
              id="act-kind"
              className={inputClass}
              placeholder="e.g. project.upload"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="act-pid">
              Project ID
            </label>
            <input
              id="act-pid"
              className={inputClass}
              placeholder="UUID"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-card">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-4">
          <div>
            <CardTitle className="text-base">Events</CardTitle>
            <CardDescription>
              {total === 0 ? "No rows" : `Showing ${offset + 1}–${offset + rows.length} of ${total}`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl"
              disabled={offset === 0 || loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
            >
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
          {!loading && rows.length === 0 && !error ? (
            <p className="text-sm text-muted-foreground">No activity matches these filters.</p>
          ) : null}
          {rows.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">When</th>
                    <th className="px-3 py-2.5 font-medium">Actor</th>
                    <th className="px-3 py-2.5 font-medium">Kind</th>
                    <th className="px-3 py-2.5 font-medium">Summary</th>
                    <th className="px-3 py-2.5 font-medium">Project</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{fmt(r.created_at)}</td>
                      <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs">{r.actor_user_id}</td>
                      <td className="max-w-[160px] truncate px-3 py-2 font-mono text-xs">{r.kind}</td>
                      <td className="max-w-md px-3 py-2">{r.summary}</td>
                      <td className="px-3 py-2">
                        {r.project_id ? (
                          <Link className="text-primary hover:underline" to={`/dashboard/projects/${r.project_id}`}>
                            {r.project_name || `${r.project_id.slice(0, 8)}…`}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
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

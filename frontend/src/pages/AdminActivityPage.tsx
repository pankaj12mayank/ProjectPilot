import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, readJsonOk } from "@/api/client";
import { fetchAdminActivityLogsPaged, type ActivityLogRow } from "@/api/logs";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { FilterField, FiltersBar, SearchField } from "@/components/ui/FiltersBar";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/ToastProvider";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

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

  useEffect(() => {
    setSelected(new Set());
  }, [rows]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    if (selected.size === rows.length && rows.length > 0) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }
  async function handleHardDelete() {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const res = await apiFetch("/logs/activity/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 300) || "Delete failed");
      const data = (await res.json().catch(() => ({}))) as { deleted?: number };
      toast.push("success", `${data.deleted ?? selected.size} activity logs hard deleted.`);
      setSelected(new Set());
      setConfirmOpen(false);
      void load();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const inputClass =
    "flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-6">
      <div>
        <p className="mt-1 w-full text-sm text-muted-foreground">
          Cross-user product activity. End users only see their own timeline under{" "}
          <Link to="/dashboard/logs?tab=activity" className="font-medium text-primary hover:underline">
            Activity &amp; logs
          </Link>
          .
        </p>
      </div>

      <FiltersBar>
        <FilterField label="Actor">
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
        </FilterField>
        <SearchField label="Search" value={q} onChange={setQ} placeholder="Summary, kind…" />
        <FilterField label="Kind contains">
          <input
            id="act-kind"
            className={inputClass}
            placeholder="e.g. project.upload"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          />
        </FilterField>
        <FilterField label="Project ID">
          <input
            id="act-pid"
            className={inputClass}
            placeholder="UUID"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          />
        </FilterField>
      </FiltersBar>

      <Card className="overflow-hidden border-border/80 shadow-card">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Events</CardTitle>
            <CardDescription>Actor, text search, kind, or project id. Search runs server-side. {selected.size > 0 ? `${selected.size} selected` : ""}</CardDescription>
          </div>
          {selected.size > 0 ? (
            <Button type="button" variant="destructive" size="sm" className="rounded-xl" onClick={() => setConfirmOpen(true)}>
              Hard delete ({selected.size})
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
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
                    <th className="w-9 px-3 py-2.5">
                      <input type="checkbox" className="size-4 rounded border-input accent-primary" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} aria-label="Select all" />
                    </th>
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
                      <td className="px-3 py-2">
                        <input type="checkbox" className="size-4 rounded border-input accent-primary" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} aria-label={`Select ${r.id}`} />
                      </td>
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
        <Pagination
          page={offset}
          pageSize={PAGE}
          total={total}
          onPrev={() => setOffset((o) => Math.max(0, o - PAGE))}
          onNext={() => setOffset((o) => o + PAGE)}
          className="rounded-b-xl"
        />
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Hard delete activity logs?"
        message={`Permanently delete ${selected.size} activity log(s)? This cannot be undone.`}
        confirmLabel="Hard delete"
        variant="danger"
        loading={deleting}
        onConfirm={() => void handleHardDelete()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

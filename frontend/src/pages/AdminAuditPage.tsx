import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, readJsonOk } from "@/api/client";
import { fetchAuditLogsPaged, type AuditLogRow } from "@/api/logs";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { FilterField, FiltersBar, SearchField } from "@/components/ui/FiltersBar";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/ToastProvider";

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
      const res = await apiFetch("/logs/audit/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 300) || "Delete failed");
      const data = (await res.json().catch(() => ({}))) as { deleted?: number };
      toast.push("success", `${data.deleted ?? selected.size} audit logs hard deleted.`);
      setSelected(new Set());
      setConfirmOpen(false);
      void load();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mt-1 w-full text-sm text-muted-foreground">
          Immutable security trail. Filter by actor, entity, or free text. For the combined log viewer see{" "}
          <Link to="/dashboard/logs?tab=audit" className="font-medium text-primary hover:underline">
            Activity &amp; logs
          </Link>
          .
        </p>
      </div>

      <FiltersBar>
        <SearchField label="Search" value={q} onChange={setQ} placeholder="Action, entity, detail…" />
        <FilterField label="Action contains">
          <input id="ad-action" className={inputClass} value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. login" />
        </FilterField>
        <FilterField label="Entity type">
          <input id="ad-etype" className={inputClass} placeholder="e.g. branding" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
        </FilterField>
        <FilterField label="Entity id">
          <input id="ad-eid" className={inputClass} value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="UUID" />
        </FilterField>
        <FilterField label="Actor">
          <select className={inputClass} value={actorUserId} onChange={(e) => setActorUserId(e.target.value)} aria-label="Actor user">
            <option value="">Any</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.email})
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="From" className="min-w-[148px] flex-none">
          <input id="ad-df" type="date" className={inputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </FilterField>
        <FilterField label="To" className="min-w-[148px] flex-none">
          <input id="ad-dt" type="date" className={inputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </FilterField>
      </FiltersBar>

      <Card className="overflow-hidden border-border/80 shadow-card">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Events</CardTitle>
            <CardDescription>Search runs server-side. {selected.size > 0 ? `${selected.size} selected` : ""}</CardDescription>
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
          {!loading && rows.length === 0 && !error ? <p className="text-sm text-muted-foreground">No audit rows match.</p> : null}
          {rows.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-9 px-3 py-2.5">
                      <input type="checkbox" className="size-4 rounded border-input accent-primary" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} aria-label="Select all" />
                    </th>
                    <th className="px-3 py-2.5 font-medium">When</th>
                    <th className="px-3 py-2.5 font-medium">Action</th>
                    <th className="px-3 py-2.5 font-medium">Entity</th>
                    <th className="px-3 py-2.5 font-medium">Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-muted/15">
                      <td className="px-3 py-2">
                        <input type="checkbox" className="size-4 rounded border-input accent-primary" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} aria-label={`Select ${r.id}`} />
                      </td>
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
        title="Hard delete audit logs?"
        message={`Permanently delete ${selected.size} audit log(s)? This cannot be undone.`}
        confirmLabel="Hard delete"
        variant="danger"
        loading={deleting}
        onConfirm={() => void handleHardDelete()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAuditLogsPaged, type AuditLogRow } from "../api/logs";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

const PAGE = 50;

function fmtIso(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminAuditPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "branding">("branding");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q =
        filter === "branding"
          ? await fetchAuditLogsPaged({
              entity_type: "branding",
              limit: PAGE,
              offset,
            })
          : await fetchAuditLogsPaged({ limit: PAGE, offset });
      setRows(q.items);
      setTotal(q.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit logs");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card title="Audit logs">
      <p className="pp-muted">
        Branding changes are recorded as <code>branding.*</code> actions.{" "}
        <Link to="/dashboard/logs?tab=audit">Open full log viewer</Link> for every admin event.
      </p>
      <div className="pp-form pp-admin-audit-filters">
        <label className="pp-check">
          <input
            type="radio"
            name="audit-filter"
            checked={filter === "branding"}
            onChange={() => {
              setOffset(0);
              setFilter("branding");
            }}
          />{" "}
          Branding only
        </label>
        <label className="pp-check">
          <input
            type="radio"
            name="audit-filter"
            checked={filter === "all"}
            onChange={() => {
              setOffset(0);
              setFilter("all");
            }}
          />{" "}
          All events
        </label>
      </div>
      {error ? (
        <p className="pp-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="pp-muted">Loading…</p> : null}
      {!loading && rows.length === 0 && !error ? <p className="pp-muted">No rows.</p> : null}
      {rows.length > 0 ? (
        <div className="pp-table-wrap">
          <table className="pp-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtIso(r.created_at)}</td>
                  <td>{r.action}</td>
                  <td>
                    {r.entity_type}
                    {r.entity_id ? ` / ${r.entity_id}` : ""}
                  </td>
                  <td className="pp-muted">{r.actor_user_id ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {total > PAGE ? (
        <div className="pp-row-actions" style={{ marginTop: "1rem" }}>
          <Button type="button" variant="secondary" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE))}>
            Previous
          </Button>{" "}
          <Button
            type="button"
            variant="secondary"
            disabled={offset + PAGE >= total}
            onClick={() => setOffset((o) => o + PAGE)}
          >
            Next
          </Button>
          <span className="pp-muted" style={{ marginLeft: "0.75rem" }}>
            Showing {offset + 1}–{Math.min(offset + PAGE, total)} of {total}
          </span>
        </div>
      ) : null}
    </Card>
  );
}

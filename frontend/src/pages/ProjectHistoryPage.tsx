import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchProjectHistory, type ProjectHistoryEvent } from "../api/portfolio";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";
import { Button } from "../components/ui/Button";

function fmtIso(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function eventTitle(e: ProjectHistoryEvent): string {
  if (e.type === "report_run") return `Report run ${String(e.job_id ?? "").slice(0, 8)}…`;
  if (e.type === "metrics_snapshot") return `Metrics snapshot (${String(e.source ?? "")})`;
  if (e.type === "generated_file") return `File: ${String(e.artifact_key ?? "")}`;
  return e.type;
}

export default function ProjectHistoryPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [events, setEvents] = useState<ProjectHistoryEvent[]>([]);
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!projectId) return;
      try {
        setError(null);
        setLoading(true);
        const h = await fetchProjectHistory(projectId);
        if (!cancelled) {
          setEvents(h.events);
          setName(h.project_name);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, key]);

  if (error && !events.length) {
    return (
      <Card title="Project history">
        <p className="pp-field__error">{error}</p>
        <Link to={projectId ? `/dashboard/projects/${projectId}` : "/dashboard/projects"}>Back</Link>
      </Card>
    );
  }

  if (!projectId) return <PageLoader />;

  return (
    <div className="pp-grid pp-grid--1">
      <Card
        title={`Project history — ${name ?? projectId}`}
        actions={
          <div className="pp-row-actions">
            <Button type="button" variant="secondary" className="pp-btn--sm" onClick={() => setKey((k) => k + 1)}>
              Refresh
            </Button>
            <Link to={`/dashboard/projects/${projectId}/health`} className="pp-btn pp-btn--secondary pp-btn--sm">
              Health
            </Link>
            <Link to={`/dashboard/projects/${projectId}`} className="pp-btn pp-btn--secondary pp-btn--sm">
              Details
            </Link>
          </div>
        }
      >
        <p className="pp-muted">
          Every row includes <code>project_id</code> so runs, snapshots, and generated files stay linked to this project.
        </p>
      </Card>

      <Card title="Timeline">
        {loading ? (
          <PageLoader />
        ) : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Summary</th>
                  <th>project_id</th>
                  <th>Links</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={`${e.at}-${i}`}>
                    <td>{fmtIso(e.at)}</td>
                    <td>
                      <code>{e.type}</code>
                    </td>
                    <td>{eventTitle(e)}</td>
                    <td>
                      <code className="pp-muted">{String(e.project_id).slice(0, 8)}…</code>
                    </td>
                    <td>
                      {e.type === "report_run" && e.job_id ? (
                        <Link className="pp-btn pp-btn--secondary pp-btn--sm" to={`/dashboard/projects/${projectId}/reports?jobId=${String(e.job_id)}`}>
                          Downloads
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && events.length === 0 && !error ? <p className="pp-muted">No historical events yet.</p> : null}
      </Card>
    </div>
  );
}

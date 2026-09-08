import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchProjects, type ProjectOut } from "../api/projects";
import { Button } from "@/components/shadcn/button";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";

export default function MetricsDashboardPage() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("project") ?? searchParams.get("projectId") ?? "";

  const [projects, setProjects] = useState<ProjectOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchProjects();
        if (!cancelled) setProjects(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load projects");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="w-full">
        <Card title="Metrics dashboard">
          <p className="pp-field__error">{error}</p>
        </Card>
      </div>
    );
  }

  if (projects === null) return <PageLoader />;

  const highlighted = highlightId ? projects.find((p) => p.id === highlightId) : null;

  return (
    <div className="pp-grid pp-grid--1 w-full">
      <Card title="Metrics & analytics">
        <p className="pp-muted w-full text-center text-pretty">
          KPIs, EVM, RAID-derived signals, and RAG are computed from validated ingested uploads per project. Prefer
          selecting a project from <Link to="/dashboard/reports">Reports</Link> so you land in the right workspace;
          this page lists every project for quick access.
        </p>
        <div className="mt-4 flex w-full flex-col items-stretch justify-center gap-2 sm:flex-row">
          <Button asChild variant="secondary" className="w-full rounded-xl sm:w-auto">
            <Link to="/dashboard/reports">Back to Reports</Link>
          </Button>
          <Button asChild variant="outline" className="w-full rounded-xl sm:w-auto">
            <Link to="/dashboard/portfolio">Portfolio overview</Link>
          </Button>
        </div>
      </Card>

      <Card title="Cross-project analytics">
        <p className="pp-muted">
          For portfolio-wide KPIs, heatmaps, and trends across all projects you can access, use{" "}
          <Link to="/dashboard/portfolio" className="pp-btn pp-btn--primary pp-btn--sm" style={{ display: "inline-flex" }}>
            Portfolio
          </Link>
          .
        </p>
      </Card>

      <Card title="Your projects">
        {highlighted ? (
          <p className="pp-muted mb-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
            Highlighting <strong>{highlighted.name}</strong>. Open its health workspace for live charts.
            <Link className="ml-2 font-medium text-primary underline-offset-4 hover:underline" to={`/dashboard/projects/${highlighted.id}/health`}>
              Open health
            </Link>
          </p>
        ) : null}
        {projects.length === 0 ? (
          <p className="pp-muted">
            No projects yet.{" "}
            <Link to="/dashboard/projects/new">Create a project</Link>, upload files, then return here.
          </p>
        ) : (
          <div className="pp-table-wrap w-full">
            <table className="pp-table w-full min-w-0">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className={p.id === highlightId ? "bg-primary/5" : undefined}>
                    <td>
                      <Link to={`/dashboard/projects/${p.id}`}>{p.name}</Link>
                    </td>
                    <td className="pp-muted">{new Date(p.updated_at).toLocaleString()}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link className="pp-btn pp-btn--primary pp-btn--sm" to={`/dashboard/projects/${p.id}/health`}>
                        Health &amp; charts
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

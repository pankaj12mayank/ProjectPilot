import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProjects, type ProjectOut } from "../api/projects";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";

export default function MetricsDashboardPage() {
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
      <Card title="Metrics dashboard">
        <p className="pp-field__error">{error}</p>
      </Card>
    );
  }

  if (projects === null) return <PageLoader />;

  return (
    <div className="pp-grid pp-grid--1">
      <Card title="Metrics dashboard">
        <p className="pp-muted">
          KPI, EVM, RAID risk, milestones, resource variance, dependency baseline, and RAG are computed from{" "}
          <strong>validated ingested uploads</strong> per project. Open a project&apos;s health view for charts and
          detailed summaries.
        </p>
      </Card>
      <Card title="Your projects">
        {projects.length === 0 ? (
          <p className="pp-muted">
            No projects yet.{" "}
            <Link to="/dashboard/projects/new">Create a project</Link>, upload files, then return here.
          </p>
        ) : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
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

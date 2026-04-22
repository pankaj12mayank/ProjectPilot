import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProjects, type ProjectOut } from "../api/projects";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";

export default function ProjectsPage() {
  const [items, setItems] = useState<ProjectOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchProjects();
        if (!cancelled) setItems(rows);
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
      <Card title="Projects">
        <p className="pp-field__error">{error}</p>
      </Card>
    );
  }

  if (items === null) return <PageLoader />;

  return (
    <div className="pp-grid pp-grid--1">
      <Card
        title="Projects"
        actions={
          <Link to="/dashboard/projects/new" className="pp-btn pp-btn--primary pp-btn--sm">
            Create project
          </Link>
        }
      >
        {items.length === 0 ? (
          <p className="pp-muted">No projects yet. Create one to upload status, RAID, and weekly history files.</p>
        ) : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/dashboard/projects/${p.id}`}>{p.name}</Link>
                      {p.is_archived ? <span className="pp-pill pp-pill--muted">Archived</span> : null}
                    </td>
                    <td className="pp-muted">{new Date(p.updated_at).toLocaleString()}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className="pp-row-actions" style={{ justifyContent: "flex-end" }}>
                        <Link className="pp-btn pp-btn--primary pp-btn--sm" to={`/dashboard/projects/${p.id}/health`}>
                          Health
                        </Link>
                        <Link className="pp-btn pp-btn--secondary pp-btn--sm" to={`/dashboard/projects/${p.id}/upload`}>
                          Upload
                        </Link>
                      </span>
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

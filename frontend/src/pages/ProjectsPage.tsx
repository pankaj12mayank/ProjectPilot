import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteProject, fetchProjects, type ProjectOut } from "../api/projects";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";
import { useToast } from "../components/ToastProvider";
import { friendlyErrorMessage } from "@/lib/friendlyMessages";

/** No collaborators stored yet (empty or owner-only). */
function needsTeamAssignment(p: ProjectOut): boolean {
  const t = p.team_user_ids;
  if (!t || t.length === 0) return true;
  return t.length === 1 && t[0] === p.owner_id;
}

function canDeleteProject(user: { id: string; role: string } | null | undefined, p: ProjectOut): boolean {
  if (!user) return false;
  if (user.id === p.owner_id) return true;
  return user.role === "admin" || user.role === "system_owner";
}

export default function ProjectsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<ProjectOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await fetchProjects();
      setItems(rows);
    } catch (e) {
      const msg = friendlyErrorMessage(e, "We could not load your projects.");
      setError(msg);
      toast.push("error", msg);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(p: ProjectOut) {
    if (!canDeleteProject(user, p)) return;
    const ok = window.confirm(
      `Remove project “${p.name}”? All uploads, reports, and history for this project will be permanently deleted.`,
    );
    if (!ok) return;
    setDeletingId(p.id);
    try {
      await deleteProject(p.id);
      await load();
      toast.push("success", `Project “${p.name}” has been removed.`);
    } catch (e) {
      const msg = friendlyErrorMessage(e, "We could not remove that project.");
      toast.push("error", msg);
      setError(msg);
    } finally {
      setDeletingId(null);
    }
  }

  if (error && items === null) {
    return (
      <Card title="Projects">
        <p className="pp-field__error">{error}</p>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Try again
        </Button>
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
        {error ? (
          <p className="pp-field__error" role="alert" style={{ marginBottom: "0.75rem" }}>
            {error}
          </p>
        ) : null}
        {items.length === 0 ? (
          <p className="pp-muted">No projects yet. Create one to upload status, RAID, and weekly history files.</p>
        ) : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const assignTeam = needsTeamAssignment(p);
                  const showDelete = canDeleteProject(user, p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link to={`/dashboard/projects/${p.id}${assignTeam ? "#project-team" : ""}`}>{p.name}</Link>
                      </td>
                      <td>
                        {p.is_archived ? (
                          <span className="pp-pill pp-pill--muted">Inactive</span>
                        ) : (
                          <span
                            className="pp-pill"
                            style={{ background: "color-mix(in srgb, hsl(var(--primary)) 14%, transparent)" }}
                          >
                            Active
                          </span>
                        )}
                      </td>
                      <td className="pp-muted">
                        {p.has_ingested_data ? (
                          <span
                            className="pp-pill"
                            style={{ background: "color-mix(in srgb, hsl(var(--primary)) 18%, transparent)" }}
                          >
                            Ingested
                          </span>
                        ) : (
                          <span className="pp-pill pp-pill--muted">No uploads</span>
                        )}
                      </td>
                      <td className="pp-muted">{new Date(p.updated_at).toLocaleString()}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="pp-row-actions" style={{ justifyContent: "flex-end" }}>
                          <Link
                            className="pp-btn pp-btn--secondary pp-btn--sm"
                            to={`/dashboard/projects/${p.id}${assignTeam ? "#project-team" : ""}`}
                          >
                            {assignTeam ? "Assign team" : "Edit"}
                          </Link>
                          <Link className="pp-btn pp-btn--primary pp-btn--sm" to={`/dashboard/projects/${p.id}/health`}>
                            Health
                          </Link>
                          {p.has_ingested_data || p.latest_report_job_id ? (
                            <Link
                              className="pp-btn pp-btn--primary pp-btn--sm"
                              to={
                                p.latest_report_job_id
                                  ? `/dashboard/projects/${p.id}/reports?jobId=${encodeURIComponent(p.latest_report_job_id)}`
                                  : `/dashboard/projects/${p.id}/reports`
                              }
                            >
                              View report
                            </Link>
                          ) : null}
                          <Link className="pp-btn pp-btn--secondary pp-btn--sm" to={`/dashboard/projects/${p.id}/upload`}>
                            Upload
                          </Link>
                          {showDelete ? (
                            <Button
                              type="button"
                              variant="danger"
                              className="pp-btn--sm"
                              disabled={deletingId === p.id}
                              onClick={() => void handleDelete(p)}
                            >
                              {deletingId === p.id ? "Removing…" : "Delete"}
                            </Button>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

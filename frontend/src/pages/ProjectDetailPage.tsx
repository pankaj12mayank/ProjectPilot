import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteProject,
  fetchAssignableUsers,
  fetchProject,
  updateProject,
  type AssignableUserOut,
  type ProjectOut,
} from "../api/projects";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FormField } from "../components/ui/FormField";
import { PageLoader } from "../components/PageLoader";
import { useToast } from "../components/ToastProvider";
import { friendlyErrorMessage } from "@/lib/friendlyMessages";

function dateIsoToInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export default function ProjectDetailPage() {
  const toast = useToast();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectOut | null>(null);
  const [assignable, setAssignable] = useState<AssignableUserOut[] | null>(null);
  const [usersListError, setUsersListError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inactive, setInactive] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const loadAssignable = useCallback(async () => {
    try {
      setAssignable(await fetchAssignableUsers());
      setUsersListError(null);
    } catch (e) {
      const msg = friendlyErrorMessage(e, "We could not load the people you can add to the team.");
      setUsersListError(msg);
      setAssignable([]);
      toast.push("error", msg);
    }
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void loadAssignable();
    (async () => {
      try {
        const p = await fetchProject(projectId);
        if (!cancelled) {
          setProject(p);
          setName(p.name);
          setDescription(p.description ?? "");
          setInactive(p.is_archived);
          setStartDate(dateIsoToInput(p.planned_start_date));
          setEndDate(dateIsoToInput(p.planned_end_date));
          const team = p.team_user_ids?.length ? p.team_user_ids : [p.owner_id];
          setTeamIds(team);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = friendlyErrorMessage(e, "We could not open this project.");
          setError(msg);
          toast.push("error", msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, loadAssignable]);

  function toggleTeam(id: string) {
    if (!project) return;
    if (id === project.owner_id) return;
    setTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !name.trim()) return;
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      if (startDate && endDate && endDate < startDate) {
        const msg = "The end date must be the same as or after the start date.";
        setError(msg);
        toast.push("error", msg);
        return;
      }
      const body: Parameters<typeof updateProject>[1] = {
        name: name.trim(),
        description: description.trim() || null,
        is_archived: inactive,
        team_user_ids: teamIds.length ? teamIds : [project!.owner_id],
      };
      if (startDate) body.planned_start_date = `${startDate}T00:00:00.000Z`;
      else body.planned_start_date = null;
      if (endDate) body.planned_end_date = `${endDate}T23:59:59.000Z`;
      else body.planned_end_date = null;
      const p = await updateProject(projectId, body);
      setProject(p);
      setSaved(true);
      toast.push("success", "Your changes to this project were saved.");
    } catch (err) {
      const msg = friendlyErrorMessage(err, "We could not save your changes.");
      setError(msg);
      toast.push("error", msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!projectId || !project) return;
    setShowConfirmDelete(false);
    setError(null);
    setDeleting(true);
    try {
      await deleteProject(projectId);
      toast.push("success", `Project “${project.name}” has been removed.`);
      navigate("/dashboard/projects", { replace: true });
    } catch (err) {
      const msg = friendlyErrorMessage(err, "We could not remove this project.");
      setError(msg);
      toast.push("error", msg);
    } finally {
      setDeleting(false);
    }
  }

  const canDelete =
    user && project && (user.id === project.owner_id || user.role === "admin" || user.role === "system_owner");

  if (error && !project) {
    return (
      <Card title="Project">
        <p className="pp-field__error">{error}</p>
        <Link to="/dashboard/projects">Back to projects</Link>
      </Card>
    );
  }

  if (!project) return <PageLoader />;

  return (
    <div className="pp-grid pp-grid--2">
      <Card title="Edit project">
        <form className="pp-form" onSubmit={handleSave}>
          <FormField label="Name" htmlFor="pd-name">
            <input
              id="pd-name"
              className="pp-input"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              maxLength={200}
            />
          </FormField>
          <FormField label="Description" htmlFor="pd-desc">
            <textarea
              id="pd-desc"
              className="pp-input"
              rows={4}
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
              maxLength={4000}
            />
          </FormField>
          <label className="pp-check">
            <input type="checkbox" checked={inactive} onChange={(ev) => setInactive(ev.target.checked)} />
            <span>Inactive (archived) — hide from active work lists</span>
          </label>
          <div className="pp-form pp-form--grid" style={{ marginTop: "0.5rem" }}>
            <FormField label="Planned start" htmlFor="pd-start">
              <input id="pd-start" className="pp-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </FormField>
            <FormField label="Planned end" htmlFor="pd-end">
              <input id="pd-end" className="pp-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </FormField>
          </div>
          <div id="project-team" style={{ marginTop: "1rem" }}>
            <p className="pp-field__label">Team</p>
            <p className="pp-muted" style={{ marginBottom: "0.5rem" }}>
              Owner is always on the team. For other users, your role may limit who you can add. Team membership is
              stored for visibility; access control is unchanged.
            </p>
            {usersListError ? <p className="pp-field__error">{usersListError}</p> : null}
            {assignable === null ? (
              <p className="pp-muted">Loading users…</p>
            ) : !assignable.length ? (
              <p className="pp-muted">No additional users available to assign.</p>
            ) : (
              <ul className="pp-muted" style={{ listStyle: "none", padding: 0 }}>
                {assignable.map((u) => {
                  const locked = u.id === project.owner_id;
                  const checked = teamIds.includes(u.id);
                  return (
                    <li key={u.id} style={{ marginBottom: "0.5rem" }}>
                      <label className="pp-check" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={locked}
                          onChange={() => toggleTeam(u.id)}
                        />
                        <span>
                          {u.full_name} <span className="pp-muted">({u.email})</span>
                          {locked ? <span className="pp-muted"> — owner</span> : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {error ? (
            <p className="pp-field__error" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? <p className="pp-success">Saved.</p> : null}
          <div className="pp-row-actions">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
            <Link to="/dashboard/projects" className="pp-btn pp-btn--secondary">
              All projects
            </Link>
          </div>
        </form>
        {canDelete ? (
          <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid color-mix(in srgb, hsl(var(--border)) 80%, transparent)" }}>
            <p className="pp-muted" style={{ marginBottom: "0.5rem" }}>
              Delete this project and all related files and history. This cannot be undone.
            </p>
            <Button type="button" variant="danger" onClick={() => setShowConfirmDelete(true)} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete project"}
            </Button>
          </div>
        ) : null}
      </Card>
      <Card title="Files & validation">
        <p className="pp-muted">
          Upload CSV or Excel files for the status tracker, RAID log, and weekly completion history. The server parses
          each file, maps headers, cleans values, and runs structural checks before anything is processed further.
        </p>
        <div className="pp-row-actions" style={{ marginTop: "1rem" }}>
          <Link to={`/dashboard/projects/${project.id}/health`} className="pp-btn pp-btn--primary">
            Health &amp; analytics
          </Link>
          <Link to={`/dashboard/projects/${project.id}/forecast`} className="pp-btn pp-btn--secondary">
            Forecast
          </Link>
          <Link to={`/dashboard/projects/${project.id}/recommendations`} className="pp-btn pp-btn--secondary">
            Recommendations
          </Link>
          <Link to={`/dashboard/projects/${project.id}/risks`} className="pp-btn pp-btn--secondary">
            Risks
          </Link>
          <Link to={`/dashboard/projects/${project.id}/reports`} className="pp-btn pp-btn--secondary">
            Reports
          </Link>
          <Link to={`/dashboard/projects/${project.id}/history`} className="pp-btn pp-btn--secondary">
            Project history
          </Link>
          <Link to={`/dashboard/projects/${project.id}/reports/history`} className="pp-btn pp-btn--secondary">
            Report history
          </Link>
          <Link to={`/dashboard/projects/${project.id}/upload`} className="pp-btn pp-btn--secondary">
            Upload &amp; validate
          </Link>
          <Link to="/dashboard/governance" className="pp-btn pp-btn--secondary">
            Governance report
          </Link>
        </div>
      </Card>
      <ConfirmDialog
        open={showConfirmDelete}
        title={`Delete ${project?.name ?? ""}?`}
        message={
          <>
            <p>This removes all uploads, ingested data, and generated reports for this project forever.</p>
            <p className="mt-2">Are you sure you want to continue?</p>
          </>
        }
        confirmLabel="Delete project"
        variant="danger"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </div>
  );
}

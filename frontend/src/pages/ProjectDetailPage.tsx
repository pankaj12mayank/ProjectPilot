import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchProject, updateProject, type ProjectOut } from "../api/projects";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { FormField } from "../components/ui/FormField";
import { PageLoader } from "../components/PageLoader";

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectOut | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchProject(projectId);
        if (!cancelled) {
          setProject(p);
          setName(p.name);
          setDescription(p.description ?? "");
          setArchived(p.is_archived);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load project");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !name.trim()) return;
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      const p = await updateProject(projectId, {
        name: name.trim(),
        description: description.trim() || null,
        is_archived: archived,
      });
      setProject(p);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

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
      <Card title="Project details">
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
            <input type="checkbox" checked={archived} onChange={(ev) => setArchived(ev.target.checked)} />
            <span>Archived</span>
          </label>
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
    </div>
  );
}

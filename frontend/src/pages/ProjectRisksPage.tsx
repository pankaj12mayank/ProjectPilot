import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  createProjectRisk,
  fetchProject,
  fetchProjectRisks,
  updateProjectRisk,
  type ProjectOut,
  type ProjectRiskOut,
} from "../api/projects";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { FormField } from "../components/ui/FormField";
import { PageLoader } from "../components/PageLoader";
import { useToast } from "../components/ToastProvider";
import { friendlyErrorMessage } from "@/lib/friendlyMessages";

const SEVERITIES = ["low", "medium", "high"] as const;
const STATUSES = ["open", "closed"] as const;

export default function ProjectRisksPage() {
  const toast = useToast();
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectOut | null>(null);
  const [risks, setRisks] = useState<ProjectRiskOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("medium");
  const [reportJobId, setReportJobId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    setLoading(true);
    try {
      const [p, r] = await Promise.all([fetchProject(projectId), fetchProjectRisks(projectId)]);
      setProject(p);
      setRisks(r);
    } catch (e) {
      const msg = friendlyErrorMessage(e, "We could not load risks for this project.");
      setError(msg);
      toast.push("error", msg);
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !title.trim()) return;
    setSubmitting(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        severity,
        status: "open" as const,
        report_run_id: reportJobId.trim() || null,
      };
      const row = await createProjectRisk(projectId, body);
      setRisks((prev) => [row, ...prev]);
      setTitle("");
      setDescription("");
      setReportJobId("");
      toast.push("success", "Risk registered for this project.");
    } catch (err) {
      const msg = friendlyErrorMessage(err, "We could not save this risk.");
      toast.push("error", msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function patchRisk(id: string, patch: Partial<{ severity: string; status: string }>) {
    if (!projectId) return;
    try {
      const row = await updateProjectRisk(projectId, id, patch);
      setRisks((prev) => prev.map((x) => (x.id === row.id ? row : x)));
      toast.push("success", "Risk updated.");
    } catch (err) {
      toast.push("error", friendlyErrorMessage(err, "Update failed."));
    }
  }

  if (!projectId) return <PageLoader />;
  if (loading && !project) return <PageLoader />;

  return (
    <div className="pp-grid pp-grid--1 mx-auto w-full max-w-[1600px]">
      <Card
        title={project ? `Project risks — ${project.name}` : "Project risks"}
        actions={
          <div className="pp-row-actions">
            <Link to={`/dashboard/projects/${encodeURIComponent(projectId)}`} className="pp-btn pp-btn--secondary pp-btn--sm">
              Project
            </Link>
            <Link to={`/dashboard/projects/${encodeURIComponent(projectId)}/reports`} className="pp-btn pp-btn--secondary pp-btn--sm">
              Reports
            </Link>
            <Link to={`/dashboard/projects/${encodeURIComponent(projectId)}/recommendations`} className="pp-btn pp-btn--secondary pp-btn--sm">
              Recommendations
            </Link>
          </div>
        }
      >
        {error ? (
          <p className="pp-field__error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="pp-muted mx-auto max-w-2xl text-center text-pretty">
          Register risks here (severity and open/closed status). They are stored on the project, can be linked to a
          report job id, and appear on the dashboard, health analytics, and generated report narratives.
        </p>

        <form onSubmit={handleCreate} className="pp-stack mx-auto w-full max-w-3xl" style={{ marginTop: "1.25rem" }}>
          <FormField label="Title" htmlFor="risk-title">
            <input
              id="risk-title"
              className="pp-input w-full max-w-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short description of the risk"
              required
            />
          </FormField>
          <FormField label="Details (optional)" htmlFor="risk-desc">
            <textarea
              id="risk-desc"
              className="pp-input w-full max-w-none"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Impact, triggers, mitigation notes…"
            />
          </FormField>
          <FormField label="Severity" htmlFor="risk-sev">
            <select
              id="risk-sev"
              className="pp-input w-full max-w-none"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as (typeof SEVERITIES)[number])}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Link to report job (optional)" htmlFor="risk-job">
            <input
              id="risk-job"
              className="pp-input w-full max-w-none"
              value={reportJobId}
              onChange={(e) => setReportJobId(e.target.value)}
              placeholder="UUID from report history / URL jobId="
            />
          </FormField>
          <div className="flex w-full justify-center pt-1">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Create risk"}
            </Button>
          </div>
        </form>
      </Card>

      <Card title={`Registered risks (${risks.length})`} className="w-full">
        {risks.length === 0 ? (
          <p className="pp-muted">No risks yet. Add one above — open high-severity items drive mitigation suggestions in reports.</p>
        ) : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Report job</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {risks.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.title}</strong>
                      {r.description ? <p className="pp-muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>{r.description}</p> : null}
                    </td>
                    <td>
                      <select
                        className="pp-input pp-btn--sm"
                        style={{ minWidth: "6.5rem" }}
                        value={r.severity}
                        onChange={(e) => void patchRisk(r.id, { severity: e.target.value })}
                      >
                        {SEVERITIES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="pp-input pp-btn--sm"
                        style={{ minWidth: "6rem" }}
                        value={r.status}
                        onChange={(e) => void patchRisk(r.id, { status: e.target.value })}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {r.report_run_id ? (
                        <Link to={`/dashboard/projects/${encodeURIComponent(projectId)}/reports?jobId=${encodeURIComponent(r.report_run_id)}`}>
                          <code>{r.report_run_id.slice(0, 8)}…</code>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="pp-muted" style={{ fontSize: "0.85rem" }}>
                      {new Date(r.updated_at).toLocaleString()}
                    </td>
                    <td />
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

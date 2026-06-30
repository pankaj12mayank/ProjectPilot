import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch, tryParseJson } from "../api/client";
import { fetchProject, type ProjectOut } from "../api/projects";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";
import { useToast } from "../components/ToastProvider";

export default function GovernanceReportPage() {
  const [searchParams] = useSearchParams();
  const projectId = (searchParams.get("projectId") || "").trim();

  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [project, setProject] = useState<ProjectOut | null>(null);
  const [projectErr, setProjectErr] = useState<string | null>(null);

  const endpoint = useMemo(() => "/governance/report", []);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setProjectErr(null);
      try {
        const p = await fetchProject(projectId);
        if (!cancelled) setProject(p);
      } catch (e) {
        if (!cancelled) setProjectErr(e instanceof Error ? e.message : "Could not load project");
        if (!cancelled) setProject(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!projectId) {
      setError("Choose a project from Reports before generating.");
      return;
    }
    setError(null);
    setResult(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const status = fd.get("status_tracker");
    const raid = fd.get("raid_log");
    const history = fd.get("weekly_history");
    if (!(status instanceof File) || !(raid instanceof File) || !(history instanceof File)) {
      setError("Please choose all three files.");
      return;
    }
    const body = new FormData();
    body.append("status_tracker", status);
    body.append("raid_log", raid);
    body.append("weekly_history", history);
    setBusy(true);
    try {
      const res = await apiFetch(endpoint, { method: "POST", body });
      const text = await res.text();
      if (!res.ok) {
        const parsed = tryParseJson<{ detail?: unknown }>(text);
        const detail =
          parsed && typeof parsed.detail === "string"
            ? parsed.detail
            : parsed && Array.isArray(parsed.detail)
              ? JSON.stringify(parsed.detail)
              : text.trim().slice(0, 400) || res.statusText;
        throw new Error(detail || "Request failed");
      }
      const data = tryParseJson<Record<string, unknown>>(text);
      setResult(data ?? {});
      toast.push("success", "Governance report generated successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      toast.push("error", msg);
    } finally {
      setBusy(false);
    }
  }

  if (!projectId) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Card title="Governance report">
          <p className="pp-muted">
            Pick a project on the Reports page first. That keeps every run tied to a workspace you recognise in
            history and permissions.
          </p>
          <div style={{ marginTop: "1rem" }}>
            <Link className="pp-btn pp-btn--primary pp-btn--sm" to="/dashboard/reports">
              Go to Reports
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Card title="Governance report">
        <div className="pp-muted mx-auto max-w-2xl text-center text-sm" style={{ marginBottom: "1.25rem" }}>
          {projectErr ? <p className="pp-field__error">{projectErr}</p> : null}
          {project ? (
            <p>
              Generating in context of <strong className="text-foreground">{project.name}</strong>. Files are still
              processed as uploads on this run (linking to project records in a future release).
            </p>
          ) : !projectErr ? (
            <p>Loading project…</p>
          ) : null}
          <p style={{ marginTop: "0.75rem" }}>
            <Link to="/dashboard/reports" className="text-primary underline-offset-4 hover:underline">
              Change project
            </Link>
          </p>
        </div>

        <p className="pp-muted mx-auto max-w-2xl text-center">
          Status tracker and RAID log must be Excel files with the expected columns. Weekly history is a CSV with{" "}
          <code>Week</code> and <code>Completion</code>.
        </p>

        <form className="pp-form mx-auto w-full max-w-none space-y-4" style={{ marginTop: "1.25rem" }} onSubmit={onSubmit}>
          <FormField label="Status tracker (.xlsx)" htmlFor="g-status">
            <input id="g-status" name="status_tracker" type="file" accept=".xlsx,.xls" required className="w-full" />
          </FormField>
          <FormField label="RAID log (.xlsx)" htmlFor="g-raid">
            <input id="g-raid" name="raid_log" type="file" accept=".xlsx,.xls" required className="w-full" />
          </FormField>
          <FormField label="Weekly history (.csv)" htmlFor="g-hist">
            <input id="g-hist" name="weekly_history" type="file" accept=".csv" required className="w-full" />
          </FormField>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button type="submit" disabled={busy || !project}>
              {busy ? "Generating…" : "Generate report"}
            </Button>
          </div>
        </form>
        {error ? (
          <p className="pp-field__error" role="alert">
            {error}
          </p>
        ) : null}
        {result ? (
          <pre className="pp-json w-full overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
        ) : null}
      </Card>
    </div>
  );
}

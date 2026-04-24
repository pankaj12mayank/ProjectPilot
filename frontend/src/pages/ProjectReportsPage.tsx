import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { fetchProject, type ProjectOut } from "../api/projects";
import { fetchProjectHealth } from "../api/analytics";
import {
  downloadReportArtifact,
  fetchReportHistory,
  generateProjectReports,
  REPORT_ARTIFACTS,
  type ProjectReportPackageResponse,
  type ReportRunSummary,
} from "../api/reports";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ToastProvider";
import { friendlyErrorMessage } from "@/lib/friendlyMessages";

function pathKeyForArtifact(filename: string): string {
  if (filename === "executive_summary.pdf") return "executive_pdf";
  if (filename === "pm_detailed_report.pdf") return "pm_detailed_pdf";
  if (filename === "client_report.docx") return "client_docx";
  if (filename === "pm_detailed_report.docx") return "pm_detailed_docx";
  if (filename === "intelligence_deck.pptx") return "intelligence_pptx";
  if (filename === "email_draft.txt") return "email_draft_txt";
  if (filename === "executive_summary.md") return "executive_summary_md";
  if (filename === "pm_detailed_report.md") return "pm_detailed_report_md";
  if (filename === "client_report.md") return "client_report_md";
  return filename.replace(/\./g, "_");
}

export default function ProjectReportsPage() {
  const toast = useToast();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const jobFromUrl = searchParams.get("jobId") || "";

  const [project, setProject] = useState<ProjectOut | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [packageJson, setPackageJson] = useState<ProjectReportPackageResponse | null>(null);
  const [jobId, setJobId] = useState(jobFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dlError, setDlError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [dataComplete, setDataComplete] = useState<boolean | null>(null);
  const [missingRoles, setMissingRoles] = useState<string[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (jobFromUrl) setJobId(jobFromUrl);
  }, [jobFromUrl]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      setHealthLoading(true);
      setHistoryError(null);
      setPageError(null);
      try {
        const p = await fetchProject(projectId);
        if (cancelled) return;
        setProject(p);

        const [hist, h] = await Promise.all([
          fetchReportHistory(projectId).catch((err) => {
            if (!cancelled) {
              setHistoryError(friendlyErrorMessage(err, "Could not load report history."));
            }
            return [] as ReportRunSummary[];
          }),
          fetchProjectHealth(projectId).catch(() => null),
        ]);
        if (cancelled) return;

        if (h) {
          setDataComplete(Boolean(h.data_complete));
          setMissingRoles(Array.isArray(h.missing_roles) ? h.missing_roles : []);
        } else {
          setDataComplete(null);
          setMissingRoles([]);
        }

        if (!jobFromUrl && hist.length) {
          const latest = hist[0]!;
          setJobId(latest.job_id);
          setSearchParams({ jobId: latest.job_id }, { replace: true });
        }
      } catch (e) {
        if (!cancelled) {
          const msg = friendlyErrorMessage(e, "We could not load this project.");
          setPageError(msg);
          toast.push("error", msg);
        }
      } finally {
        if (!cancelled) setHealthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, jobFromUrl, setSearchParams, toast]);

  const activeJob = packageJson?.job_id || jobId;

  const handleGenerate = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    setDlError(null);
    setLoading(true);
    try {
      const p = await generateProjectReports(projectId);
      setPackageJson(p);
      setJobId(p.job_id);
      setSearchParams({ jobId: p.job_id });
      toast.push("success", "A new report package was generated. You can download the files below.");
    } catch (e) {
      const msg = friendlyErrorMessage(e, "Report generation failed.");
      setError(msg);
      toast.push("error", msg);
    } finally {
      setLoading(false);
    }
  }, [projectId, setSearchParams, toast]);

  async function handleDownload(filename: string) {
    if (!projectId || !activeJob) return;
    setDlError(null);
    try {
      await downloadReportArtifact(projectId, activeJob, filename);
      toast.push("success", `Download started: ${filename}`);
    } catch (e) {
      const msg = friendlyErrorMessage(e, "Download failed.");
      setDlError(msg);
      toast.push("error", msg);
    }
  }

  if (!projectId) return <PageLoader />;

  if (pageError && !project) {
    return (
      <div className="pp-grid pp-grid--1">
        <Card title="Reports">
          <p className="pp-field__error" role="alert">
            {pageError}
          </p>
          <Link to="/dashboard/projects" className="pp-btn pp-btn--secondary pp-btn--sm" style={{ marginTop: "1rem" }}>
            All projects
          </Link>
        </Card>
      </div>
    );
  }

  if (!project) return <PageLoader />;

  const outputs = packageJson?.outputs;
  /** Only prompt for upload when there is no ingested project data yet (past reports alone do not count). */
  const showUploadGate = !project.has_ingested_data;
  const showPartialDataNote = project.has_ingested_data && dataComplete === false;

  return (
    <div className="pp-grid pp-grid--1">
      {showUploadGate ? (
        <Card title="Upload data first">
          <p className="pp-muted">
            Reports are built from validated spreadsheet data stored for this project. Upload and validate your status
            tracker, RAID log, and weekly history, then return here.
          </p>
          <div className="pp-row-actions" style={{ marginTop: "1rem" }}>
            <Link className="pp-btn pp-btn--primary" to={`/dashboard/projects/${encodeURIComponent(projectId)}/upload`}>
              Go to upload
            </Link>
            <Link className="pp-btn pp-btn--secondary" to={`/dashboard/projects/${encodeURIComponent(projectId)}/health`}>
              Health &amp; data status
            </Link>
          </div>
        </Card>
      ) : null}

      {showPartialDataNote ? (
        <Card title="Data completeness">
          <p className="pp-muted">
            Some expected file roles are still missing: <strong>{missingRoles.length ? missingRoles.join(", ") : "see health page"}</strong>.
            You can still open past report jobs or generate from what is already stored.
          </p>
          <div className="pp-row-actions" style={{ marginTop: "0.75rem" }}>
            <Link className="pp-btn pp-btn--secondary pp-btn--sm" to={`/dashboard/projects/${encodeURIComponent(projectId)}/upload`}>
              Add missing uploads
            </Link>
          </div>
        </Card>
      ) : null}

      <Card
        title="Download reports"
        actions={
          <div className="pp-row-actions">
            <Link
              to={`/dashboard/projects/${encodeURIComponent(projectId)}/reports/history`}
              className="pp-btn pp-btn--secondary pp-btn--sm"
            >
              Report history
            </Link>
            <Link
              to={`/dashboard/projects/${encodeURIComponent(projectId)}/forecast`}
              className="pp-btn pp-btn--secondary pp-btn--sm"
            >
              Forecast
            </Link>
            <Link to={`/dashboard/projects/${encodeURIComponent(projectId)}`} className="pp-btn pp-btn--secondary pp-btn--sm">
              Project
            </Link>
          </div>
        }
      >
        {healthLoading ? <p className="pp-muted">Loading project…</p> : null}
        {historyError ? <p className="pp-field__error">{historyError}</p> : null}
        <p className="pp-muted">
          Generates PowerPoint, PDF, DOCX, Markdown, and email draft from <strong>live ingested data</strong> for this
          project. When you already have data, the latest report job is selected automatically so you do not need to
          re-upload files.
        </p>
        {error ? <p className="pp-field__error">{error}</p> : null}
        {dlError ? <p className="pp-field__error">{dlError}</p> : null}
        <div className="pp-row-actions" style={{ marginTop: "1rem" }}>
          <Button type="button" onClick={handleGenerate} disabled={loading || showUploadGate}>
            {loading ? "Generating…" : "Generate new report package"}
          </Button>
        </div>
        {activeJob ? (
          <p className="pp-muted" style={{ marginTop: "1rem" }}>
            Job ID: <code>{activeJob}</code>
          </p>
        ) : null}
      </Card>

      {activeJob && !showUploadGate ? (
        <Card title="Download files">
          <p className="pp-muted">If a format failed server-side, that download may return an error — try another format.</p>
          <div className="pp-report-dl-grid">
            {REPORT_ARTIFACTS.map(({ filename, label }) => {
              const pathKey = pathKeyForArtifact(filename);
              const ok =
                outputs == null ? Boolean(activeJob) : outputs[pathKey as keyof typeof outputs] != null;
              return (
                <div key={filename} className="pp-report-dl-row">
                  <span className="pp-report-dl-label">{label}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    className="pp-btn--sm"
                    disabled={!ok}
                    onClick={() => void handleDownload(filename)}
                  >
                    Download
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      ) : !showUploadGate ? (
        <Card title="Get started">
          <p className="pp-muted">
            When you are ready, generate a package here, or open <strong>Report history</strong> to pick a past job.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

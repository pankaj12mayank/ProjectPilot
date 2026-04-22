import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  downloadReportArtifact,
  generateProjectReports,
  REPORT_ARTIFACTS,
  type ProjectReportPackageResponse,
} from "../api/reports";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";
import { Button } from "../components/ui/Button";

export default function ProjectReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const jobFromUrl = searchParams.get("jobId") || "";

  const [packageJson, setPackageJson] = useState<ProjectReportPackageResponse | null>(null);
  const [jobId, setJobId] = useState(jobFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dlError, setDlError] = useState<string | null>(null);

  useEffect(() => {
    if (jobFromUrl) setJobId(jobFromUrl);
  }, [jobFromUrl]);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }, [projectId, setSearchParams]);

  async function handleDownload(filename: string) {
    if (!projectId || !activeJob) return;
    setDlError(null);
    try {
      await downloadReportArtifact(projectId, activeJob, filename);
    } catch (e) {
      setDlError(e instanceof Error ? e.message : "Download failed");
    }
  }

  if (!projectId) return <PageLoader />;

  const outputs = packageJson?.outputs;

  return (
    <div className="pp-grid pp-grid--1">
      <Card
        title="Download reports"
        actions={
          <div className="pp-row-actions">
            <Link to={`/dashboard/projects/${projectId}/reports/history`} className="pp-btn pp-btn--secondary pp-btn--sm">
              Report history
            </Link>
            <Link to={`/dashboard/projects/${projectId}/forecast`} className="pp-btn pp-btn--secondary pp-btn--sm">
              Forecast
            </Link>
            <Link to={`/dashboard/projects/${projectId}`} className="pp-btn pp-btn--secondary pp-btn--sm">
              Project
            </Link>
          </div>
        }
      >
        <p className="pp-muted">
          Generates PowerPoint, PDF, DOCX, Markdown, and email draft from <strong>live ingested data</strong> for this
          project. Downloads use your session token so files transfer correctly.
        </p>
        {error ? <p className="pp-field__error">{error}</p> : null}
        {dlError ? <p className="pp-field__error">{dlError}</p> : null}
        <div className="pp-row-actions" style={{ marginTop: "1rem" }}>
          <Button type="button" onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating…" : "Generate new report package"}
          </Button>
        </div>
        {activeJob ? (
          <p className="pp-muted" style={{ marginTop: "1rem" }}>
            Job ID: <code>{activeJob}</code>
          </p>
        ) : null}
      </Card>

      {activeJob ? (
        <Card title="Download files">
          <p className="pp-muted">If a format failed server-side, that button will return 404 — check API error details.</p>
          <div className="pp-report-dl-grid">
            {REPORT_ARTIFACTS.map(({ filename, label }) => {
              const key = filename.replace(/\./g, "_");
              const pathKey =
                filename === "executive_summary.pdf"
                  ? "executive_pdf"
                  : filename === "pm_detailed_report.pdf"
                    ? "pm_detailed_pdf"
                    : filename === "client_report.docx"
                      ? "client_docx"
                      : filename === "pm_detailed_report.docx"
                        ? "pm_detailed_docx"
                        : filename === "intelligence_deck.pptx"
                          ? "intelligence_pptx"
                          : filename === "email_draft.txt"
                            ? "email_draft_txt"
                            : filename === "executive_summary.md"
                              ? "executive_summary_md"
                              : filename === "pm_detailed_report.md"
                                ? "pm_detailed_report_md"
                                : filename === "client_report.md"
                                  ? "client_report_md"
                                  : key;
              const ok = outputs ? outputs[pathKey] != null : true;
              return (
                <div key={filename} className="pp-report-dl-row">
                  <span className="pp-report-dl-label">{label}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    className="pp-btn--sm"
                    disabled={!ok}
                    onClick={() => handleDownload(filename)}
                  >
                    Download
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card title="Get started">
          <p className="pp-muted">Generate a package to enable downloads, or open Report history to pick a past job.</p>
        </Card>
      )}
    </div>
  );
}

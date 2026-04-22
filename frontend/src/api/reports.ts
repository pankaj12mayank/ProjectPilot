import { apiFetch, parseJson } from "./client";

export type ProjectReportPackageResponse = {
  job_id: string;
  project_id: string;
  intelligence: {
    forecast: Record<string, unknown>;
    root_causes: unknown[];
    recommendations: unknown[];
  };
  summaries_markdown: { executive: string; pm_detailed: string; client: string };
  outputs: Record<string, string | null | undefined>;
};

export type ReportRunSummary = {
  job_id: string;
  created_at: string;
  rag_status: string;
  forecast_headline: string | null;
};

/** Files written by the backend for each job (use for download buttons). */
export const REPORT_ARTIFACTS: { filename: string; label: string }[] = [
  { filename: "executive_summary.pdf", label: "Executive summary (PDF)" },
  { filename: "pm_detailed_report.pdf", label: "PM detailed report (PDF)" },
  { filename: "client_report.docx", label: "Client report (DOCX)" },
  { filename: "pm_detailed_report.docx", label: "PM detailed report (DOCX)" },
  { filename: "intelligence_deck.pptx", label: "Intelligence deck (PowerPoint)" },
  { filename: "email_draft.txt", label: "Email draft (TXT)" },
  { filename: "executive_summary.md", label: "Executive summary (Markdown)" },
  { filename: "pm_detailed_report.md", label: "PM detailed report (Markdown)" },
  { filename: "client_report.md", label: "Client report (Markdown)" },
];

export async function generateProjectReports(projectId: string): Promise<ProjectReportPackageResponse> {
  const res = await apiFetch(`/projects/${projectId}/reports/generate`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return parseJson<ProjectReportPackageResponse>(res);
}

export async function fetchReportHistory(projectId: string): Promise<ReportRunSummary[]> {
  const res = await apiFetch(`/projects/${projectId}/reports/history`);
  if (!res.ok) throw new Error(await res.text());
  return parseJson<ReportRunSummary[]>(res);
}

export async function downloadReportArtifact(
  projectId: string,
  jobId: string,
  artifact: string,
  saveAsName?: string,
): Promise<void> {
  const path = `/projects/${projectId}/reports/${encodeURIComponent(jobId)}/download/${encodeURIComponent(artifact)}`;
  const res = await apiFetch(path);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = saveAsName ?? artifact;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

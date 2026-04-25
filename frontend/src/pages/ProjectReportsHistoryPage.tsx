import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchReportHistory, type ReportRunSummary } from "../api/reports";
import { Card } from "../components/ui/Card";
import { PageLoader } from "../components/PageLoader";
import { Table } from "../components/ui/Table";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ProjectReportsHistoryPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [rows, setRows] = useState<ReportRunSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!projectId) return;
      try {
        const r = await fetchReportHistory(projectId);
        if (!cancelled) setRows(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load history");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!projectId) return <PageLoader />;

  if (error) {
    return (
      <Card title="Report history">
        <p className="pp-field__error">{error}</p>
        <Link to={`/dashboard/projects/${projectId}/reports`}>Back to reports</Link>
      </Card>
    );
  }

  return (
    <div className="pp-grid pp-grid--1">
      <Card
        title="Report history"
        actions={
          <Link to={`/dashboard/projects/${projectId}/reports`} className="pp-btn pp-btn--secondary pp-btn--sm">
            New download
          </Link>
        }
      >
        <p className="pp-muted">
          Last 50 report runs for this project. Pick a row to open that run and <strong>Download now</strong> for each
          file you need—everything is saved directly in your browser.
        </p>
        {rows.length === 0 ? (
          <p className="pp-muted">No reports yet — generate one from the project&apos;s Reports page.</p>
        ) : (
          <Table<ReportRunSummary>
            columns={[
              { key: "created_at", header: "Created", render: (r) => fmtDate(r.created_at) },
              { key: "rag_status", header: "RAG", render: (r) => r.rag_status },
              { key: "forecast_headline", header: "Forecast headline", render: (r) => r.forecast_headline ?? "—" },
              {
                key: "job_id",
                header: "",
                render: (r) => (
                  <Link className="pp-btn pp-btn--secondary pp-btn--sm" to={`/dashboard/projects/${projectId}/reports?jobId=${r.job_id}`}>
                    Download files
                  </Link>
                ),
              },
            ]}
            rows={rows}
            rowKey={(r) => r.job_id}
          />
        )}
      </Card>
    </div>
  );
}

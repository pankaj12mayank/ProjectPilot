import { apiFetch, readJsonOk } from "./client";

export type PortfolioProjectRow = {
  project_id: string;
  name: string;
  owner_id: string;
  is_archived: boolean;
  updated_at: string | null;
  latest_rag: string | null | undefined;
  latest_completion_pct: number | null | undefined;
  latest_spi: number | null | undefined;
  latest_cpi: number | null | undefined;
  latest_risk_score: number | null | undefined;
  last_snapshot_at: string | null;
  data_complete?: boolean;
  rank_completion_pct?: number;
  rank_spi?: number;
  rank_risk_score?: number;
};

export type TrendPoint = {
  captured_at: string;
  source: string;
  rag?: string | null;
  completion_pct?: number | null;
  spi?: number | null;
  cpi?: number | null;
  risk_score?: number | null;
};

export type PortfolioComparison = {
  rows: PortfolioProjectRow[];
  trends: Record<string, TrendPoint[]>;
};

export type PortfolioSummary = {
  totals: { projects: number };
  by_rag: Record<string, number>;
  average_risk_score: number | null;
  top_risky_projects: Array<{ project_id: string; name: string; risk_score: number; rag: string | null | undefined }>;
  projects: PortfolioProjectRow[];
};

export type HeatmapProject = {
  project_id: string;
  name: string;
  raw: Record<string, unknown>;
  heatmap: Record<string, number | null | undefined>;
};

export type RiskHeatmapResponse = {
  projects: HeatmapProject[];
  dimensions: string[];
};

export type PortfolioReportHistoryRow = {
  job_id: string;
  project_id: string;
  project_name: string;
  created_at: string;
  rag_status: string;
  forecast_headline: string | null;
};

export type PortfolioOpenRiskRow = {
  risk_id: string;
  project_id: string;
  project_name: string;
  title: string;
  severity: string;
  status: string;
  report_run_id: string | null;
  created_at: string;
};

export type ProjectHistoryEvent = {
  type: string;
  project_id: string;
  at: string;
  [key: string]: unknown;
};

export type ProjectHistoryResponse = {
  project_id: string;
  project_name: string | null;
  events: ProjectHistoryEvent[];
};

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

function cacheBustQuery(cacheBust?: string | number): string {
  if (cacheBust === undefined || cacheBust === "") return "";
  return `?_=${encodeURIComponent(String(cacheBust))}`;
}

export async function fetchPortfolioComparison(cacheBust?: string | number): Promise<PortfolioComparison> {
  const res = await apiFetch(`/portfolio/comparison${cacheBustQuery(cacheBust)}`);
  return readJsonOk<PortfolioComparison>(res);
}

export async function fetchPortfolioSummary(cacheBust?: string | number): Promise<PortfolioSummary> {
  const res = await apiFetch(`/portfolio/summary${cacheBustQuery(cacheBust)}`);
  return readJsonOk<PortfolioSummary>(res);
}

export async function fetchPortfolioOpenRisks(limit = 40): Promise<PortfolioOpenRiskRow[]> {
  const res = await apiFetch(`/portfolio/open-risks${buildQuery({ limit })}`);
  return readJsonOk<PortfolioOpenRiskRow[]>(res);
}

export async function fetchPortfolioRiskHeatmap(cacheBust?: string | number): Promise<RiskHeatmapResponse> {
  const res = await apiFetch(`/portfolio/risk-heatmap${cacheBustQuery(cacheBust)}`);
  return readJsonOk<RiskHeatmapResponse>(res);
}

export async function fetchPortfolioReportHistory(
  limit = 100,
  projectId?: string,
): Promise<PortfolioReportHistoryRow[]> {
  const res = await apiFetch(`/portfolio/report-history${buildQuery({ limit, project_id: projectId })}`);
  return readJsonOk<PortfolioReportHistoryRow[]>(res);
}

export async function fetchProjectHistory(projectId: string, limit = 120): Promise<ProjectHistoryResponse> {
  const res = await apiFetch(`/projects/${projectId}/history${buildQuery({ limit })}`);
  return readJsonOk<ProjectHistoryResponse>(res);
}

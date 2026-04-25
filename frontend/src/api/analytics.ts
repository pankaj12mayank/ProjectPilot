import { apiFetch, readJsonOk } from "./client";

export type RagDetail = {
  status: string;
  reasons?: string[];
  inputs: {
    risk_score: number;
    schedule_variance_sum_pct_points: number;
    thresholds: Record<string, number>;
  };
};

export type RegisteredRiskRow = {
  id: string;
  title: string;
  description?: string | null;
  severity: string;
  status: string;
  report_run_id?: string | null;
  created_at?: string | null;
};

export type ProjectHealthResponse = {
  project_id: string;
  data_complete: boolean;
  missing_roles: string[];
  /** Manually registered project risks (same source as /projects/{id}/risks). */
  registered_risks?: RegisteredRiskRow[];
  rag: RagDetail;
  kpis: Record<string, number | null | undefined>;
  evm: Record<string, number | null | undefined>;
  risk: {
    risk_score: number;
    high_risk_count?: number;
    high_severity_open_count?: number;
    open_risk_count?: number;
    by_severity: Record<string, number>;
    by_type: Record<string, number>;
    by_status: Record<string, number>;
    open_high_risks: Array<{ summary: string }>;
    total_items: number;
  };
  milestones: {
    milestones: Array<{
      name: string;
      planned_pct: number | null;
      actual_pct: number | null;
      variance_pct: number | null;
      delay_pct_points?: number | null;
      state: string;
    }>;
    late_count: number;
    ahead_count: number;
    on_track_count: number;
    delayed_milestone_count?: number;
    avg_delay_pct_points?: number | null;
    max_delay_pct_points?: number | null;
  };
  resources: {
    total_planned_hours: number | null;
    total_actual_hours: number | null;
    variance_hours: number | null;
    utilization_ratio: number | null;
    by_task: Array<{
      task: string;
      planned_hours: number | null;
      actual_hours: number | null;
      delta_hours: number | null;
    }>;
  };
  dependencies: {
    mode: string;
    note: string;
    nodes: Array<{ id: string; label: string }>;
    edges: Array<{ from: string; to: string; type: string }>;
    edge_delays?: Array<{ from_label: string; to_label: string; successor_slip_pct: number | null }>;
    total_dependency_slip_pct?: number | null;
  };
  charts: {
    weekly_completion: Array<{ week: string; completion: number | null }>;
    severity_distribution: Array<{ name: string; value: number }>;
    resource_hours: { labels: string[]; planned: number[]; actual: number[] };
    completion_gauge: { value: number };
    spi_cpi: { spi: number; cpi: number };
  };
};

export async function fetchProjectHealth(projectId: string, cacheBust?: string | number): Promise<ProjectHealthResponse> {
  const enc = encodeURIComponent(projectId);
  const q =
    cacheBust !== undefined && cacheBust !== ""
      ? `?_=${encodeURIComponent(String(cacheBust))}`
      : "";
  const res = await apiFetch(`/projects/${enc}/analytics/health${q}`);
  return readJsonOk<ProjectHealthResponse>(res);
}

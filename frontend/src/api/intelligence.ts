import { apiFetch, parseJson } from "./client";

export type MetricRef = { metric: string; value: unknown; source: string };

export type RecommendationItem = {
  priority: number;
  title: string;
  detail: string;
  owner_hint: string;
  metric_refs: MetricRef[];
  root_cause_ids: string[];
  risk_refs: Record<string, unknown>;
};

export type ProjectIntelligenceResponse = {
  project_id: string;
  project_name: string;
  data_complete: boolean;
  missing_roles: string[];
  forecast: Record<string, unknown>;
  root_causes: Array<Record<string, unknown>>;
  recommendations: RecommendationItem[];
};

export async function fetchProjectIntelligence(projectId: string): Promise<ProjectIntelligenceResponse> {
  const res = await apiFetch(`/projects/${projectId}/analytics/intelligence`);
  if (!res.ok) throw new Error(await res.text());
  return parseJson<ProjectIntelligenceResponse>(res);
}

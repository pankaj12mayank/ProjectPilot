import { friendlyHttpError } from "@/lib/friendlyMessages";
import { apiFetch, apiUrl, getRefreshToken, getToken, readJsonOk, setTokens } from "./client";

export type ProjectOut = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  is_active?: boolean;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  team_user_ids?: string[];
  template_key?: string | null;
  has_ingested_data?: boolean;
  latest_report_job_id?: string | null;
  latest_report_at?: string | null;
};

export type ProjectTemplateOut = {
  key: string;
  name: string;
  summary: string;
  checklist: string[];
  suggested_description: string;
};

export type AssignableUserOut = {
  id: string;
  email: string;
  full_name: string;
};

export type FormatGuideSlot = {
  role: string;
  title: string;
  columns: string[];
  preview_rows: string[][];
};

export type FormatGuideOut = {
  slots: FormatGuideSlot[];
};

export type FileSlotError = {
  code: string;
  message: string;
  row: number | null;
  column: string | null;
};

export type FileAnalyzeSlot = {
  role: string;
  filename: string | null;
  valid: boolean;
  errors: FileSlotError[];
  warnings: string[];
  column_mapping: Record<string, string>;
  preview_columns: string[];
  preview_rows: Array<Array<string | number | boolean | null>>;
  sheet_used?: string | null;
  data_row_count?: number | null;
  persisted_row_count?: number | null;
};

export type AnalyzeUploadResponse = {
  project_id: string;
  files: FileAnalyzeSlot[];
};

export async function fetchProjects(): Promise<ProjectOut[]> {
  const res = await apiFetch("/projects");
  return readJsonOk<ProjectOut[]>(res);
}

export async function fetchProject(id: string): Promise<ProjectOut> {
  const res = await apiFetch(`/projects/${id}`);
  return readJsonOk<ProjectOut>(res);
}

export async function createProject(body: {
  name: string;
  description?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  team_user_ids?: string[];
  template_key?: string | null;
}): Promise<ProjectOut> {
  const res = await apiFetch("/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return readJsonOk<ProjectOut>(res);
}

export async function updateProject(
  id: string,
  body: {
    name?: string;
    description?: string | null;
    is_archived?: boolean;
    planned_start_date?: string | null;
    planned_end_date?: string | null;
    team_user_ids?: string[];
  },
): Promise<ProjectOut> {
  const res = await apiFetch(`/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return readJsonOk<ProjectOut>(res);
}

export async function deleteProject(id: string): Promise<void> {
  const enc = encodeURIComponent(id);
  // Prefer same URL shape as other project actions: POST /projects/{id}/delete
  let res = await apiFetch(`/projects/${enc}/delete`, { method: "POST" });
  if (res.status === 404) {
    res = await apiFetch(`/projects/delete/${enc}`, { method: "POST" });
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Delete failed (${res.status})`);
  }
}

export async function fetchAssignableUsers(): Promise<AssignableUserOut[]> {
  const res = await apiFetch("/projects/creation/assignable-users");
  return readJsonOk<AssignableUserOut[]>(res);
}

export async function fetchFormatGuide(): Promise<FormatGuideOut> {
  const res = await apiFetch("/projects/creation/format-guide");
  return readJsonOk<FormatGuideOut>(res);
}

export async function fetchCreationTemplates(): Promise<ProjectTemplateOut[]> {
  const res = await apiFetch("/projects/creation/templates");
  return readJsonOk<ProjectTemplateOut[]>(res);
}

export async function downloadProjectSampleCsv(role: string): Promise<Blob> {
  const res = await apiFetch(`/projects/creation/samples/${encodeURIComponent(role)}`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Download failed (${res.status})`);
  }
  return res.blob();
}

async function refreshAccessToken(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;
  const res = await fetch(apiUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: rt }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!data.access_token || !data.refresh_token) return false;
  setTokens(data.access_token, data.refresh_token);
  return true;
}

/**
 * Multipart upload with progress. Retries once after refresh on 401 (FormData cannot reuse body).
 */
export function uploadProjectAnalyze(
  projectId: string,
  formData: FormData,
  onProgress: (pct: number) => void,
): Promise<AnalyzeUploadResponse> {
  return new Promise((resolve, reject) => {
    const path = `/projects/${encodeURIComponent(projectId)}/uploads/analyze`;

    function run(isRetry: boolean) {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", apiUrl(path));
      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) onProgress(Math.round((evt.loaded / evt.total) * 100));
        else onProgress(0);
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));

      xhr.onload = async () => {
        if (xhr.status === 401 && !isRetry && getRefreshToken()) {
          const ok = await refreshAccessToken();
          if (ok) {
            run(true);
            return;
          }
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText || "{}") as AnalyzeUploadResponse);
          } catch (e) {
            reject(e);
          }
          return;
        }
        reject(
          new Error(
            friendlyHttpError(xhr.status, xhr.responseText || "", "We could not upload or validate your files."),
          ),
        );
      };

      xhr.send(formData);
    }

    run(false);
  });
}

export async function recordProjectMetricsSnapshot(
  projectId: string,
): Promise<{ snapshot_id: string; created_at: string }> {
  const enc = encodeURIComponent(projectId);
  const res = await apiFetch(`/projects/${enc}/metrics/snapshot`, { method: "POST" });
  return readJsonOk<{ snapshot_id: string; created_at: string }>(res);
}

export type MetricsSnapshotListItem = {
  snapshot_id: string;
  project_id: string;
  created_at: string;
  source: string;
  report_run_id: string | null;
};

export async function fetchProjectMetricsSnapshots(
  projectId: string,
  limit = 50,
): Promise<MetricsSnapshotListItem[]> {
  const enc = encodeURIComponent(projectId);
  const res = await apiFetch(`/projects/${enc}/metrics/snapshots?limit=${encodeURIComponent(String(limit))}`);
  return readJsonOk<MetricsSnapshotListItem[]>(res);
}

export type ProjectRiskOut = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  report_run_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export async function fetchProjectRisks(projectId: string): Promise<ProjectRiskOut[]> {
  const enc = encodeURIComponent(projectId);
  const res = await apiFetch(`/projects/${enc}/risks`);
  return readJsonOk<ProjectRiskOut[]>(res);
}

export async function createProjectRisk(
  projectId: string,
  body: {
    title: string;
    description?: string | null;
    severity?: "low" | "medium" | "high";
    status?: "open" | "closed";
    report_run_id?: string | null;
  },
): Promise<ProjectRiskOut> {
  const enc = encodeURIComponent(projectId);
  const res = await apiFetch(`/projects/${enc}/risks`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return readJsonOk<ProjectRiskOut>(res);
}

export async function updateProjectRisk(
  projectId: string,
  riskId: string,
  body: Partial<{
    title: string;
    description: string | null;
    severity: "low" | "medium" | "high";
    status: "open" | "closed";
    report_run_id: string | null;
  }>,
): Promise<ProjectRiskOut> {
  const enc = encodeURIComponent(projectId);
  const rid = encodeURIComponent(riskId);
  const res = await apiFetch(`/projects/${enc}/risks/${rid}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return readJsonOk<ProjectRiskOut>(res);
}
